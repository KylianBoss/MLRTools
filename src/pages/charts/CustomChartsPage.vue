<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Graphiques personalisés</div>
    <q-table
      :rows="rows"
      :columns="columns"
      row-key="id"
      :loading="false"
      virtual-scroll
      :rows-per-page-options="[10, 20, 50]"
    >
      <template v-slot:no-data>
        <div class="text-center full-width q-pa-md">
          <div class="text-h6 text-grey-4 q-mt-md">
            Aucun graphique personnalisé n'a encore été créé.
          </div>
        </div>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props" v-if="props.row.id === 0">
          <q-td colspan="100%">
            <q-btn
              color="primary"
              label="Ajouter un nouveau graphique"
              icon="mdi-plus"
              @click="createChart()"
              class="full-width"
              :disable="App.userHasAccess('canCreateCustomCharts') === false"
            />
          </q-td>
        </q-tr>
        <q-tr
          :props="props"
          v-else
          :class="[
            props.row.id === 0 ? 'bg-grey-2' : '',
            'chart-row',
            props.row.visible === false ? 'text-grey-5' : '',
          ]"
        >
          <q-td>
            {{ props.row.chartName }}
            <q-badge
              v-if="props.row.visible === false"
              color="grey-6"
              label="Masqué"
              class="q-ml-sm"
            />
          </q-td>
          <q-td>{{ props.row.createdByName }}</q-td>
          <q-td class="text-center">
            {{ JSON.parse(props.row.alarms).length }}
          </q-td>
          <q-td class="text-center">
            {{
              props.row.targets && props.row.targets.length > 0
                ? props.row.targets[props.row.targets.length - 1].value
                : 'N/A'
            }}
          </q-td>
          <q-td class="text-center">
            {{ formatDate(props.row.updatedAt) }}
          </q-td>
          <q-td class="text-center row-actions">
            <q-btn
              :icon="props.row.visible === false ? 'mdi-eye-off' : 'mdi-eye'"
              :color="props.row.visible === false ? 'grey' : 'secondary'"
              dense
              flat
              @click="toggleVisibility(props.row)"
              :disable="App.userHasAccess('canUpdateCustomCharts') === false"
            >
              <q-tooltip>
                {{
                  props.row.visible === false
                    ? "Afficher ce graphique sur le dashboard"
                    : "Masquer ce graphique du dashboard"
                }}
              </q-tooltip>
            </q-btn>
            <q-btn
              icon="mdi-refresh"
              color="secondary"
              dense
              flat
              @click="recalculateChart(props.row)"
              :loading="recalculatingChartId === props.row.id"
              :disable="App.userHasAccess('canUpdateCustomCharts') === false"
            >
              <q-tooltip>Régénérer les données du cache</q-tooltip>
            </q-btn>
            <q-btn
              icon="mdi-pencil"
              color="primary"
              dense
              flat
              @click="updateChart(props.row)"
              :disable="App.userHasAccess('canUpdateCustomCharts') === false"
            />
            <q-btn
              icon="mdi-delete"
              color="negative"
              dense
              flat
              @click="deleteChart(props.row)"
              :disable="App.userHasAccess('canDeleteCustomCharts') === false"
            />
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Dialog de progression de la régénération du cache -->
    <q-dialog v-model="recalcDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Régénération des données</div>
          <div class="text-caption text-grey-7">
            {{ recalcChartName }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-linear-progress
            size="20px"
            :value="recalcPercent / 100"
            color="primary"
            stripe
            rounded
          >
            <div class="absolute-full flex flex-center">
              <q-badge color="white" text-color="primary" :label="`${recalcPercent}%`" />
            </div>
          </q-linear-progress>

          <div class="row justify-between q-mt-sm text-caption text-grey-8">
            <div>
              {{ recalcProcessedDays }} / {{ recalcTotalDays }} jours traités
            </div>
            <div v-if="recalcEtaLabel">
              Temps restant estimé : {{ recalcEtaLabel }}
            </div>
          </div>

          <div v-if="recalcCurrentDate" class="text-caption text-grey-7 q-mt-xs">
            Jour en cours : {{ recalcCurrentDate }}
          </div>

          <div v-if="recalcDone" class="text-positive text-center q-mt-md">
            <q-icon name="mdi-check-circle" size="sm" /> Régénération terminée
          </div>
          <div v-if="recalcError" class="text-negative text-center q-mt-md">
            <q-icon name="mdi-alert-circle" size="sm" /> {{ recalcError }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            label="Fermer"
            color="primary"
            :disable="!recalcDone && !recalcError"
            @click="closeRecalcDialog"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar, date as qdate } from "quasar";
import { useAppStore } from "src/stores/app";
import { api } from "boot/axios";
import { useChartDialog } from "src/plugins/useChartDialog";

const $q = useQuasar();
const App = useAppStore();
const { askForChart } = useChartDialog();

const rows = ref([]);
const columns = [
  {
    name: "name",
    required: true,
    label: "Nom",
    align: "left",
    field: (row) => row.name,
    format: (val) => `${val}`,
    sortable: true,
  },
  {
    name: "creator",
    align: "left",
    label: "Créateur",
    field: (row) => row.createbBy,
    format: (val) => `${val}`,
    sortable: true,
  },
  {
    name: "alarmCount",
    align: "center",
    label: "Nombre d'alarmes",
    field: (row) => row.alarmCount,
    format: (val) => `${val}`,
    sortable: true,
  },
  {
    name: "target",
    align: "center",
    label: "Target",
    field: (row) => row.targets[row.targets.length - 1].value,
    format: (val) => (val !== null ? `${val}` : 'N/A'),
    sortable: true,
  },
  {
    name: "updatedAt",
    align: "center",
    label: "Dernière modification",
    field: (row) => row.updatedAt,
    format: (val) => formatDate(val),
    sortable: true,
  },
  {
    name: "actions",
    align: "center",
    label: "Actions",
    field: "actions",
  },
];

const formatDate = (val) => {
  if (!val) return "N/A";
  return qdate.formatDate(val, "DD/MM/YYYY HH:mm");
};

const createChart = async () => {
  if (App.userHasAccess("canCreateCustomCharts") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de créer un graphique.",
    });
    return;
  }
  const chartData = await askForChart();
  if (chartData) {
    const data = {
      chartName: chartData.chartName,
      alarms: chartData.alarms,
      createdBy: App.user.id,
    };
    try {
      const response = await api.post("/charts/custom-charts", data);
      $q.notify({
        type: "positive",
        message: "Graphique créé avec succès.",
      });
      rows.value.push({
        id: response.data.id,
        name: response.data.name,
        createbBy: response.data.createdBy,
        alarmCount: response.data.alarmCount,
      });
    } catch (error) {
      $q.notify({
        type: "negative",
        message: "Erreur lors de la création du graphique.",
      });
    }
  }
};

