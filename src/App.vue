<template>
  <router-view />
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useQuasar } from "quasar";
import { useAppStore } from "stores/app";
import { useRouter } from "vue-router";

defineOptions({
  name: "App",
});

const $q = useQuasar();
const App = useAppStore();
const router = useRouter();

// Gestion de la notification persistante du timer
const timerNotification = ref(null);
const timerInterval = ref(null);
const elapsedSeconds = ref(0);

const displayTime = computed(() => {
  const hours = Math.floor(elapsedSeconds.value / 3600);
  const minutes = Math.floor((elapsedSeconds.value % 3600) / 60);
  const seconds = elapsedSeconds.value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
});

const showTimerNotification = () => {
  if (timerNotification.value) {
    timerNotification.value();
  }

  timerNotification.value = $q.notify({
    type: "ongoing",
    message: "Intervention en cours",
    caption: `Temps écoulé: ${displayTime.value}`,
    icon: "timer",
    color: "grey-8",
    textColor: "white",
    timeout: 0,
    position: "top-right",
    actions: [
      {
        label: "Voir",
        color: "white",
        handler: () => {
          router.push({ name: "intervention-journal" });
        },
      },
    ],
  });
};

const updateTimerNotification = () => {
  if (timerNotification.value && App.interventionTimer.running) {
    try {
      timerNotification.value({
        caption: `Temps écoulé: ${displayTime.value}`,
      });
    } catch (error) {
      // La notification n'existe plus
      timerNotification.value = null;
    }
  }
};

const hideTimerNotification = () => {
  if (timerNotification.value) {
    timerNotification.value();
    timerNotification.value = null;
  }
};

const updateElapsedTime = () => {
  if (App.interventionTimer.running && App.interventionTimer.startDate) {
    const startDate = new Date(App.interventionTimer.startDate);
    elapsedSeconds.value = Math.floor((new Date() - startDate) / 1000);
  }
};

// Vérifier si on est sur la page du journal
const isOnJournalPage = computed(() => {
  return router.currentRoute.value.name === "intervention-journal";
});

// Gérer l'affichage de la notification en fonction de la route
const manageNotificationVisibility = () => {
  if (App.interventionTimer.running) {
    if (isOnJournalPage.value) {
      // On est sur la page du journal, masquer la notification
      hideTimerNotification();
    } else {
      // On n'est pas sur la page du journal, afficher la notification
      if (!timerNotification.value) {
        showTimerNotification();
      }
    }
  }
};

// Watcher sur la route pour masquer/afficher la notification
watch(
  () => router.currentRoute.value.name,
  () => {
    manageNotificationVisibility();
  }
);

// Watcher sur l'état du timer dans le store
watch(
  () => App.interventionTimer.running,
  (isRunning) => {
    if (isRunning) {
      // Démarrer l'interval
      updateElapsedTime();

      if (timerInterval.value) {
        clearInterval(timerInterval.value);
      }

      timerInterval.value = setInterval(() => {
        updateElapsedTime();
        updateTimerNotification();
      }, 1000);

      // Gérer l'affichage de la notification selon la page
      manageNotificationVisibility();
    } else {
      // Arrêter l'interval et masquer la notification
      if (timerInterval.value) {
        clearInterval(timerInterval.value);
        timerInterval.value = null;
      }
      hideTimerNotification();
      elapsedSeconds.value = 0;
    }
  },
  { immediate: true }
);

onMounted(() => {
  // Restaurer le timer au démarrage si nécessaire
  App.restoreInterventionTimer();
});

onBeforeUnmount(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }
});
</script>
