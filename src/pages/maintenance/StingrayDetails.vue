<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm">
      <q-btn
        icon="mdi-arrow-left"
        label="Retour"
        flat
        dense
        :to="{ name: 'stingrays-list' }"
      />
      <q-space />
      <q-input
        v-model="quickJumpNumber"
        label="Voyage rapide (n° stingray)"
        outlined
        dense
        type="number"
        style="max-width: 220px"
        :disable="loading"
        @keyup.enter="goToQuickJump"
      >
        <template v-slot:append>
          <q-btn
            icon="mdi-arrow-right-circle"
            flat
            round
            dense
            @click="goToQuickJump"
            :disable="!quickJumpNumber"
            :loading="loading"
          />
        </template>
      </q-input>
    </div>

    <div v-if="stingray" class="row q-pt-md q-col-gutter-md">
      <!-- Titre -->
      <div class="col-12">
        <div class="text-h4 q-mb-md">Stingray {{ stingray.number }}</div>
      </div>

      <!-- Détails + changer d'état -->
      <div class="col-12 col-md-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6">Détails</div>
            <q-separator class="q-mb-sm" />
            <div class="row q-mb-xs">
              <div class="col-5 text-grey-7">État :</div>
              <div class="col">
                <q-badge :color="stateColor(stingray.state)">
                  {{ stateLabel(stingray.state) }}
                </q-badge>
              </div>
            </div>
            <div class="row q-mb-xs">
              <div class="col-5 text-grey-7">Alarme :</div>
              <div class="col">
                <q-badge :color="alarmColor(stingray.alarmLevel)">
                  {{ alarmLabel(stingray.alarmLevel) }}
                  <span v-if="stingray.recentAlarms">
                    ({{ stingray.recentAlarms.length }})
                  </span>
                </q-badge>
              </div>
            </div>
            <div class="row q-mb-xs" v-if="hasMissingPosition(stingray)">
              <div class="col-5 text-grey-7">Emplacement :</div>
              <div class="col">
                <q-badge color="negative">Emplacement manquant</q-badge>
              </div>
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
                  v-model="positionForm.location"
                  :options="locationOptions"
                  label="Emplacement"
                  outlined
                  dense
                  emit-value
                  map-options
                />
              </div>
              <div class="col-6">
                <q-select
                  v-model="positionForm.floor"
                  :options="floorOptions"
                  label="Étage"
                  outlined
                  dense
                  emit-value
                  map-options
                  :disable="!isAisleSelected"
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
                  :disable="
                    !positionForm.location ||
                    (isAisleSelected && !positionForm.floor)
                  "
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
              <q-item v-for="entry in visiblePositionHistory" :key="entry.id">
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
            <div
              v-if="positionHistory.length > POSITION_HISTORY_PAGE_SIZE"
              class="text-center q-mt-sm"
            >
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                :label="showAllPositionHistory ? 'Afficher moins' : 'Afficher plus'"
                @click="showAllPositionHistory = !showAllPositionHistory"
              />
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

      <!-- Alarmes récentes -->
      <div class="col-12">
        <q-card flat bordered>
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
    </div>

    <div v-else class="text-center text-grey-7 q-pa-xl">
      <q-spinner v-if="loading" color="primary" size="3em" />
      <div v-else>Stingray introuvable.</div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuasar, QSpinnerFacebook } from "quasar";
import dayjs from "dayjs";
import { api } from "boot/axios";
import { useAppStore } from "stores/app";
import { useStingraysStore } from "stores/stingrays";

const route = useRoute();
const router = useRouter();
const $q = useQuasar();
const App = useAppStore();
const stingraysStore = useStingraysStore();

// Réactif (pas une simple constante) : le voyage rapide navigue vers une
// nouvelle route avec un :stingrayId différent sans démonter le composant,
// il faut donc recharger les données quand ce paramètre change (cf. watch
// plus bas, juste après la déclaration de loadAll).
const stingrayId = computed(() => route.params.stingrayId);

const quickJumpNumber = ref(null);
const goToQuickJump = async () => {
  if (!quickJumpNumber.value) return;
  try {
    const target = await stingraysStore.fetchStingrayByNumber(
      quickJumpNumber.value
    );
    quickJumpNumber.value = null;
    router.push({ name: "stingray-details", params: { stingrayId: target.id } });
  } catch (error) {
    $q.notify({
      type: "negative",
      message: `Stingray n°${quickJumpNumber.value} introuvable`,
      caption: error.message,
    });
  }
};

const stingray = ref(null);
const positionHistory = ref([]);
const interventions = ref([]);
const aisles = ref([]);
const loading = ref(false);

const POSITION_HISTORY_PAGE_SIZE = 3;
const showAllPositionHistory = ref(false);
const visiblePositionHistory = computed(() =>
  showAllPositionHistory.value
    ? positionHistory.value
    : positionHistory.value.slice(0, POSITION_HISTORY_PAGE_SIZE)
);

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

// Emplacements hors-allée fixes (pas de saisie libre)
const SPECIAL_LOCATIONS = ["Maintenance stingray", "Stock", "TGW"];

