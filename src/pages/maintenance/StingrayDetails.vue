<template>
  <q-page padding>
    <q-btn
      icon="mdi-arrow-left"
      label="Retour"
      flat
      dense
      :to="{ name: 'stingrays-list' }"
    />

    <div v-if="stingray" class="row q-pt-md q-col-gutter-md">
      <!-- État & alarme -->
      <div class="col-12">
        <div class="row items-center q-mb-md">
          <div class="text-h4 q-mr-md">Stingray {{ stingray.number }}</div>
          <q-badge :color="stateColor(stingray.state)" class="q-mr-sm">
            {{ stateLabel(stingray.state) }}
          </q-badge>
          <q-badge :color="alarmColor(stingray.alarmLevel)">
            Alarme : {{ alarmLabel(stingray.alarmLevel) }}
            <span v-if="stingray.recentAlarms">
              ({{ stingray.recentAlarms.length }})
            </span>
          </q-badge>
        </div>
      </div>

      <!-- Détails + changer d'état -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Détails</div>
            <q-separator class="q-mb-sm" />
            <div class="row q-mb-xs">
              <div class="col-5 text-grey-7">Numéro de série :</div>
              <div class="col">{{ stingray.serialNumber || "N/A" }}</div>
            </div>
            <div class="row q-mb-xs">
              <div class="col-5 text-grey-7">Position actuelle :</div>
              <div class="col">{{ positionLabel(stingray) }}</div>
            </div>
            <div class="row q-mb-xs" v-if="stingray.notes">
              <div class="col-5 text-grey-7">Notes :</div>
              <div class="col">{{ stingray.notes }}</div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Alarmes récentes -->
        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Alarmes récentes (datalog)</div>
            <q-separator class="q-mb-sm" />
            <q-list v-if="stingray.recentAlarms?.length" separator dense>
              <q-item v-for="alarm in stingray.recentAlarms" :key="alarm.dbId">
                <q-item-section>
                  <q-item-label>{{ alarm.alarmText }}</q-item-label>
                  <q-item-label caption>
                    {{ formatDateTime(alarm.timeOfOccurence) }} — Sévérité : {{ alarm.severity || "N/A" }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-caption text-grey-7">
              Aucune alarme récente pour ce stingray.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Position : formulaire + historique -->
      <div class="col-12 col-md-6">
        <q-card flat bordered v-if="App.userHasAccess('canManageStingrays')">
          <q-card-section>
            <div class="text-h6">Déplacer / changer de position</div>
            <q-separator class="q-mb-sm" />
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-select
                  v-model="positionForm.aisleId"
                  :options="aisleOptions"
                  label="Allée"
                  outlined
                  dense
                  clearable
                  emit-value
                  map-options
                  hint="Vide = hors allée (atelier, stock...)"
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model.number="positionForm.floor"
                  label="Étage"
                  outlined
                  dense
                  type="number"
                  :disable="!positionForm.aisleId"
                  :min="1"
                  :max="selectedAisleFloors"
                />
              </div>
              <div class="col-12" v-if="!positionForm.aisleId">
                <q-input
                  v-model="positionForm.locationLabel"
                  label="Libellé (ex: Atelier, Stock spare)"
                  outlined
                  dense
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="positionForm.movedAt"
                  label="Date d'entrée"
                  outlined
                  dense
                  type="datetime-local"
                />
              </div>
              <div class="col-12 text-right">
                <q-btn
                  color="primary"
                  dense
                  label="Enregistrer la position"
                  icon="add_location"
                  @click="addPosition"
                  :disable="positionForm.aisleId && !positionForm.floor"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-h6">Historique des positions</div>
            <q-separator class="q-mb-sm" />
            <q-list v-if="positionHistory.length" separator dense>
              <q-item v-for="entry in positionHistory" :key="entry.id">
                <q-item-section>
                  <q-item-label>
                    {{ entry.aisle ? `${entry.aisle.name} - Étage ${entry.floor}` : (entry.locationLabel || "N/A") }}
                  </q-item-label>
                  <q-item-label caption>
                    Du {{ formatDateTime(entry.movedAt) }}
                    à {{ entry.leftAt ? formatDateTime(entry.leftAt) : "aujourd'hui" }}
                    <span v-if="entry.moverFullname"> — {{ entry.moverFullname }}</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-caption text-grey-7">
              Aucun historique de position.
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Journal d'interventions -->
      <div class="col-12">
        <q-card flat bordered v-if="App.userHasAccess('canAccessJournal')">
          <q-card-section>
            <div class="text-h6">Enregistrer une intervention</div>
            <q-separator class="q-mb-sm" />
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-md-3">
                <q-input
                  v-model="interventionForm.plannedDate"
                  label="Date"
                  outlined
                  dense
                  type="date"
                />
              </div>
              <div class="col-12 col-md-3">
                <q-select
                  v-model="interventionForm.isPlanned"
                  :options="interventionTypeOptions"
                  label="Type d'intervention"
                  outlined
                  dense
                  emit-value
                  map-options
                />
              </div>
              <div class="col-12 col-md-3">
                <q-input
                  v-model="interventionForm.startTime"
                  label="Heure de début"
                  outlined
                  dense
                  type="time"
                />
              </div>
              <div class="col-12 col-md-3">
                <q-input
                  v-model="interventionForm.endTime"
                  label="Heure de fin"
                  outlined
                  dense
                  type="time"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="interventionForm.description"
                  label="Description"
                  outlined
                  dense
                  hint="Ex: remplacement du moteur de levage"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model="interventionForm.comment"
                  label="Commentaire"
                  outlined
                  dense
                  type="textarea"
                  rows="2"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-select
                  v-model="interventionForm.newState"
                  :options="stateOptions"
                  label="Changement d'état (optionnel)"
                  outlined
                  dense
                  clearable
                  emit-value
                  map-options
                  hint="Si renseigné, l'état du stingray sera mis à jour"
                />
              </div>
              <div class="col-12 col-md-6 text-right">
                <q-btn
                  color="primary"
                  dense
                  label="Ajouter"
                  icon="add"
                  @click="addIntervention"
                  :disable="!interventionForm.plannedDate"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-h6">
              Journal d'interventions
              <q-badge color="primary" :label="interventions.length" />
            </div>
            <q-separator class="q-mb-sm" />
            <q-list v-if="interventions.length" separator dense>
              <q-item v-for="intervention in interventions" :key="intervention.id">
                <q-item-section>
                  <q-item-label class="text-weight-medium">
                    {{ intervention.description || "Sans description" }}
                  </q-item-label>
                  <q-item-label caption>
                    <q-icon name="event" size="xs" class="q-mr-xs" />
                    {{ formatDate(intervention.plannedDate) }}
                    <q-separator vertical class="q-mx-sm" />
                    <q-icon name="person" size="xs" class="q-mr-xs" />
                    {{ intervention.creatorFullname || intervention.createdBy }}
                  </q-item-label>
                  <q-item-label v-if="intervention.comment" class="q-mt-xs text-caption text-grey-8">
                    {{ intervention.comment }}
                  </q-item-label>
                  <q-item-label class="q-mt-xs">
                    <q-badge
                      :color="intervention.isPlanned ? 'positive' : 'warning'"
                      :label="intervention.isPlanned ? 'Préventive' : 'Corrective / panne'"
                    />
                    <q-badge
                      v-if="intervention.newState"
                      color="primary"
                      class="q-ml-sm"
                      :label="`Nouvel état : ${stateLabel(intervention.newState)}`"
                    />
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-caption text-grey-7">
              Aucune intervention enregistrée pour ce stingray.
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div v-else class="text-center text-grey-7 q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else>Stingray introuvable.</div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useQuasar } from "quasar";
import dayjs from "dayjs";
import { api } from "boot/axios";
import { useAppStore } from "stores/app";
import { useStingraysStore } from "stores/stingrays";

const route = useRoute();
const $q = useQuasar();
const App = useAppStore();
const stingraysStore = useStingraysStore();

const stingrayId = route.params.stingrayId;

const stingray = ref(null);
const positionHistory = ref([]);
const interventions = ref([]);
const aisles = ref([]);
const loading = ref(false);

const STATE_LABELS = {
  in_service: "En service",
  maintenance: "Atelier",
  out_of_service: "Hors service",
  spare: "Stock (spare)",
};
const STATE_COLORS = {
  in_service: "positive",
  maintenance: "orange",
  out_of_service: "negative",
  spare: "grey-7",
};
const ALARM_LABELS = { ok: "OK", warning: "Attention", critical: "Critique" };
const ALARM_COLORS = { ok: "positive", warning: "orange", critical: "negative" };

const stateLabel = (state) => STATE_LABELS[state] || state;
const stateColor = (state) => STATE_COLORS[state] || "grey";
const alarmLabel = (level) => ALARM_LABELS[level] || level;
const alarmColor = (level) => ALARM_COLORS[level] || "grey";

const stateOptions = Object.entries(STATE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const interventionTypeOptions = [
  { value: true, label: "Préventive (planifiée)" },
  { value: false, label: "Corrective / panne" },
];

const aisleOptions = computed(() =>
  aisles.value.map((a) => ({ value: a.id, label: a.name, floorsCount: a.floorsCount }))
);
const selectedAisleFloors = computed(() => {
  const aisle = aisles.value.find((a) => a.id === positionForm.value.aisleId);
  return aisle?.floorsCount || 28;
});

const positionLabel = (s) => {
  if (s.currentAisle && s.currentFloor) {
    return `${s.currentAisle.name} - Étage ${s.currentFloor}`;
  }
  return stateLabel(s.state);
};

const formatDate = (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A");
const formatDateTime = (date) =>
  date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "N/A";

const positionForm = ref({
  aisleId: null,
  floor: null,
  locationLabel: "",
  movedAt: dayjs().format("YYYY-MM-DDTHH:mm"),
});

const interventionForm = ref({
  plannedDate: dayjs().format("YYYY-MM-DD"),
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: true,
  newState: null,
});

const loadStingray = async () => {
  stingray.value = await stingraysStore.fetchStingray(stingrayId);
};

const loadPositionHistory = async () => {
  positionHistory.value = await stingraysStore.fetchPositionHistory(stingrayId);
};

const loadInterventions = async () => {
  interventions.value = await stingraysStore.fetchInterventions(stingrayId);
};

const loadAll = async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadStingray(),
      loadPositionHistory(),
      loadInterventions(),
      stingraysStore.fetchAisles().then((data) => (aisles.value = data)),
    ]);
  } catch (error) {
    console.error("Error loading stingray details:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement du stingray",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const addPosition = async () => {
  try {
    await stingraysStore.addPosition(stingrayId, {
      aisleId: positionForm.value.aisleId || null,
      floor: positionForm.value.aisleId ? positionForm.value.floor : null,
      locationLabel: positionForm.value.aisleId
        ? null
        : positionForm.value.locationLabel || null,
      movedAt: positionForm.value.movedAt,
    });
    $q.notify({ type: "positive", message: "Position enregistrée" });
    positionForm.value.aisleId = null;
    positionForm.value.floor = null;
    positionForm.value.locationLabel = "";
    await Promise.all([loadStingray(), loadPositionHistory()]);
  } catch (error) {
    console.error("Error adding position:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'enregistrement de la position",
      caption: error.message,
    });
  }
};

const addIntervention = async () => {
  try {
    await api.post("/interventions/journal", {
      plannedDate: interventionForm.value.plannedDate,
      alarmCode: `Shuttle ${stingray.value.number}`,
      description: interventionForm.value.description,
      startTime: interventionForm.value.startTime || null,
      endTime: interventionForm.value.endTime || null,
      comment: interventionForm.value.comment,
      isPlanned: interventionForm.value.isPlanned,
      stingrayId,
      newState: interventionForm.value.newState || null,
    });
    $q.notify({ type: "positive", message: "Intervention enregistrée" });
    interventionForm.value.description = "";
    interventionForm.value.comment = "";
    interventionForm.value.newState = null;
    await Promise.all([loadInterventions(), loadStingray(), loadPositionHistory()]);
  } catch (error) {
    console.error("Error adding intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'ajout de l'intervention",
      caption: error.response?.data?.error || error.message,
    });
  }
};

onMounted(loadAll);
</script>

<style scoped></style>
