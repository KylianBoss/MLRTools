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

const checkForUpdates = async () => {
  try {
    const result = await window.electron.checkForUpdates();
    currentVersion.value = result.currentVersion;
    latestVersion.value = result.latestVersion;
    updateAvailable.value = result.updateAvailable;
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
};

watch(updateAvailable, (newVal) => {
  if (newVal && App.isBot) {
    handleUpdate();
  }
});

const handleUpdate = async () => {
  try {
    updating.value = true;

    // Download the update
    await window.electron.downloadUpdate();

    // Update if is a bot
    if (App.isBot) {
      await window.electron.installUpdate();
      window.electron.restartApp();
      return;
    }

    // Confirm with user before installing
    $q.dialog({
      title: "Install Update",
      message:
        "The update has been downloaded. Would you like to install it now? The application will restart.",
      ok: "Install",
      cancel: "Later",
    }).onOk(async () => {
      // Install the update
      await window.electron.installUpdate();

      // Restart the app
      window.electron.restartApp();
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Failed to update application",
      caption: error.message,
    });
  } finally {
    updating.value = false;
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
  checkForUpdates();
  setupUpdateListeners();
});

onBeforeUnmount(() => {
  window.electron.removeUpdateListener();
});
</script>
