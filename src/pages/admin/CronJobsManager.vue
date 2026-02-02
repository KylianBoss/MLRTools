<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <!-- Formulaire de demande de job -->
      <div class="col-12 col-md-6">
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
              @update:model-value="resetArgs"
            />

            <!-- Arguments pour extractTrayAmount -->
            <div v-if="selectedAction === 'extractTrayAmount'" class="q-mt-md">
              <q-input v-model="args.date" label="Date" type="date" filled />
              <q-toggle
                v-model="args.headless"
                label="Mode headless (sans navigateur visible)"
                class="q-mt-sm"
              />
            </div>

            <!-- Arguments pour extractWMS -->
            <div v-if="selectedAction === 'extractWMS'" class="q-mt-md">
              <q-input
                v-model="args.date"
                label="Date (optionnel)"
                type="date"
                filled
                hint="Laisser vide pour traiter toutes les dates manquantes"
              />
            </div>

            <!-- Arguments pour extractSAV -->
            <div v-if="selectedAction === 'extractSAV'" class="q-mt-md">
              <q-input
                v-model="args.date"
                label="Date (optionnel)"
                type="date"
                filled
                hint="Laisser vide pour la date du jour"
              />
            </div>

            <!-- Arguments pour sendKPI -->
            <div v-if="selectedAction === 'sendKPI'" class="q-mt-md">
              <div class="text-caption q-mb-sm">Dépendances :</div>
              <q-checkbox
                v-model="args.dependencies.trayAmount"
                label="Tray Amount"
                true-value="done"
                false-value="pending"
              />
              <q-checkbox
                v-model="args.dependencies.sav"
                label="SAV"
                true-value="done"
                false-value="pending"
              />
              <q-checkbox
                v-model="args.dependencies.wms"
                label="WMS"
                true-value="done"
                false-value="pending"
              />
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn label="Réinitialiser" flat @click="resetArgs" />
            <q-btn
              label="Demander l'exécution"
              color="primary"
              :loading="loading"
              @click="requestJob"
            />
          </q-card-actions>
        </q-card>

        <!-- Statut des cron jobs -->
        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Statut des cron jobs planifiés</div>
          </q-card-section>

          <q-card-section>
            <div
              v-if="cronJobsStatus.length === 0"
              class="text-caption text-grey"
            >
              Aucun cron job actif
            </div>
            <q-list v-else bordered separator>
              <q-item v-for="job in cronJobsStatus" :key="job.name">
                <q-item-section>
                  <q-item-label>{{ job.name }}</q-item-label>
                  <q-item-label caption>
                    Expression: {{ job.cronExpression }}
                  </q-item-label>
                  <q-item-label caption>
                    Dernier run:
                    {{ job.lastRun ? formatDate(job.lastRun) : "Jamais" }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="getStatusColor(job.actualState)"
                    :label="job.actualState"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- Historique des demandes -->
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="row items-center">
              <div class="col text-h6">Historique des demandes</div>
              <div class="col-auto">
                <q-btn
                  flat
                  dense
                  icon="refresh"
                  @click="loadJobHistory"
                  :loading="loadingHistory"
                >
                  <q-tooltip>Rafraîchir</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-scroll-area style="height: 600px">
              <q-list bordered separator>
                <q-item v-for="job in jobHistory" :key="job.id">
                  <q-item-section>
                    <q-item-label>
                      {{ job.jobName }}
                      <q-badge
                        :color="getQueueStatusColor(job.status)"
                        :label="getQueueStatusLabel(job.status)"
                        class="q-ml-sm"
                      />
                    </q-item-label>
                    <q-item-label caption>
                      ID: {{ job.id }} | Action: {{ job.action }}
                    </q-item-label>
                    <q-item-label caption>
                      Demandé: {{ formatDate(job.createdAt) }}
                    </q-item-label>
                    <q-item-label v-if="job.startedAt" caption>
                      Démarré: {{ formatDate(job.startedAt) }}
                    </q-item-label>
                    <q-item-label v-if="job.completedAt" caption>
                      Terminé: {{ formatDate(job.completedAt) }}
                    </q-item-label>
                    <q-item-label
                      v-if="job.error"
                      caption
                      class="text-negative"
                    >
                      Erreur: {{ job.error }}
                    </q-item-label>
                    <q-item-label
                      v-if="job.args && Object.keys(job.args).length > 0"
                      caption
                    >
                      Args: {{ JSON.stringify(job.args) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      dense
                      round
                      icon="refresh"
                      size="sm"
                      @click="refreshJobStatus(job.id)"
                    >
                      <q-tooltip>Rafraîchir le statut</q-tooltip>
                    </q-btn>
                  </q-item-section>
                </q-item>

                <q-item v-if="jobHistory.length === 0">
                  <q-item-section>
                    <q-item-label class="text-grey">
                      Aucune demande récente
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-scroll-area>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { api } from "boot/axios";
import { useQuasar } from "quasar";
import { useAppStore } from "stores/app";
import dayjs from "dayjs";

const $q = useQuasar();
const appStore = useAppStore();

const selectedAction = ref("extractTrayAmount");
const args = ref({
  date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
  headless: true,
  dependencies: {
    trayAmount: "pending",
    sav: "pending",
    wms: "pending",
  },
});
const loading = ref(false);
const loadingHistory = ref(false);
const jobHistory = ref([]);
const cronJobsStatus = ref([]);
let eventSource = null;

const availableActions = [
  { label: "Extract Tray Amount", value: "extractTrayAmount" },
  { label: "Extract WMS", value: "extractWMS" },
  { label: "Extract SAV", value: "extractSAV" },
  { label: "Send KPI", value: "sendKPI" },
];

const resetArgs = () => {
  if (selectedAction.value === "extractTrayAmount") {
    args.value = {
      date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
      headless: true,
    };
  } else if (
    selectedAction.value === "extractWMS" ||
    selectedAction.value === "extractSAV"
  ) {
    args.value = {
      date: "",
    };
  } else if (selectedAction.value === "sendKPI") {
    args.value = {
      dependencies: {
        trayAmount: "pending",
        sav: "pending",
        wms: "pending",
      },
    };
  }
};

const requestJob = async () => {
  loading.value = true;
  try {
    const cleanedArgs = { ...args.value };
    // Nettoyer les dates vides
    if (cleanedArgs.date === "") {
      delete cleanedArgs.date;
    }

    const response = await api.post("/cron/request-job", {
      action: selectedAction.value,
      userId: appStore.user.id,
      args: cleanedArgs,
    });

    $q.notify({
      type: "positive",
      message: response.data.message,
      caption: `Queue ID: ${response.data.queueId}`,
    });

    // Recharger l'historique
    await loadJobHistory();
    resetArgs();
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
    const response = await api.get("/cron/queue?limit=50");
    jobHistory.value = response.data;
  } catch (error) {
    console.error("Error loading job history:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement de l'historique",
    });
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
      } else {
        // Nouveau job, recharger l'historique
        loadJobHistory();
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
    } else if (data.type === "cronJobStatus") {
      cronJobsStatus.value = data.jobs;
    }
  });

  eventSource.addEventListener("error", (error) => {
    console.error("SSE Error:", error);
  });
};

const formatDate = (date) => {
  return dayjs(date).format("DD/MM/YYYY HH:mm:ss");
};

const getStatusColor = (status) => {
  switch (status) {
    case "idle":
      return "blue";
    case "running":
      return "orange";
    case "completed":
      return "green";
    case "error":
      return "red";
    default:
      return "grey";
  }
};

const getQueueStatusColor = (status) => {
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

const getQueueStatusLabel = (status) => {
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