const updateChart = async (chart) => {
  if (App.userHasAccess("canUpdateCustomCharts") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de modifier un graphique.",
    });
    return;
  }

  const chartData = await askForChart({
    ...chart,
    alarms: JSON.parse(chart.alarms),
  });
  if (chartData) {
    const data = {
      id: chart.id,
      chartName: chartData.chartName,
      alarms: chartData.alarms,
      newTarget: chartData.newTarget,
      setBy: App.user.id,
    };

    try {
      await api.put(`/charts/custom-charts/${chart.id}`, data);
      $q.notify({
        type: "positive",
        message: "Graphique mis à jour avec succès.",
      });
      await fetchCustomCharts();
    } catch (error) {
      $q.notify({
        type: "negative",
        message: "Erreur lors de la mise à jour du graphique.",
      });
    }
  }
};

const deleteChart = async (chart) => {
  if (App.userHasAccess("canDeleteCustomCharts") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de supprimer un graphique.",
    });
    return;
  }

  const confirm = await $q
    .dialog({
      title: "Confirmer la suppression",
      message: `Êtes-vous sûr de vouloir supprimer le graphique "${chart.name}" ?`,
      cancel: true,
      persistent: true,
    })
    .onOk(async () => {
      try {
        await api.delete(`/charts/custom-charts/${chart.id}`);
        $q.notify({
          type: "positive",
          message: "Graphique supprimé avec succès.",
        });
        rows.value = rows.value.filter((c) => c.id !== chart.id);
      } catch (error) {
        $q.notify({
          type: "negative",
          message: "Erreur lors de la suppression du graphique.",
        });
      }
    })
    .onCancel(() => false)
    .onDismiss(() => false);
};

// --- Régénération des données du cache d'un graphique ---
const recalculatingChartId = ref(null);
const recalcDialog = ref(false);
const recalcChartName = ref("");
const recalcPercent = ref(0);
const recalcProcessedDays = ref(0);
const recalcTotalDays = ref(0);
const recalcCurrentDate = ref("");
const recalcEtaLabel = ref("");
const recalcDone = ref(false);
const recalcError = ref("");
let recalcEventSource = null;

