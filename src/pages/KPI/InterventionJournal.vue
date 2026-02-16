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
            <q-select
              v-model="selectedLocationValue"
              :options="filteredLocationOptions"
              label="Position"
              outlined
              dense
              clearable
              use-input
              new-value-mode="add-unique"
              emit-value
              map-options
              option-label="label"
              option-value="value"
              input-debounce="0"
              @filter="onLocationFilter"
              @new-value="onLocationNewValue"
              hint="Ex: X001.1120, X101.1360, etc."
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.startTime"
              label="Heure de début"
              outlined
              dense
              type="time"
              hint="Début de l'arrêt de l'installation"
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.endTime"
              label="Heure de fin"
              outlined
              dense
              type="time"
              hint="Fin de l'arrêt de l'installation"
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
              :disable="!isLocationComplete"
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
  </q-page>
</template>

<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";
import dayjs from "dayjs";
import { useAppStore } from "stores/app";
import { useInterventionEditDialog } from "src/plugins/useInterventionEditDialog";
import { useInterventionTimerStopDialog } from "src/plugins/useInterventionTimerStopDialog";

const $q = useQuasar();
const App = useAppStore();
const { openEditDialog } = useInterventionEditDialog();
const { openTimerStopDialog } = useInterventionTimerStopDialog();

const interventions = ref([]);
const loading = ref(false);
const locations = ref([]);
const selectedLocationValue = ref("");
const locationInput = ref("");
const locationFilter = ref("");
const customLocationValues = ref([]);
const isAutoSelectingLocation = ref(false);

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

const buildLocationValue = (location) => {
  if (!location?.dataSource || !location?.position) {
    return "";
  }

  return `${location.dataSource}.${location.position}`;
};

const locationOptions = computed(() => {
  const optionsByValue = new Map();

  locations.value
    .filter((location) => location.dataSource && location.position)
    .forEach((location) => {
      const value = buildLocationValue(location);
      if (!value || optionsByValue.has(value)) {
        return;
      }

      const label = location.component
        ? `${value} - ${location.component}`
        : value;
      optionsByValue.set(value, {
        value,
        label,
        component: location.component || "",
      });
    });

  customLocationValues.value.forEach((value) => {
    if (!value || optionsByValue.has(value)) {
      return;
    }

    optionsByValue.set(value, {
      value,
      label: value,
      component: "",
    });
  });

  return [...optionsByValue.values()].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
});

const filteredLocationOptions = computed(() => {
  if (!locationFilter.value) {
    return locationOptions.value;
  }

  const search = locationFilter.value.toLowerCase();
  return locationOptions.value.filter((option) =>
    option.label.toLowerCase().includes(search)
  );
});

const selectedLocation = computed(() => {
  if (!selectedLocationValue.value) {
    return null;
  }

  return (
    locations.value.find(
      (location) =>
        buildLocationValue(location).toLowerCase() ===
        selectedLocationValue.value.toLowerCase()
    ) || null
  );
});

const isLocationComplete = computed(() => {
  return Boolean(selectedLocationValue.value);
});

watch(selectedLocationValue, () => {
  if (isAutoSelectingLocation.value) {
    return;
  }

  locationInput.value = selectedLocationValue.value || "";
});

const findLocationByInput = (value) => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return null;
  }

  return (
    locations.value.find((location) => {
      return (
        buildLocationValue(location).toLowerCase() === normalized.toLowerCase()
      );
    }) || null
  );
};

const applyLocationMatch = (location) => {
  if (!location) {
    return;
  }

  isAutoSelectingLocation.value = true;
  selectedLocationValue.value = buildLocationValue(location);
  locationInput.value = selectedLocationValue.value;
  nextTick(() => {
    isAutoSelectingLocation.value = false;
  });
};

const onLocationFilter = (value, update) => {
  locationFilter.value = value;
  locationInput.value = value;
  tryAutoSelectFromInput(value);
  update(() => {});
};

const onLocationNewValue = (value, done) => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return;
  }

  if (!customLocationValues.value.includes(normalized)) {
    customLocationValues.value.push(normalized);
  }

  selectedLocationValue.value = normalized;
  locationFilter.value = "";
  if (done) {
    done(normalized, "add-unique");
  }
};

const tryAutoSelectFromInput = (value) => {
  const match = findLocationByInput(value);
  if (match) {
    applyLocationMatch(match);
  }
};

watch(
  () => locations.value,
  (list) => {
    if (!list?.length || !locationInput.value) {
      return;
    }

    tryAutoSelectFromInput(locationInput.value);
  }
);

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
  if (!isLocationComplete.value) {
    $q.notify({
      type: "warning",
      message: "Veuillez sélectionner une position",
    });
    return;
  }

  form.value.alarmCode = selectedLocationValue.value;

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
    selectedLocationValue.value = "";
    locationInput.value = "";
    locationFilter.value = "";

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

const editIntervention = async (intervention) => {
  const result = await openEditDialog({
    intervention: {
      id: intervention.id,
      alarmCode: intervention.alarmCode || "",
      description: intervention.description || "",
      startTime: intervention.startTime || "",
      endTime: intervention.endTime || "",
      comment: intervention.comment || "",
      isPlanned: intervention.isPlanned,
    },
    locations: locations.value,
  });

  if (!result) {
    return;
  }

  await saveEdit(result);
};

const saveEdit = async (payload) => {
  try {
    const { id, ...updateData } = payload;
    await api.patch(`/interventions/journal/${id}`, updateData);

    $q.notify({
      type: "positive",
      message: "Intervention modifiée avec succès",
    });

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

const stopTimer = async () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }

  // If the intervention is less than a minute, just reset without showing the dialog
  if (elapsedSeconds.value < 60) {
    elapsedSeconds.value = 0;
    App.stopInterventionTimer();
    return;
  }

  // Pre-fill the form with timer data
  const startDate = new Date(App.interventionTimer.startDate);
  const timerForm = {
    alarmCode: "",
    description: "",
    startTime: dayjs(startDate).format("HH:mm"),
    endTime: dayjs().format("HH:mm"),
    comment: "",
    isPlanned: false,
  };

  const result = await openTimerStopDialog({
    timerForm,
    displayTime: displayTime.value,
    onCancel: cancelTimer,
    locations: locations.value,
  });

  if (!result) {
    return;
  }

  await saveTimerIntervention(result);
};

const cancelTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }

  elapsedSeconds.value = 0;

  // Arrêter le timer dans le store
  App.stopInterventionTimer();
};

const saveTimerIntervention = async (payload) => {
  if (!payload.alarmCode && !payload.description) {
    $q.notify({
      type: "warning",
      message: "Veuillez remplir au moins le code d'alarme ou la description",
    });
    return;
  }

  try {
    await api.post("/interventions/journal", {
      plannedDate: todayDate.value,
      ...payload,
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

    elapsedSeconds.value = 0;

    // Arrêter le timer dans le store
    App.stopInterventionTimer();

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

  api
    .get("/locations")
    .then((response) => {
      locations.value = response.data;
    })
    .catch((error) => {
      console.error("Error loading locations:", error);
    });

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
