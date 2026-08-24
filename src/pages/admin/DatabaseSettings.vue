<template>
  <q-page padding>
    <div class="text-h4">Database</div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Synchroniser les modèles"
          color="primary"
          @click="DB.syncModels"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Exporter la base de données (.sql)"
          color="primary"
          @click="exportDatabase"
          class="full-width"
          :loading="exporting"
        />
      </div>
    </div>

    <!-- Export progress dialog -->
    <q-dialog v-model="exportDialogOpen" persistent>
      <q-card style="min-width: 420px">
        <q-card-section>
          <div class="text-h6">Export de la base de données</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="text-caption text-grey-7 q-mb-xs">
            {{ exportProgress.statusText }}
          </div>

          <div class="text-caption q-mb-xs">
            Tables : {{ exportProgress.tableIndex }} / {{ exportProgress.tableCount || "?" }}
          </div>
          <q-linear-progress
            :value="exportProgress.tablesRatio"
            color="primary"
            size="10px"
            class="q-mb-md"
            rounded
          />

          <div class="text-caption q-mb-xs">
            Table en cours ({{ exportProgress.tableName || "..." }}) :
            {{ exportProgress.rowsDoneInTable.toLocaleString() }} /
            {{ exportProgress.rowsTotalInTable.toLocaleString() }} lignes
          </div>
          <q-linear-progress
            :value="exportProgress.tableRatio"
            color="secondary"
            size="10px"
            class="q-mb-md"
            rounded
          />

          <div class="text-caption text-grey-7">
            Temps écoulé : {{ exportProgress.elapsedLabel }}
            <span v-if="exportProgress.etaLabel">
              — Temps restant estimé : {{ exportProgress.etaLabel }}
            </span>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            v-if="exportProgress.done || exportProgress.error"
            flat
            label="Fermer"
            @click="exportDialogOpen = false"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Vider la table day resume"
          color="primary"
          @click="DB.emptyDayResume"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Vider la table day resume à date précise"
          color="primary"
          @click="selectDateToEmpty"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander au bot d'extraire le WMS pour une date"
          color="primary"
          @click="askExtractWMS"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander au bot d'extraire le nombre de trays pour une date"
          color="primary"
          @click="askExtractTrayAmount"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander au bot d'extraire les données SAV pour une date"
          color="primary"
          @click="askExtractSAV"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander aux bots de redémarrer"
          color="primary"
          @click="askBotToRestart"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Extraire le nombre de trays pour une date"
          color="primary"
          @click="extractTrayAmount"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Internal route to charts"
          color="primary"
          @click="routeToCharts"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Maximise"
          color="primary"
          @click="maximise"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Fullscreen"
          color="primary"
          @click="fullscreen"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
  </q-page>
</template>

<script setup>
import { ref, computed } from "vue";
import { useDBStore } from "stores/db";
import { useAppStore } from "stores/app";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const DB = useDBStore();
const App = useAppStore();
const $q = useQuasar();

