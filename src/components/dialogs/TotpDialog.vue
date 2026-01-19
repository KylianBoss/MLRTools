<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Vérification 2FA</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <p class="text-body2 q-mb-md">
          Cette action nécessite une vérification 2FA. Entrez le code à 6
          chiffres de votre application Google Authenticator.
        </p>

        <div class="row q-gutter-sm justify-center">
          <q-input
            v-for="i in 6"
            :key="i"
            v-model="digits[i - 1]"
            :ref="(el) => (inputRefs[i - 1] = el)"
            outlined
            dense
            maxlength="1"
            input-class="text-center text-h5"
            style="width: 50px"
            @update:model-value="(val) => onInput(i - 1, val)"
            @keydown="(e) => onKeyDown(i - 1, e)"
            :error="hasError"
            :autofocus="i === 1"
          />
        </div>

        <div v-if="errorMessage" class="text-negative text-center q-mt-sm">
          {{ errorMessage }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" color="primary" @click="cancel" />
        <q-btn
          label="Vérifier"
          color="primary"
          @click="verify"
          :disable="!isComplete"
          :loading="loading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";

const show = ref(false);
const digits = ref(["", "", "", "", "", ""]);
const inputRefs = ref([]);
const hasError = ref(false);
const errorMessage = ref("");
const loading = ref(false);
let resolvePromise = null;
let rejectPromise = null;

const isComplete = computed(() => digits.value.every((d) => d !== ""));

const code = computed(() => digits.value.join(""));

// Reset on error
watch(hasError, (val) => {
  if (val) {
    setTimeout(() => {
      hasError.value = false;
    }, 2000);
  }
});

// Ouvrir le dialog et retourner une Promise
const open = () => {
  show.value = true;
  digits.value = ["", "", "", "", "", ""];
  errorMessage.value = "";
  hasError.value = false;
  loading.value = false;

  // Focus le premier input
  nextTick(() => {
    if (inputRefs.value[0]) {
      inputRefs.value[0].focus();
    }
  });

  return new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
};

// Gérer l'input
const onInput = (index, value) => {
  // Ne garder que les chiffres
  const digit = value.replace(/\D/g, "").slice(-1);
  digits.value[index] = digit;

  // Auto-focus sur le prochain input
  if (digit && index < 5) {
    nextTick(() => {
      if (inputRefs.value[index + 1]) {
        inputRefs.value[index + 1].focus();
      }
    });
  }
};

// Gérer les touches clavier
const onKeyDown = (index, event) => {
  if (event.key === "Backspace" && !digits.value[index] && index > 0) {
    // Si backspace sur input vide, revenir au précédent
    nextTick(() => {
      if (inputRefs.value[index - 1]) {
        inputRefs.value[index - 1].focus();
      }
    });
  } else if (event.key === "ArrowLeft" && index > 0) {
    nextTick(() => {
      if (inputRefs.value[index - 1]) {
        inputRefs.value[index - 1].focus();
      }
    });
  } else if (event.key === "ArrowRight" && index < 5) {
    nextTick(() => {
      if (inputRefs.value[index + 1]) {
        inputRefs.value[index + 1].focus();
      }
    });
  } else if (event.key === "Enter" && isComplete.value) {
    verify();
  }
};

// Vérifier le code
const verify = () => {
  if (!isComplete.value) return;

  loading.value = true;

  // Retourner le code via la Promise
  if (resolvePromise) {
    resolvePromise(code.value);
    show.value = false;
  }
};

// Annuler
const cancel = () => {
  if (rejectPromise) {
    rejectPromise(new Error("Cancelled"));
  }
  show.value = false;
};

// Afficher une erreur
const showError = (message) => {
  errorMessage.value = message;
  hasError.value = true;
  loading.value = false;

  // Clear les inputs et focus le premier
  digits.value = ["", "", "", "", "", ""];
  nextTick(() => {
    if (inputRefs.value[0]) {
      inputRefs.value[0].focus();
    }
  });
};

// Exposer les méthodes
defineExpose({
  open,
  showError,
});
</script>

<style scoped>
.q-input :deep(.q-field__control) {
  height: 60px;
}

.q-input :deep(input) {
  font-family: "Courier New", monospace;
  font-weight: bold;
}
</style>
