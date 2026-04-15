<template>
  <q-page class="ai-chat-page">
    <!-- Dialog de configuration des credentials -->
    <q-dialog v-model="showCredentialsDialog" persistent>
      <q-card style="min-width: 380px">
        <q-card-section>
          <div class="text-h6">Configuration de l'assistant IA</div>
          <div class="text-caption text-grey q-mt-xs">
            Entrez les identifiants fournis par votre administrateur pour accéder
            à l'assistant IA.
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-sm">
          <q-input
            v-model="form.username"
            label="Nom d'utilisateur"
            outlined
            dense
            autofocus
            @keyup.enter="saveCredentials"
          />
          <q-input
            v-model="form.password"
            label="Mot de passe"
            outlined
            dense
            :type="showPassword ? 'text' : 'password'"
            @keyup.enter="saveCredentials"
          >
            <template v-slot:append>
              <q-icon
                :name="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey" @click="cancel" />
          <q-btn
            flat
            label="Valider"
            color="primary"
            :loading="savingCredentials"
            :disable="!form.username || !form.password"
            @click="saveCredentials"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Conteneur du chat -->
    <div v-if="chatReady" id="n8n-chat-container"></div>
  </q-page>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { createChat } from "@n8n/chat";
import "@n8n/chat/style.css";
import { api } from "boot/axios";
import { useRouter } from "vue-router";

const CHAT_WEBHOOK_URL =
  "https://locations.kybo.ch/webhook/73282e51-46a3-424f-80f3-122cecea4ee0/chat";

const showCredentialsDialog = ref(false);
const showPassword = ref(false);
const savingCredentials = ref(false);
const chatReady = ref(false);
const form = ref({ username: "", password: "" });
const router = useRouter();

const cancel = () => {
  showCredentialsDialog.value = false;
  router.push({ name: "home" });
};

let typingObserver = null;

// Injecte le vrai typing indicator natif du package dans le DOM
// et le retire dès qu'un message du bot arrive.
const startTypingObserver = () => {
  const container = document.querySelector("#n8n-chat-container");
  if (!container) return;

  let fakeTyping = null;

  const injectTyping = () => {
    if (fakeTyping) return;
    const msgList = container.querySelector(".chat-messages-list");
    if (!msgList) return;

    // Crée un élément identique au MessageTyping natif du package
    fakeTyping = document.createElement("div");
    fakeTyping.className = "chat-message chat-message-typing chat-message-typing-animation-bouncing";
    fakeTyping.setAttribute("data-test-id", "chat-message-typing");
    fakeTyping.innerHTML = `<div class="chat-message-typing-body">
      <span class="chat-message-typing-circle"></span>
      <span class="chat-message-typing-circle"></span>
      <span class="chat-message-typing-circle"></span>
    </div>`;
    msgList.appendChild(fakeTyping);
    msgList.scrollTop = msgList.scrollHeight;
  };

  const removeTyping = () => {
    fakeTyping?.remove();
    fakeTyping = null;
  };

  typingObserver = new MutationObserver(() => {
    const messages = container.querySelectorAll(
      ".chat-message-from-user, .chat-message-from-bot"
    );
    if (messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (last.classList.contains("chat-message-from-user")) {
      injectTyping();
    } else {
      removeTyping();
    }
  });

  typingObserver.observe(container, { childList: true, subtree: true });
};

const initChat = (username, password) => {
  chatReady.value = true;
  const basicAuthHeader = btoa(`${username}:${password}`);

  setTimeout(() => {
    localStorage.removeItem("n8n-chat/sessionId");
    createChat({
      webhookUrl: CHAT_WEBHOOK_URL,
      target: "#n8n-chat-container",
      mode: "fullscreen",
      showWelcomeScreen: false,
      defaultLanguage: "fr",
      initialMessages: [
        "Bonjour ! Je suis votre assistant IA. Posez-moi vos questions sur les données de l'installation.",
      ],
      i18n: {
        fr: {
          title: "Assistant IA",
          subtitle: "Posez vos questions sur les données",
          footer: "",
          getStarted: "Démarrer",
          inputPlaceholder: "Posez votre question...",
          closeButtonTooltip: "Fermer",
        },
      },
      allowFileUploads: true,
      allowedFilesMimeTypes: "application/pdf,image/*,.xlsx,.xls,.csv,.docx,.doc,.txt",
      webhookConfig: {
        headers: {
          Authorization: `Basic ${basicAuthHeader}`,
        },
      },
    });
    setTimeout(startTypingObserver, 300);
  }, 50);
};

const saveCredentials = async () => {
  if (!form.value.username || !form.value.password) return;
  savingCredentials.value = true;
  try {
    await api.post("/config/ai-chat-credentials", {
      username: form.value.username,
      password: form.value.password,
    });
    showCredentialsDialog.value = false;
    initChat(form.value.username, form.value.password);
  } catch {
    // Silencieux — l'utilisateur peut réessayer
  } finally {
    savingCredentials.value = false;
  }
};

onUnmounted(() => {
  typingObserver?.disconnect();
});

onMounted(async () => {
  try {
    const response = await api.get("/config/ai-chat-credentials");
    if (response.data.configured) {
      initChat(response.data.username, response.data.password);
    } else {
      showCredentialsDialog.value = true;
    }
  } catch {
    showCredentialsDialog.value = true;
  }
});
</script>

<style>
.ai-chat-page {
  top: 0;
  position: absolute;
  height: 100vh;
  width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
}

#n8n-chat-container {
  flex: 1;
  height: calc(100% - 10px);
}

#n8n-chat-container .n8n-chat {
  height:calc(100% - 10px);
}

#n8n-chat-container .chat-window {
  height: 100% !important;
  max-height: 100% !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

</style>
