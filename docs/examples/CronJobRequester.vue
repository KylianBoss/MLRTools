<template>
  <div class="cron-job-requester">
    <q-card>
      <q-card-section>
        <div class="text-h6">Demander l'exécution d'un job</div>
      </q-card-section>

      <q-card-section>
        <q-select
          v-model="selectedAction"
          :options="availableActions"
          label="Action"
          option-label="label"
          option-value="value"
          emit-value
          map-options
        />

        <!-- Arguments pour extractTrayAmount -->
        <div v-if="selectedAction === 'extractTrayAmount'" class="q-mt-md">
          <q-input v-model="args.date" label="Date (YYYY-MM-DD)" type="date" />
          <q-toggle
            v-model="args.headless"
            label="Mode headless (sans navigateur visible)"
          />
        </div>

        <!-- Arguments pour extractWMS -->
        <div v-if="selectedAction === 'extractWMS'" class="q-mt-md">
          <q-input v-model="args.date" label="Date (YYYY-MM-DD)" type="date" />
        </div>

        <!-- Arguments pour extractSAV -->
        <div v-if="selectedAction === 'extractSAV'" class="q-mt-md">
          <q-input v-model="args.date" label="Date (YYYY-MM-DD)" type="date" />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn label="Annuler" flat @click="reset" />
        <q-btn
          label="Demander l'exécution"
          color="primary"
          :loading="loading"
          @click="requestJob"
        />
      </q-card-actions>
    </q-card>

    <!-- Historique des demandes -->
    <q-card class="q-mt-md">
      <q-card-section>
        <div class="text-h6">Mes demandes récentes</div>
      </q-card-section>

      <q-card-section>
        <q-table
          :rows="jobHistory"
          :columns="columns"
          row-key="id"
          :loading="loadingHistory"
          flat
          bordered
        >
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="getStatusColor(props.value)"
                :label="getStatusLabel(props.value)"
              />
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn
                flat
                dense
                icon="refresh"
                color="primary"
                @click="refreshJobStatus(props.row.id)"
              >
                <q-tooltip>Rafraîchir le statut</q-tooltip>
              </q-btn>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { api } from "boot/axios";
import { useQuasar } from "quasar";
import dayjs from "dayjs";

const $q = useQuasar();

const selectedAction = ref("extractTrayAmount");
const args = ref({
  date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
  headless: true,
});
const loading = ref(false);
const loadingHistory = ref(false);
const jobHistory = ref([]);
let eventSource = null;

const availableActions = [
  { label: "Extract Tray Amount", value: "extractTrayAmount" },
  { label: "Extract WMS", value: "extractWMS" },
  { label: "Extract SAV", value: "extractSAV" },
  { label: "Send KPI", value: "sendKPI" },
];

const columns = [
  { name: "id", label: "ID", field: "id", align: "left" },
  { name: "jobName", label: "Job", field: "jobName", align: "left" },
  { name: "status", label: "Statut", field: "status", align: "center" },
  {
    name: "createdAt",
    label: "Demandé le",
    field: "createdAt",
    format: (val) => dayjs(val).format("DD/MM/YYYY HH:mm:ss"),
    align: "left",
  },
  {
    name: "completedAt",
    label: "Terminé le",
    field: "completedAt",
    format: (val) => (val ? dayjs(val).format("DD/MM/YYYY HH:mm:ss") : "-"),
    align: "left",
  },
  { name: "error", label: "Erreur", field: "error", align: "left" },
  { name: "actions", label: "Actions", align: "center" },
];

const requestJob = async () => {
  loading.value = true;
  try {
    const userId = $q.localStorage.getItem("userId"); // Adapter selon votre système d'auth

    const response = await api.post("/cron/request-job", {
      action: selectedAction.value,
      userId: userId,
      args: args.value,
    });

    $q.notify({
      type: "positive",
      message: response.data.message,
      caption: `Queue ID: ${response.data.queueId}`,
    });

    // Ajouter à l'historique
    jobHistory.value.unshift({
      id: response.data.queueId,
      jobName: response.data.jobName,
      status: "pending",
      createdAt: new Date(),
      completedAt: null,
      error: null,
    });

    reset();
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors de la demande du job",
      caption: error.response?.data?.error || error.message,
    });
  } finally {
    loading.value = false;
  }
};

const refreshJobStatus = async (queueId) => {
  try {
    const response = await api.get(`/cron/queue/${queueId}`);

    const index = jobHistory.value.findIndex((j) => j.id === queueId);
    if (index !== -1) {
      jobHistory.value[index] = response.data;
    }

    $q.notify({
      type: "info",
      message: "Statut mis à jour",
    });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: "Erreur lors de la récupération du statut",
    });
  }
};

const loadJobHistory = async () => {
  loadingHistory.value = true;
  try {
    const response = await api.get("/cron/queue?limit=20");
    jobHistory.value = response.data;
  } catch (error) {
    console.error("Error loading job history:", error);
  } finally {
    loadingHistory.value = false;
  }
};

const setupSSE = () => {
  eventSource = new EventSource("/cron/status");

  eventSource.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "jobQueueStatus") {
      // Mettre à jour l'historique en temps réel
      const index = jobHistory.value.findIndex((j) => j.id === data.job.id);
      if (index !== -1) {
        jobHistory.value[index] = { ...jobHistory.value[index], ...data.job };
      }

      // Notifier l'utilisateur
      if (data.job.status === "completed") {
        $q.notify({
          type: "positive",
          message: `Job terminé: ${data.job.jobName}`,
        });
      } else if (data.job.status === "failed") {
        $q.notify({
          type: "negative",
          message: `Job échoué: ${data.job.jobName}`,
          caption: data.job.error,
        });
      }
    }
  });

  eventSource.addEventListener("error", (error) => {
    console.error("SSE Error:", error);
  });
};

const reset = () => {
  args.value = {
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    headless: true,
  };
};

const getStatusColor = (status) => {
  switch (status) {
    case "pending":
      return "blue";
    case "running":
      return "orange";
    case "completed":
      return "green";
    case "failed":
      return "red";
    default:
      return "grey";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "pending":
      return "En attente";
    case "running":
      return "En cours";
    case "completed":
      return "Terminé";
    case "failed":
      return "Échoué";
    default:
      return status;
  }
};

onMounted(() => {
  loadJobHistory();
  setupSSE();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<style scoped>
.cron-job-requester {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
