<template>
  <q-page padding>
    <div class="text-h4">Rapports de maintenance</div>
    <div class="row">
      <div class="col">
        <q-table
          :rows="maintenanceReports"
          :columns="columns"
          row-key="id"
          class="q-pa-md"
          flat
          bordered
          dense
          :filter="filter"
          :loading="!maintenanceReports.length"
          @row-click="goToReportDetails"
        >
          <template v-slot:top>
            <q-input
              v-model="filter"
              placeholder="Rechercher..."
              class="q-mb-md"
              dense
              outlined
              debounce="300"
            />
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useAppStore } from "stores/app";
import { api } from "boot/axios";
import { useRouter } from "vue-router";

const App = useAppStore();
const router = useRouter();
const maintenanceReports = ref([]);
const filter = ref("");
const columns = [
  {
    name: "description",
    label: "Description",
    field: (row) => `${row.plan.location} - ${row.plan.description}`,
    align: "left",
  },
  { name: "type", label: "Type", field: (row) => row.plan.type, align: "left" },
  {
    name: "performedBy",
    label: "Effectué par",
    field: (row) => row.performedBy.fullname,
    align: "left",
  },
  {
    name: "startTime",
    label: "Début",
    field: (row) => new Date(row.startTime).toLocaleString(),
    align: "left",
  },
  {
    name: "endTime",
    label: "Fin",
    field: (row) => new Date(row.endTime).toLocaleString(),
    align: "left",
  },
  {
    name: "duration",
    label: "Durée (min)",
    field: (row) => Math.round(row.duration / 60),
    align: "left",
  },
];

const goToReportDetails = (evt, row) => {
  router.push({
    name: "maintenance-report-details",
    params: { reportId: row.id },
  });
};

onMounted(async () => {
  try {
    const response = await api.get("/maintenance/reports");
    maintenanceReports.value = response.data;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des rapports de maintenance :",
      error
    );
  }
});
</script>

<style></style>