const exporting = ref(false);
const exportDialogOpen = ref(false);

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  }
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}min ${String(seconds).padStart(2, "0")}s`;
};

const defaultExportProgress = () => ({
  tableIndex: 0,
  tableCount: 0,
  tableName: "",
  rowsDoneInTable: 0,
  rowsTotalInTable: 0,
  rowsDoneTotal: 0,
  rowsTotal: 0,
  elapsedMs: 0,
  statusText: "Préparation de l'export...",
  done: false,
  error: null,
});

const exportProgressState = ref(defaultExportProgress());

// Vue calculée consommée par le template : ajoute les ratios de progression
// et les libellés de durée/ETA à partir de l'état brut reçu par SSE.
const exportProgress = computed(() => {
  const p = exportProgressState.value;

  const tablesRatio = p.tableCount
    ? Math.min(
        1,
        (p.tableIndex +
          (p.rowsTotalInTable ? p.rowsDoneInTable / p.rowsTotalInTable : 0)) /
          p.tableCount
      )
    : 0;
  const tableRatio = p.rowsTotalInTable
    ? Math.min(1, p.rowsDoneInTable / p.rowsTotalInTable)
    : 0;

  let etaLabel = null;
  if (!p.done && !p.error && p.rowsTotal && p.rowsDoneTotal) {
    const msPerRow = p.elapsedMs / p.rowsDoneTotal;
    etaLabel = formatDuration(msPerRow * (p.rowsTotal - p.rowsDoneTotal));
  }

  return {
    ...p,
    tablesRatio,
    tableRatio,
    elapsedLabel: formatDuration(p.elapsedMs),
    etaLabel,
  };
});

const applyExportEvent = (event) => {
  const p = exportProgressState.value;
  p.elapsedMs = event.elapsedMs ?? p.elapsedMs;
  p.tableCount = event.tableCount ?? p.tableCount;
  if (event.tableIndex !== undefined) p.tableIndex = event.tableIndex;
  if (event.tableName !== undefined) p.tableName = event.tableName;
  if (event.rowsDoneInTable !== undefined) p.rowsDoneInTable = event.rowsDoneInTable;
  if (event.rowsTotalInTable !== undefined) p.rowsTotalInTable = event.rowsTotalInTable;
  if (event.rowsDoneTotal !== undefined) p.rowsDoneTotal = event.rowsDoneTotal;
  if (event.rowsTotal !== undefined) p.rowsTotal = event.rowsTotal;

  switch (event.phase) {
    case "counting":
      p.statusText = "Analyse des tables (comptage des lignes)...";
      break;
    case "table-start":
      p.statusText = `Export de la table "${event.tableName}"...`;
      break;
    case "table-progress":
      p.statusText = `Export de la table "${event.tableName}"...`;
      break;
    case "table-done":
      p.statusText = `Table "${event.tableName}" terminée.`;
      break;
    case "done":
      p.statusText = "Export terminé, téléchargement...";
      p.tableIndex = p.tableCount;
      p.done = true;
      break;
    case "error":
      p.statusText = "Erreur pendant l'export.";
      p.error = event.error;
      break;
  }
};

const downloadExportedFile = async (exportId) => {
  const response = await api.get(`/db/export/download/${exportId}`, {
    params: { user: App.user.username },
    responseType: "blob",
    timeout: 5 * 60 * 1000,
  });

  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const fileName = match ? match[1] : `export_${Date.now()}.sql`;

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const exportDatabase = async () => {
  exporting.value = true;
  exportProgressState.value = defaultExportProgress();
  exportDialogOpen.value = true;

  const exportId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Ouvre le flux SSE avant de lancer l'export pour ne rater aucun événement
  const eventSource = new EventSource(
    `${api.defaults.baseURL}/db/export/stream/${exportId}`
  );
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.phase && data.phase !== "connected") {
        applyExportEvent(data);
      }
    } catch {
      // ignore ping/keepalive frames non-JSON
    }
  };

  try {
    await api.post("/db/export", {
      user: App.user.username,
      exportId,
    });

    // Attend que le serveur signale la fin (phase "done" ou "error") via SSE
    await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (exportProgressState.value.done) {
          clearInterval(check);
          resolve();
        } else if (exportProgressState.value.error) {
          clearInterval(check);
          reject(new Error(exportProgressState.value.error));
        }
      }, 300);
    });

    await downloadExportedFile(exportId);

    $q.notify({
      type: "positive",
      message: "Export de la base de données terminé",
    });
  } catch (error) {
    console.error("Error exporting database:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'export de la base de données",
      caption: error.response?.data?.error || error.message,
    });
  } finally {
    eventSource.close();
    exporting.value = false;
  }
};

const selectDateToEmpty = () => {
  $q.dialog({
    title: "Vider la table day resume à date précise",
    message: "Saisir la date à laquelle vider la table",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    persistent: true,
  }).onOk((data) => {
    DB.emptyDayResumeAtDate(data);
  });
};

// const extractTrayAmount = () => {
//   $q.dialog({
//     title: "Extraire le nombre de trays",
//     message: "Saisir la date pour l'extraction",
//     prompt: {
//       label: "Date",
//       type: "date",
//       mask: "##.##.####",
//       model: null,
//     },
//     cancel: true,
//     persistent: true,
//   }).onOk((data) => {
//     const date = data;
//     api
//       .get(`/extract/${date}`)
//       .then((response) => {
//         if (response.data.success) {
//           $q.notify({
//             type: "positive",
//             message: `Extraction réussie pour la date ${date}`,
//           });
//         } else {
//           $q.notify({
//             type: "negative",
//             message: "Erreur lors de l'extraction des trays",
//           });
//         }
//       })
//       .catch((error) => {
//         $q.notify({
//           type: "negative",
//           message: `Erreur: ${error.message}`,
//         });
//       });
//   });
// };

const askExtractTrayAmount = () => {
  $q.dialog({
    title: "Demander au bot d'extraire le nombre de trays",
    message: "Saisir la date pour l'extraction",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    cancel: true,
    persistent: true,
  }).onOk((data) => {
    const date = data;
    api
      .post(`/bot/ask/extract`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire les trays le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askExtractWMS = () => {
  $q.dialog({
    title: "Demander au bot d'extraire le WMS",
    message: "Saisir la date pour l'extraction",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    cancel: true,
    persistent: true,
  }).onOk((data) => {
    const date = data;
    api
      .post(`/bot/ask/extractWMS`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire le WMS pour le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askExtractSAV = () => {
  $q.dialog({
    title: "Demander au bot d'extraire les données SAV",
    message: "Saisir la date pour l'extraction",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    cancel: true,
    persistent: true,
  }).onOk((data) => {
    const date = data;
    api
      .post(`/bot/ask/extractSAV`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire les données SAV pour le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askBotToRestart = () => {
  $q.dialog({
    title: "Demander aux bots de redémarrer",
    message: "Êtes-vous sûr de vouloir redémarrer tous les bots ?",
    cancel: true,
    persistent: true,
  }).onOk(() => {
    api
      .post(`/bot/ask/restart`)
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Les bots ont été notifiés pour redémarrer`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const routeToCharts = () => {
  api
    .get(`/cron/test`)
    .then((response) => {
      $q.notify({
        type: "positive",
        message: `Commande de routage envoyée au frontend`,
      });
    })
    .catch((error) => {
      $q.notify({
        type: "negative",
        message: `Erreur: ${error.message}`,
      });
    });
};

const maximise = () => {
  window.electron.maximizeApp();
};

const fullscreen = () => {
  window.electron.toggleFullscreenApp();
};
</script>

<style></style>
