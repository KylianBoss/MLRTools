<template>
  <q-page padding>
    <!-- Create an input to import a txt file -->
    <q-card class="q-mb-md">
      <q-card-section class="q-pa-md">
        <q-btn
          color="primary"
          label="Select File"
          @click="triggerFileInput"
          class="full-width q-mb-md"
          v-if="!selectedFilePath && !importing"
          :loading="loading"
        />
        <q-file
          v-model="selectedFilePath"
          type="file"
          accept=".csv"
          multiple
          style="display: none"
          ref="fileInput"
          :loading="loading"
        />
        <q-btn
          v-if="selectedFilePath && !importing"
          color="secondary"
          label="Import"
          @click="importFile"
          class="full-width"
          :loading="loading"
        />
      </q-card-section>
    </q-card>

    <!-- Console de log façon "installation" -->
    <q-card v-if="logLines.length > 0" class="install-log-card">
      <q-card-section class="row items-center q-pb-sm">
        <q-spinner-dots
          v-if="importing"
          color="primary"
          size="24px"
          class="q-mr-sm"
        />
        <q-icon
          v-else-if="lastStatus === 'success'"
          name="mdi-check-circle"
          color="positive"
          size="24px"
          class="q-mr-sm"
        />
        <q-icon
          v-else-if="lastStatus === 'error'"
          name="mdi-alert-circle"
          color="negative"
          size="24px"
          class="q-mr-sm"
        />
        <div class="text-subtitle1">
          {{ importing ? "Importation en cours..." : "Importation terminée" }}
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="install-log-console" ref="logContainer">
        <div
          v-for="(line, index) in logLines"
          :key="index"
          class="install-log-line"
          :class="`text-${line.level === 'error' ? 'negative' : line.level === 'success' ? 'positive' : 'grey-4'}`"
        >
          <span class="text-grey-6">[{{ line.time }}]</span>
          {{ line.message }}
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const $q = useQuasar();
const selectedFilePath = ref(null);
const fileInput = ref(null);
const loading = ref(false);
const importing = ref(false);
const logLines = ref([]);
const lastStatus = ref(null);
const logContainer = ref(null);

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.pickFiles();
  } else {
    console.error("File input reference is not set.");
    $q.notify({
      type: "negative",
      message: "File input reference is not set.",
    });
  }
};

const appendLog = (level, message) => {
  logLines.value.push({
    level,
    message,
    time: new Date().toLocaleTimeString(),
  });
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
};

const importFile = async () => {
  if (!selectedFilePath.value) return;

  for (const file of selectedFilePath.value) {
    loading.value = true;
    importing.value = true;
    logLines.value = [];
    lastStatus.value = null;

    const fileType = file.name.split(".").pop().toLowerCase();
    if (fileType !== "csv") {
      appendLog("error", `Type de fichier non supporté : ${fileType}`);
      $q.notify({
        type: "negative",
        message: "Unsupported file type: " + fileType,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });
      loading.value = false;
      importing.value = false;
      continue;
    }

    const importId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    appendLog("info", `Fichier sélectionné : ${file.name}`);

    // Ouvre le flux SSE avant de lancer l'import pour ne rater aucun log
    const eventSource = new EventSource(
      `${api.defaults.baseURL}/alarms/import-alarms/stream/${importId}`
    );
    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        appendLog(entry.level, entry.message);
        lastStatus.value = entry.level;
      } catch {
        // ignore ping/keepalive frames non-JSON
      }
    };
    eventSource.onerror = () => {
      // La connexion se fermera naturellement quand le serveur clôturera le flux
    };

    try {
      appendLog("info", "Lecture du fichier local...");
      const fileReader = new FileReader();
      const fileContent = await new Promise((resolve, reject) => {
        fileReader.onload = (event) => resolve(event.target.result);
        fileReader.onerror = (error) => reject(error);
        fileReader.readAsText(file);
      });

      const response = await api.post("alarms/import-alarms", {
        data: fileContent,
        importId,
      });

      $q.notify({
        type: "positive",
        message: `File : ${file.name} imported successfully`,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });
      $q.notify({
        type: "positive",
        message: `Importation de ${response.data.recieved} alarmes, ${response.data.inserted} nouvelles alarmes insérées dans la base de donnée.`,
        actions: [{ icon: "close", color: "white" }],
        position: "top",
        timeout: 10000,
      });
      lastStatus.value = "success";
    } catch (error) {
      console.error("Error importing file:", error);
      const message =
        error.response?.data?.error || error.message || "Erreur inconnue";
      appendLog("error", `Échec de l'importation : ${message}`);
      lastStatus.value = "error";
      $q.notify({
        type: "negative",
        message: "Error importing file: " + message,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });
    } finally {
      eventSource.close();
      loading.value = false;
      importing.value = false;
    }
  }
  selectedFilePath.value = null;
};
</script>

<style scoped>
.install-log-card {
  background: #1e1e1e;
}
.install-log-console {
  max-height: 320px;
  overflow-y: auto;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 12px;
  background: #1e1e1e;
}
.install-log-line {
  padding: 2px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