const formatEta = (etaMs) => {
  if (etaMs === null || etaMs === undefined) return "";
  const totalSeconds = Math.round(etaMs / 1000);
  if (totalSeconds <= 1) return "moins d'une seconde";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
};

const closeRecalcDialog = () => {
  recalcDialog.value = false;
  if (recalcEventSource) {
    recalcEventSource.close();
    recalcEventSource = null;
  }
};

const recalculateChart = async (chart) => {
  if (App.userHasAccess("canUpdateCustomCharts") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de régénérer ce graphique.",
    });
    return;
  }

  const confirm = await new Promise((resolve) => {
    $q.dialog({
      title: "Régénérer les données",
      message: `Cela va supprimer puis recalculer tout l'historique du cache pour "${chart.chartName}". Cette opération peut prendre du temps. Continuer ?`,
      cancel: true,
      persistent: true,
    })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
      .onDismiss(() => resolve(false));
  });
  if (!confirm) return;

  recalculatingChartId.value = chart.id;
  recalcChartName.value = chart.chartName;
  recalcPercent.value = 0;
  recalcProcessedDays.value = 0;
  recalcTotalDays.value = 0;
  recalcCurrentDate.value = "";
  recalcEtaLabel.value = "";
  recalcDone.value = false;
  recalcError.value = "";
  recalcDialog.value = true;

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Ouvre le flux SSE avant de lancer le recalcul pour ne rater aucun évènement
  recalcEventSource = new EventSource(
    `${api.defaults.baseURL}/charts/custom-charts/${chart.id}/recalculate/stream/${jobId}`
  );
  recalcEventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "start") {
        recalcTotalDays.value = payload.totalDays;
      } else if (payload.type === "progress") {
        recalcProcessedDays.value = payload.processedDays;
        recalcTotalDays.value = payload.totalDays;
        recalcPercent.value = payload.percent;
        recalcCurrentDate.value = payload.date;
        recalcEtaLabel.value = formatEta(payload.etaMs);
      } else if (payload.type === "done") {
        recalcPercent.value = 100;
        recalcProcessedDays.value = payload.processedDays;
        recalcDone.value = true;
        recalcEtaLabel.value = "";
        recalculatingChartId.value = null;
        const row = rows.value.find((r) => r.id === chart.id);
        if (row && payload.updatedAt) row.updatedAt = payload.updatedAt;
        if (recalcEventSource) {
          recalcEventSource.close();
          recalcEventSource = null;
        }
      } else if (payload.type === "error") {
        recalcError.value = payload.message || "Erreur lors de la régénération.";
        recalculatingChartId.value = null;
        if (recalcEventSource) {
          recalcEventSource.close();
          recalcEventSource = null;
        }
      }
      // "day-error" : on continue le flux, l'erreur du jour est loguée côté serveur
    } catch {
      // ignore ping/keepalive frames non-JSON
    }
  };
  recalcEventSource.onerror = () => {
    // La connexion se fermera naturellement quand le serveur clôturera le flux
  };

  try {
    await api.post(`/charts/custom-charts/${chart.id}/recalculate`, { jobId });
  } catch (error) {
    recalcError.value = "Erreur lors du lancement de la régénération.";
    recalculatingChartId.value = null;
    if (recalcEventSource) {
      recalcEventSource.close();
      recalcEventSource = null;
    }
  }
};

const toggleVisibility = async (chart) => {
  if (App.userHasAccess("canUpdateCustomCharts") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de modifier un graphique.",
    });
    return;
  }

  const nextVisible = chart.visible === false;

  try {
    await api.patch(`/charts/custom-charts/${chart.id}/visibility`, {
      visible: nextVisible,
    });
    chart.visible = nextVisible;
    $q.notify({
      type: "positive",
      message: nextVisible
        ? "Graphique affiché sur le dashboard."
        : "Graphique masqué du dashboard.",
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors de la mise à jour de la visibilité.",
    });
  }
};

const fetchCustomCharts = async () => {
  try {
    const response = await api.get("/charts/custom-charts?includeHidden=true");
    rows.value = response.data;
    rows.value.push({
      id: 0,
      name: "Ajouter un nouveau graphique",
      createbBy: "",
      alarmCount: 0,
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des graphiques personnalisés",
    });
  }
};

onMounted(async () => {
  await fetchCustomCharts();
});
</script>

<style scoped>
.chart-row .row-actions {
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
}
.chart-row:hover .row-actions,
.chart-row:focus-within .row-actions {
  opacity: 1;
}
</style>
