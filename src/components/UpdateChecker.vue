<template>
  <div class="update-container">
    <q-banner v-if="updateAvailable" class="bg-info text-white">
      <template #avatar>
        <q-icon name="mdi-update" />
      </template>
      <div class="text-h6">Nouvelle mise à jour !</div>
      <div>La version {{ latestVersion }} est maintenant disponible.</div>
      <template #action>
        <q-btn
          :loading="updating"
          flat
          color="white"
          label="Mettre à jour"
          @click="handleUpdate"
        />
      </template>
    </q-banner>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useQuasar } from "quasar";
import { useAppStore } from "src/stores/app";

const $q = useQuasar();
const App = useAppStore();

const currentVersion = ref(null);
const latestVersion = ref(null);
const updateAvailable = ref(false);
const updating = ref(false);
const isDevelopment = ref(import.meta.env.DEV);

const checkForUpdates = async (autoInstall = false) => {
  try {
    // Ne pas vérifier les mises à jour en mode développement
    if (isDevelopment.value) {
      console.log("Update checker disabled in development mode");
      return;
    }

    if (!window.electron || !window.electron.checkForUpdates) {
      console.log("Update checker not available yet");
      return;
    }
    const result = await window.electron.checkForUpdates();
    currentVersion.value = result.currentVersion;
    latestVersion.value = result.latestVersion;
    updateAvailable.value = result.updateAvailable;

    if (result.updateAvailable && autoInstall) {
      handleUpdate(true);
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
};

watch(updateAvailable, (newVal) => {
  if (newVal && App.isBot) {
    handleUpdate();
  }
});

const handleUpdate = async (silent = false) => {
  // Ne pas permettre les mises à jour en mode développement
  if (isDevelopment.value) {
    console.log("Updates disabled in development mode");
    return;
  }

  let progressNotif = null;

  try {
    updating.value = true;

    // Show progress notification
    progressNotif = $q.notify({
      group: false,
      timeout: 0,
      spinner: true,
      message: "Téléchargement de la mise à jour...",
      caption: "0%",
    });

    // Setup progress listener
    const progressListener = (progress) => {
      if (progress.stage === "downloading" && progress.percent) {
        progressNotif({
          caption: `${progress.percent}%`,
          message: "Téléchargement de la mise à jour...",
        });
      } else if (progress.stage === "saving") {
        progressNotif({
          message: "Enregistrement du fichier...",
        });
      } else if (progress.stage === "complete") {
        progressNotif({
          icon: "done",
          spinner: false,
          message: "Téléchargement terminé !",
          timeout: 2000,
        });
      } else if (progress.stage === "error") {
        progressNotif({
          type: "negative",
          icon: "error",
          spinner: false,
          message: "Erreur lors du téléchargement",
          caption: progress.message,
          timeout: 5000,
        });
      }
    };

    window.electron.onDownloadProgress(progressListener);

    // Download the update
    await window.electron.downloadUpdate();

    // Bot ou démarrage silencieux : installer et redémarrer automatiquement
    if (App.isBot || silent) {
      await window.electron.installUpdate();
      window.electron.restartApp();
      return;
    }

    // App déjà en cours d'utilisation : demander confirmation
    $q.dialog({
      title: "Mise à jour disponible",
      message:
        "La mise à jour a été téléchargée. Voulez-vous l'installer maintenant ? L'application va redémarrer.",
      ok: "Installer",
      cancel: "Plus tard",
    }).onOk(async () => {
      await window.electron.installUpdate();
      window.electron.restartApp();
    });
  } catch (error) {
    console.error("Update error:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la mise à jour",
      caption: error.message || "Une erreur est survenue",
      timeout: 10000,
      actions: [
        {
          label: "Détails",
          color: "white",
          handler: () => {
            console.error("Full error:", error);
          },
        },
      ],
    });
  } finally {
    updating.value = false;
    if (progressNotif) {
      progressNotif();
    }
  }
};

// Setup listeners for update notifications from main process
const setupUpdateListeners = () => {
  window.electron.onUpdateAvailable((result) => {
    currentVersion.value = result.currentVersion;
    latestVersion.value = result.latestVersion;
    updateAvailable.value = result.updateAvailable;
  });
};

onMounted(() => {
  setupUpdateListeners();
  // Delay initial check to ensure handlers are registered
  // autoInstall=true : si une update est dispo au démarrage, l'installer silencieusement
  setTimeout(() => {
    checkForUpdates(true);
  }, 1000);
});

onBeforeUnmount(() => {
  window.electron.removeUpdateListener();
});
</script>
