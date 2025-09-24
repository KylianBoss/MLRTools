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
              :disable="App.userHasAccess('create-custom-chart') === false"
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
          <q-td class="text-center">{{ JSON.parse(props.row.alarms).length }}</q-td>
        </q-tr>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props" align="center">
          <q-btn
            v-if="props.row.id === 0"
            color="primary"
            label="Ajouter"
            icon="mdi-plus"
            @click="$router.push({ name: 'create-custom-chart' })"
          />
          <q-btn
            v-else
            color="primary"
            label="Voir"
            icon="mdi-eye"
            @click="
              $router.push({
                name: 'view-custom-chart',
                params: { id: props.row.id },
              })
            "
          />
        </q-td>
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
    name: "actions",
    align: "center",
    label: "Actions",
    field: "actions",
  },
];

const createChart = async () => {
  if (App.userHasAccess("create-custom-chart") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de créer un graphique.",
    });
    return;
  }
  const chartData = await askForChart();
  if (chartData) {
    const data = {
      chartName: chartData.name,
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

onMounted(async () => {
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
});
</script>
