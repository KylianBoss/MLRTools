<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Rapports KPI</div>
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
            Aucun rapport n'a encore été créé.
          </div>
        </div>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props" v-if="props.row.id === 0">
          <q-td colspan="100%">
            <q-btn
              color="primary"
              label="Ajouter un nouveau rapport"
              icon="mdi-plus"
              @click="createReport()"
              class="full-width"
              :disable="App.userHasAccess('canCreateReports') === false"
            />
          </q-td>
        </q-tr>
        <q-tr
          :props="props"
          v-else
          :class="[props.row.active === false ? 'text-grey-5' : '']"
        >
          <q-td>
            {{ props.row.name }}
            <q-badge
              v-if="props.row.active === false"
              color="grey-6"
              label="Désactivé"
              class="q-ml-sm"
            />
          </q-td>
          <q-td>{{ props.row.description }}</q-td>
          <q-td class="text-center">{{ props.row.blocksCount }}</q-td>
          <q-td class="text-center">{{ props.row.subscribersCount }}</q-td>
          <q-td class="text-center row-actions">
            <q-btn
              :icon="props.row.active === false ? 'mdi-eye-off' : 'mdi-eye'"
              :color="props.row.active === false ? 'grey' : 'secondary'"
              dense
              flat
              @click="toggleActive(props.row)"
              :disable="App.userHasAccess('canDeleteReports') === false"
            >
              <q-tooltip>
                {{
                  props.row.active === false
                    ? "Réactiver ce rapport"
                    : "Désactiver ce rapport (soft delete)"
                }}
              </q-tooltip>
            </q-btn>
            <q-btn
              icon="mdi-pencil"
              color="primary"
              dense
              flat
              @click="updateReport(props.row)"
              :disable="App.userHasAccess('canUpdateReports') === false"
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
import { useReportDialog } from "src/plugins/useReportDialog";

const $q = useQuasar();
const App = useAppStore();
const { askForReport } = useReportDialog();

const rows = ref([]);
const columns = [
  {
    name: "name",
    required: true,
    label: "Nom",
    align: "left",
    field: (row) => row.name,
    sortable: true,
  },
  {
    name: "description",
    align: "left",
    label: "Description",
    field: (row) => row.description,
  },
  {
    name: "blocksCount",
    align: "center",
    label: "Blocs",
    field: (row) => row.blocksCount,
    sortable: true,
  },
  {
    name: "subscribersCount",
    align: "center",
    label: "Abonnés",
    field: (row) => row.subscribersCount,
    sortable: true,
  },
  {
    name: "actions",
    align: "center",
    label: "Actions",
    field: "actions",
  },
];

const fetchReports = async () => {
  const response = await api.get("/reports");
  rows.value = [{ id: 0 }, ...response.data];
};

const createReport = async () => {
  if (App.userHasAccess("canCreateReports") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de créer un rapport.",
    });
    return;
  }
  const reportData = await askForReport();
  if (reportData) {
    try {
      const response = await api.post("/reports", {
        name: reportData.name,
        description: reportData.description,
      });
      if (reportData.blocks?.length > 0) {
        await api.put(`/reports/${response.data.id}/blocks`, {
          blocks: reportData.blocks,
        });
      }
      $q.notify({
        type: "positive",
        message: "Rapport créé avec succès.",
      });
      await fetchReports();
    } catch (error) {
      $q.notify({
        type: "negative",
        message: "Erreur lors de la création du rapport.",
      });
    }
  }
};

const updateReport = async (report) => {
  if (App.userHasAccess("canUpdateReports") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de modifier un rapport.",
    });
    return;
  }

  let detailResponse;
  try {
    detailResponse = await api.get(`/reports/${report.id}`);
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement du rapport.",
    });
    return;
  }

  const reportData = await askForReport({
    id: report.id,
    name: detailResponse.data.name,
    description: detailResponse.data.description,
    blocks: detailResponse.data.blocks || [],
  });

  if (reportData) {
    try {
      await api.put(`/reports/${report.id}`, {
        name: reportData.name,
        description: reportData.description,
      });
      await api.put(`/reports/${report.id}/blocks`, {
        blocks: reportData.blocks,
      });
      $q.notify({
        type: "positive",
        message: "Rapport mis à jour avec succès.",
      });
      await fetchReports();
    } catch (error) {
      $q.notify({
        type: "negative",
        message: "Erreur lors de la mise à jour du rapport.",
      });
    }
  }
};

// [D3] Soft delete uniquement : bascule active, aucune suppression physique
const toggleActive = async (report) => {
  if (App.userHasAccess("canDeleteReports") === false) {
    $q.notify({
      type: "negative",
      message: "Vous n'avez pas la permission de supprimer/désactiver un rapport.",
    });
    return;
  }

  const nextActive = report.active === false;

  try {
    await api.put(`/reports/${report.id}/active`, { active: nextActive });
    report.active = nextActive;
    $q.notify({
      type: "positive",
      message: nextActive
        ? "Rapport réactivé."
        : "Rapport désactivé (ne sera plus généré ni envoyé).",
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors de la mise à jour du rapport.",
    });
  }
};

onMounted(() => {
  fetchReports();
});
</script>

<style></style>
