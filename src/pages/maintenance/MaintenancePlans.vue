<template>
  <q-page padding>
    <div class="text-h4">Plans de maintenance</div>
    <div class="row">
      <div class="col">
        <q-table
          :rows="maintenancePlans"
          :columns="columns"
          row-key="id"
          :pagination="{ rowsPerPage: 10 }"
          :filter="filter"
          :loading="!maintenancePlans.length"
        >
          <template v-slot:top>
            <q-input
              v-model="filter"
              placeholder="Rechercher..."
              debounce="300"
              class="q-mb-md"
            />
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <!-- DUPLICATE -->
              <q-btn
                color="dark"
                icon="mdi-content-copy"
                round
                flat
                dense
                @click="duplicatePlan(props.row.id)"
              />
              <!-- VIEW -->
              <q-btn
                color="primary"
                icon="mdi-eye"
                round
                flat
                dense
                @click="goToPlanDetails(props.row.id)"
              />
            </q-td>
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
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";

const App = useAppStore();
const router = useRouter();
const $q = useQuasar();
const maintenancePlans = ref([]);
const columns = [
  {
    name: "location",
    label: "Emplacement",
    align: "left",
    field: "location",
    sortable: true,
  },
  {
    name: "description",
    label: "Description",
    align: "left",
    field: "description",
  },
  {
    name: "type",
    label: "Type",
    align: "left",
    field: "type",
    sortable: true,
  },
  {
    name: "lastMaintenance",
    label: "Dernière maintenance",
    align: "left",
    field: (row) =>
      row.lastMaintenance
        ? dayjs(row.lastMaintenance).format("DD.MM.YYYY")
        : "Aucune",
    sortable: true,
  },
  {
    name: "nextMaintenance",
    label: "Prochaine maintenance",
    align: "left",
    field: (row) =>
      row.nextMaintenance
        ? dayjs(row.nextMaintenance).format("DD.MM.YYYY")
        : "Aucune",
    sortable: true,
  },
  {
    name: "actions",
    label: "Actions",
    align: "right",
    field: "actions",
  },
];
const filter = ref("");

const goToPlanDetails = (planId) => {
  console.log("Navigating to plan details for ID:", planId);
  router.push({
    name: "maintenance-plan-details",
    params: { planId },
  });
};

const duplicatePlan = async (planId) => {
  try {
    $q.dialog({
      title: "Duplication du plan de maintenance",
      message:
        "Veuillez entrer l'emplacement pour le nouveau plan de maintenance.",
      prompt: {
        model: "",
        type: "text",
        placeholder: "Emplacement du nouveau plan",
      },
      cancel: true,
      persistent: true,
    })
      .onOk(async (data) => {
        if (!data || !data.trim()) {
          App.notify("L'emplacement ne peut pas être vide.", "error");
          return;
        }
        // Call the API to duplicate the plan
        const response = await api.post(
          `/maintenance/plans/${planId}/duplicate`,
          {
            location: data.trim(),
          }
        );
        App.notify("Plan dupliqué avec succès !", "positive");
        fetchMaintenancePlans();
      })
      .onCancel(() => {
        console.log("Duplication cancelled");
      });
    fetchMaintenancePlans();
  } catch (error) {
    console.error("Error duplicating plan:", error);
    App.notify("Erreur lors de la duplication du plan.", "error");
  }
};

const fetchMaintenancePlans = async () => {
  try {
    const response = await api.get("/maintenance/plans");
    maintenancePlans.value = response.data;
  } catch (error) {
    console.error("Error fetching maintenance plans:", error);
  }
};

onMounted(() => {
  fetchMaintenancePlans();
});
</script>

<style></style>
