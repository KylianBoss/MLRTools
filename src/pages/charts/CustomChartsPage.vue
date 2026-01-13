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
          :class="props.row.id === 0 ? 'bg-grey-2' : ''"
        >
          <q-td>{{ props.row.chartName }}</q-td>
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
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
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
    name: "actions",
    align: "center",
    label: "Actions",
    field: "actions",
  },
];

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

const fetchCustomCharts = async () => {
  try {
    const response = await api.get("/charts/custom-charts");
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
