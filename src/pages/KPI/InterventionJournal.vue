<template>
  <q-page padding>
    <div class="q-mb-sm">
      <div class="text-h5 q-mb-xs">Journal d'interventions</div>
      <div class="text-caption text-grey-7">
        Interventions du {{ todayDate }}
      </div>
    </div>

    <!-- Quick Timer Card -->
    <q-card
      flat
      bordered
      class="q-mb-sm"
      v-if="App.userHasAccess('canAccessJournal')"
    >
      <q-card-section class="q-pa-sm">
        <div v-if="!App.interventionTimer.running" class="row items-center">
          <div class="col-auto q-mr-sm">
            <q-icon name="timer" size="sm" color="grey-7" />
          </div>
          <div class="col">
            <div class="text-weight-medium">Intervention en cours</div>
          </div>
          <div class="col-auto">
            <q-btn
              color="positive"
              dense
              label="Démarrer"
              icon="play_arrow"
              @click="startTimer"
              class="q-px-sm"
            />
          </div>
        </div>
        <div v-else class="row items-center">
          <div class="col-auto q-mr-sm">
            <q-icon name="timer" size="sm" color="primary" />
          </div>
          <div class="col">
            <div class="text-h6 text-primary">{{ displayTime }}</div>
            <div class="text-caption text-grey-6">
              Début: {{ timerStartTime }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              color="negative"
              dense
              label="Arrêter"
              icon="stop"
              @click="stopTimer"
              class="q-px-sm"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Add Intervention Form -->
    <q-card
      flat
      bordered
      class="q-mb-sm"
      v-if="App.userHasAccess('canAccessJournal')"
    >
      <q-card-section class="q-pa-sm">
        <div class="text-subtitle2 q-mb-sm">Enregistrer une intervention</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input
              v-model="form.alarmCode"
              label="Code d'alarme"
              outlined
              dense
              hint="Ex: X003, Shuttle 67, etc."
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.startTime"
              label="Heure de début"
              outlined
              dense
              type="time"
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.endTime"
              label="Heure de fin"
              outlined
              dense
              type="time"
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.description"
              label="Description"
              outlined
              dense
              hint="Ex: chute d'une pile de caisse, maintenance du stingray"
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.comment"
              label="Commentaire"
              outlined
              dense
              type="textarea"
              rows="3"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-toggle
              v-model="form.isPlanned"
              label="Planifiée"
              color="primary"
              dense
            />
          </div>
          <div class="col-12 col-md-6 text-right">
            <q-btn
              color="primary"
              dense
              label="Ajouter"
              icon="add"
              @click="addIntervention"
              :disable="!form.alarmCode && !form.description"
              class="q-px-sm"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Interventions List -->
    <q-card flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="row items-center q-mb-sm">
          <div class="col">
            <div class="text-subtitle2">
              Liste des interventions
              <q-badge color="primary" :label="interventions.length" />
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              flat
              round
              dense
              icon="refresh"
              color="primary"
              @click="loadInterventions"
              :loading="loading"
            >
              <q-tooltip>Actualiser</q-tooltip>
            </q-btn>
          </div>
        </div>

        <q-list v-if="interventions.length > 0" separator dense>
          <q-item
            v-for="intervention in interventions"
            :key="intervention.id"
            clickable
            class="q-pa-sm"
          >
            <q-item-section>
              <q-item-label>
                <q-badge
                  v-if="intervention.alarmCode"
                  color="primary"
                  :label="intervention.alarmCode"
                  class="q-mr-xs"
                />
                <span class="text-weight-medium">{{
                  intervention.description || "Sans description"
                }}</span>
              </q-item-label>
              <q-item-label caption class="q-mt-xs">
                <q-icon name="schedule" size="xs" class="q-mr-xs" />
                <span v-if="intervention.startTime">
                  {{ intervention.startTime }} -
                  {{ intervention.endTime || "?" }}
                </span>
                <span v-else>Horaire non défini</span>
                <q-separator vertical class="q-mx-sm" />
                <q-icon name="person" size="xs" class="q-mr-xs" />
                {{ intervention.creatorFullname || intervention.createdBy }}
                <q-separator vertical class="q-mx-sm" />
                <q-icon name="access_time" size="xs" class="q-mr-xs" />
                {{ formatDate(intervention.createdAt) }}
              </q-item-label>
              <q-item-label v-if="intervention.comment" class="q-mt-xs">
                <div class="text-caption text-grey-8">
                  {{ intervention.comment }}
                </div>
              </q-item-label>
              <q-item-label class="q-mt-xs">
                <q-badge
                  :color="intervention.isPlanned ? 'positive' : 'warning'"
                  :label="
                    intervention.isPlanned
                      ? 'Planifiée (maintenance)'
                      : 'Non planifiée (panne)'
                  "
                />
                <q-badge
                  v-if="intervention.status !== 'pending'"
                  :color="
                    intervention.status === 'validated' ? 'green' : 'grey'
                  "
                  :label="
                    intervention.status === 'validated' ? 'Validé' : 'Ignoré'
                  "
                  class="q-ml-sm"
                />
              </q-item-label>
            </q-item-section>

            <q-item-section side v-if="canModify(intervention)">
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  round
                  icon="edit"
                  color="primary"
                  @click="editIntervention(intervention)"
                  :disable="intervention.status !== 'pending'"
                >
                  <q-tooltip>Modifier</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  size="sm"
                  round
                  icon="delete"
                  color="negative"
                  @click="deleteIntervention(intervention.id)"
                  :disable="intervention.status !== 'pending'"
                >
                  <q-tooltip>Supprimer</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center text-grey-7 q-pa-md">
          <q-icon name="event_busy" size="48px" />
          <div class="q-mt-sm text-caption">
            Aucune intervention pour aujourd'hui
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Edit Dialog -->
    <q-dialog v-model="editDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Modifier l'intervention</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="editForm.alarmCode"
            label="Code d'alarme"
            outlined
            dense
            class="q-mb-md"
          />
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <q-input
                v-model="editForm.startTime"
                label="Heure de début"
                outlined
                dense
                type="time"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="editForm.endTime"
                label="Heure de fin"
                outlined
                dense
                type="time"
              />
            </div>
          </div>
          <q-input
            v-model="editForm.description"
            label="Description"
            outlined
            dense
            class="q-mb-md"
          />
          <q-input
            v-model="editForm.comment"
            label="Commentaire"
            outlined
            dense
            type="textarea"
            rows="3"
            class="q-mb-md"
          />
          <q-toggle
            v-model="editForm.isPlanned"
            label="Intervention planifiée (maintenance)"
            color="primary"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" v-close-popup />
          <q-btn label="Enregistrer" color="primary" @click="saveEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Timer Stop Dialog -->
    <q-dialog v-model="timerDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Enregistrer l'intervention</div>
          <div class="text-subtitle2 text-grey-7">
            Durée totale: {{ displayTime }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="timerForm.alarmCode"
            label="Code d'alarme *"
            outlined
            dense
            class="q-mb-md"
            hint="Ex: X003, Shuttle 67, etc."
          />
          <q-input
            v-model="timerForm.description"
            label="Description *"
            outlined
            dense
            class="q-mb-md"
            hint="Ex: chute d'une pile de caisse, maintenance du stingray"
          />
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <q-input
                v-model="timerForm.startTime"
                label="Heure de début"
                outlined
                dense
                type="time"
                readonly
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="timerForm.endTime"
                label="Heure de fin"
                outlined
                dense
                type="time"
                readonly
              />
            </div>
          </div>
          <q-input
            v-model="timerForm.comment"
            label="Commentaire"
            outlined
            dense
            type="textarea"
            rows="3"
            class="q-mb-md"
          />
          <q-toggle
            v-model="timerForm.isPlanned"
            label="Intervention planifiée (maintenance)"
            color="primary"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" @click="cancelTimer" />
          <q-btn
            label="Enregistrer"
            color="primary"
            @click="saveTimerIntervention"
            :disable="!timerForm.alarmCode && !timerForm.description"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";
import dayjs from "dayjs";
import { useAppStore } from "stores/app";

const $q = useQuasar();
const App = useAppStore();

const interventions = ref([]);
const loading = ref(false);
const editDialog = ref(false);

// Timer state - utiliser le store global
const timerDialog = ref(false);

const timerRunning = computed(() => App.interventionTimer.running);
const timerStartTime = computed(() => App.interventionTimer.startTime);
const elapsedSeconds = ref(0);

// Interval local pour mettre à jour l'affichage sur cette page
const timerInterval = ref(null);

const form = ref({
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
});

const editForm = ref({
  id: null,
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
});

const timerForm = ref({
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
});

const todayDate = computed(() => {
  return dayjs().format("YYYY-MM-DD");
});

const displayTime = computed(() => {
  const hours = Math.floor(elapsedSeconds.value / 3600);
  const minutes = Math.floor((elapsedSeconds.value % 3600) / 60);
  const seconds = elapsedSeconds.value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
});

const formatDate = (date) => {
  return dayjs(date).format("DD/MM/YYYY HH:mm");
};

const canModify = (intervention) => {
  return intervention.createdBy === App.userId;
};

const loadInterventions = async () => {
  loading.value = true;
  try {
    const response = await api.get(`/interventions/journal/${todayDate.value}`);
    interventions.value = response.data;
  } catch (error) {
    console.error("Error loading interventions:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des interventions",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const addIntervention = async () => {
  if (!form.value.alarmCode && !form.value.description) {
    $q.notify({
      type: "warning",
      message: "Veuillez remplir au moins le code d'alarme ou la description",
    });
    return;
  }

  try {
    await api.post("/interventions/journal", {
      plannedDate: todayDate.value,
      ...form.value,
    });

    $q.notify({
      type: "positive",
      message: "Intervention ajoutée avec succès",
    });

    // Reset form
    form.value = {
      alarmCode: "",
      description: "",
      startTime: "",
      endTime: "",
      comment: "",
      isPlanned: false,
    };

    // Reload list
    await loadInterventions();
  } catch (error) {
    console.error("Error adding intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'ajout de l'intervention",
      caption: error.message,
    });
  }
};

const editIntervention = (intervention) => {
  editForm.value = {
    id: intervention.id,
    alarmCode: intervention.alarmCode || "",
    description: intervention.description || "",
    startTime: intervention.startTime || "",
    endTime: intervention.endTime || "",
    comment: intervention.comment || "",
    isPlanned: intervention.isPlanned,
  };
  editDialog.value = true;
};

const saveEdit = async () => {
  try {
    const { id, ...updateData } = editForm.value;
    await api.patch(`/interventions/journal/${id}`, updateData);

    $q.notify({
      type: "positive",
      message: "Intervention modifiée avec succès",
    });

    editDialog.value = false;
    await loadInterventions();
  } catch (error) {
    console.error("Error updating intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la modification",
      caption: error.message,
    });
  }
};

const deleteIntervention = async (id) => {
  $q.dialog({
    title: "Confirmer la suppression",
    message: "Êtes-vous sûr de vouloir supprimer cette intervention ?",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/interventions/journal/${id}`);

      $q.notify({
        type: "positive",
        message: "Intervention supprimée",
      });

      await loadInterventions();
    } catch (error) {
      console.error("Error deleting intervention:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la suppression",
        caption: error.message,
      });
    }
  });
};

// Timer functions
const startTimer = () => {
  App.startInterventionTimer();

  // Démarrer l'interval local pour l'affichage
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }

  timerInterval.value = setInterval(() => {
    if (App.interventionTimer.startDate) {
      const startDate = new Date(App.interventionTimer.startDate);
      elapsedSeconds.value = Math.floor((new Date() - startDate) / 1000);
    }
  }, 1000);

  $q.notify({
    type: "positive",
    message: "Timer démarré",
    caption: "L'intervention est en cours",
    timeout: 2000,
  });
};

const stopTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }

  // Pre-fill the form with timer data
  const startDate = new Date(App.interventionTimer.startDate);
  timerForm.value = {
    alarmCode: "",
    description: "",
    startTime: dayjs(startDate).format("HH:mm"),
    endTime: dayjs().format("HH:mm"),
    comment: "",
    isPlanned: false,
  };

  timerDialog.value = true;
};

const cancelTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }

  timerDialog.value = false;
  elapsedSeconds.value = 0;

  // Arrêter le timer dans le store
  App.stopInterventionTimer();
};

const saveTimerIntervention = async () => {
  if (!timerForm.value.alarmCode && !timerForm.value.description) {
    $q.notify({
      type: "warning",
      message: "Veuillez remplir au moins le code d'alarme ou la description",
    });
    return;
  }

  try {
    await api.post("/interventions/journal", {
      plannedDate: todayDate.value,
      ...timerForm.value,
    });

    $q.notify({
      type: "positive",
      message: "Intervention enregistrée avec succès",
    });

    // Reset timer state
    if (timerInterval.value) {
      clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    timerDialog.value = false;
    elapsedSeconds.value = 0;

    // Arrêter le timer dans le store
    App.stopInterventionTimer();

    timerForm.value = {
      alarmCode: "",
      description: "",
      startTime: "",
      endTime: "",
      comment: "",
      isPlanned: false,
    };

    // Reload list
    await loadInterventions();
  } catch (error) {
    console.error("Error saving timer intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'enregistrement",
      caption: error.message,
    });
  }
};

onMounted(async () => {
  await loadInterventions();

  // Démarrer l'interval local si le timer est en cours
  if (App.interventionTimer.running) {
    timerInterval.value = setInterval(() => {
      if (App.interventionTimer.startDate) {
        const startDate = new Date(App.interventionTimer.startDate);
        elapsedSeconds.value = Math.floor((new Date() - startDate) / 1000);
      }
    }, 1000);
  }
});

// Nettoyer l'interval quand le composant est détruit
onBeforeUnmount(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }
});
</script>
<style scoped>
.text-h3 {
  font-family: "Courier New", monospace;
  font-weight: bold;
}
</style>