// Select unique : allées non pleines (value = "aisle:<id>") + emplacements
// fixes (value = "label:<texte>"). Une allée dont tous les étages sont déjà
// occupés est masquée (le stingray courant est exclu du décompte, cf. l'appel
// à fetchAisles ci-dessous, pour qu'il puisse garder/re-choisir sa position).
const locationOptions = computed(() => [
  ...aisles.value
    .filter((a) => (a.occupiedCount || 0) < a.floorsCount)
    .map((a) => ({ value: `aisle:${a.id}`, label: a.name })),
  ...SPECIAL_LOCATIONS.map((label) => ({ value: `label:${label}`, label })),
]);

const isAisleSelected = computed(() =>
  positionForm.value.location?.startsWith("aisle:")
);
const selectedAisleId = computed(() =>
  isAisleSelected.value
    ? Number(positionForm.value.location.slice("aisle:".length))
    : null
);
const selectedAisleFloors = computed(() => {
  const aisle = aisles.value.find((a) => a.id === selectedAisleId.value);
  return aisle?.floorsCount || 28;
});
// Étages déjà occupés par un autre stingray dans l'allée sélectionnée (le
// stingray courant est exclu, pour qu'il puisse re-choisir sa propre position)
const occupiedFloors = ref([]);
const floorOptions = computed(() =>
  Array.from({ length: selectedAisleFloors.value }, (_, i) => i + 1)
    .filter((n) => !occupiedFloors.value.includes(n))
    .map((n) => ({ value: n, label: String(n) }))
);

const positionLabel = (s) => {
  if (s.currentAisle && s.currentFloor) {
    return `${s.currentAisle.name} - Étage ${s.currentFloor}`;
  }
  return s.currentLocationLabel || stateLabel(s.state);
};

// En service mais sans position en allée = état incohérent à signaler
const hasMissingPosition = (s) =>
  s.state === "in_service" && !(s.currentAisle && s.currentFloor);

const formatDate = (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A");
const formatDateTime = (date) =>
  date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "N/A";

const positionForm = ref({
  location: null,
  floor: null,
  movedAt: dayjs().format("YYYY-MM-DDTHH:mm"),
});

// Réinitialise l'étage choisi si l'emplacement change (allée différente, ou
// passage vers un emplacement hors-allée qui n'a pas d'étage)
watch(
  () => positionForm.value.location,
  () => {
    positionForm.value.floor = null;
  }
);

// Recharge les étages déjà occupés quand l'allée sélectionnée change (le
// stingray courant est exclu, pour qu'il puisse re-choisir sa propre position)
watch(selectedAisleId, async (aisleId) => {
  if (!aisleId) {
    occupiedFloors.value = [];
    return;
  }
  try {
    occupiedFloors.value = await stingraysStore.fetchOccupiedFloors(
      aisleId,
      stingrayId.value
    );
  } catch (error) {
    console.error("Error fetching occupied floors:", error);
    occupiedFloors.value = [];
  }
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
  stingray.value = await stingraysStore.fetchStingray(stingrayId.value);
};

const loadPositionHistory = async () => {
  positionHistory.value = await stingraysStore.fetchPositionHistory(
    stingrayId.value
  );
};

const loadInterventions = async () => {
  interventions.value = await stingraysStore.fetchInterventions(
    stingrayId.value
  );
};

const loadAll = async () => {
  loading.value = true;
  $q.loading.show({
    spinner: QSpinnerFacebook,
    spinnerColor: "primary",
    spinnerSize: 160,
    backgroundColor: "dark",
    message: "Chargement du stingray...",
    messageColor: "white",
  });
  try {
    await Promise.all([
      loadStingray(),
      loadPositionHistory(),
      loadInterventions(),
      stingraysStore
        .fetchAisles(stingrayId.value)
        .then((data) => (aisles.value = data)),
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
    $q.loading.hide();
  }
};

const addPosition = async () => {
  try {
    await stingraysStore.addPosition(stingrayId.value, {
      aisleId: isAisleSelected.value ? selectedAisleId.value : null,
      floor: isAisleSelected.value ? positionForm.value.floor : null,
      locationLabel: isAisleSelected.value
        ? null
        : positionForm.value.location?.slice("label:".length) || null,
      movedAt: positionForm.value.movedAt,
    });
    $q.notify({ type: "positive", message: "Position enregistrée" });
    positionForm.value.location = null;
    positionForm.value.floor = null;
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
      stingrayId: stingrayId.value,
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

// Voyage rapide : navigue vers une nouvelle route sans démonter le composant,
// il faut donc recharger explicitement les données à chaque changement d'id
watch(stingrayId, () => {
  positionForm.value.location = null;
  positionForm.value.floor = null;
  positionForm.value.movedAt = dayjs().format("YYYY-MM-DDTHH:mm");
  occupiedFloors.value = [];
  interventionForm.value.plannedDate = dayjs().format("YYYY-MM-DD");
  showAllPositionHistory.value = false;
  loadAll();
});
</script>

<style scoped></style>
