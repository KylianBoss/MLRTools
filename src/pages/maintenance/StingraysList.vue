<template>
  <q-page padding>
    <div class="text-h4">Stingrays</div>
    <div class="text-caption text-grey-7 q-mb-md">
      Suivi de l'état, de la position et du niveau d'alarme des {{ stingrays.length }} stingrays
    </div>
    <div class="row">
      <div class="col">
        <q-table
          :rows="stingrays"
          :columns="columns"
          row-key="id"
          :pagination="{ rowsPerPage: 20 }"
          :filter="filter"
          :loading="loading"
          class="cursor-pointer"
        >
          <template v-slot:top>
            <q-input
              v-model="filter"
              placeholder="Rechercher..."
              debounce="300"
              dense
              outlined
              class="q-mb-md"
              style="min-width: 250px"
            />
            <q-space />
            <q-btn
              v-if="App.userHasAccess('canManageStingrays')"
              color="primary"
              dense
              label="Ajouter un stingray"
              icon="add"
              @click="createDialogOpen = true"
              class="q-mr-sm"
            />
            <q-btn
              flat
              round
              dense
              icon="refresh"
              color="primary"
              @click="load"
              :loading="loading"
            >
              <q-tooltip>Actualiser</q-tooltip>
            </q-btn>
          </template>
          <template v-slot:body="props">
            <q-tr
              :props="props"
              class="cursor-pointer"
              :class="{ 'bg-red-1': hasMissingPosition(props.row) }"
              @click="goToDetails(props.row.id)"
            >
              <q-td key="number" :props="props">
                {{ props.row.number }}
              </q-td>
              <q-td key="state" :props="props">
                <q-badge :color="stateColor(props.row.state)">
                  {{ stateLabel(props.row.state) }}
                </q-badge>
              </q-td>
              <q-td key="position" :props="props">
                {{ positionLabel(props.row) }}
              </q-td>
              <q-td key="alarmLevel" :props="props">
                <q-badge :color="alarmColor(props.row.alarmLevel)">
                  {{ alarmLabel(props.row.alarmLevel) }} ({{ props.row.alarmCount }})
                </q-badge>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </div>
    </div>

    <!-- Create Stingray Dialog -->
    <q-dialog v-model="createDialogOpen">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-subtitle1">Ajouter un stingray</div>
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input
            v-model.number="createForm.number"
            label="Numéro *"
            outlined
            dense
            type="number"
            :min="1"
            hint="Correspond au numéro 'Shuttle N' du datalog"
            autofocus
          />
          <q-select
            v-model="createForm.state"
            :options="stateOptions"
            label="État"
            outlined
            dense
            emit-value
            map-options
          />
          <q-input
            v-model="createForm.notes"
            label="Notes"
            outlined
            dense
            type="textarea"
            rows="2"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            label="Créer"
            @click="submitCreateStingray"
            :disable="!createForm.number"
            :loading="creating"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useStingraysStore } from "stores/stingrays";
import { useAppStore } from "stores/app";
import { useQuasar } from "quasar";

const router = useRouter();
const $q = useQuasar();
const App = useAppStore();
const stingraysStore = useStingraysStore();

const stingrays = ref([]);
const loading = ref(false);
const filter = ref("");
const createDialogOpen = ref(false);
const creating = ref(false);
const createForm = ref({
  number: null,
  state: "in_service",
  notes: "",
});

const columns = [
  {
    name: "number",
    label: "N°",
    align: "left",
    field: "number",
    sortable: true,
  },
  {
    name: "state",
    label: "État",
    align: "left",
    field: "state",
    sortable: true,
  },
  {
    name: "position",
    label: "Position",
    align: "left",
    field: (row) => row,
  },
  {
    name: "alarmLevel",
    label: "Niveau d'alarme",
    align: "left",
    field: "alarmLevel",
    sortable: true,
  },
];

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

const stateOptions = Object.entries(STATE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const stateLabel = (state) => STATE_LABELS[state] || state;
const stateColor = (state) => STATE_COLORS[state] || "grey";
const alarmLabel = (level) => ALARM_LABELS[level] || level;
const alarmColor = (level) => ALARM_COLORS[level] || "grey";

const positionLabel = (row) => {
  if (row.currentAisle && row.currentFloor) {
    return `${row.currentAisle.name} - Étage ${row.currentFloor}`;
  }
  return stateLabel(row.state);
};

// En service mais sans position en allée = état incohérent à signaler
const hasMissingPosition = (row) =>
  row.state === "in_service" && !(row.currentAisle && row.currentFloor);

const goToDetails = (stingrayId) => {
  router.push({ name: "stingray-details", params: { stingrayId } });
};

const submitCreateStingray = async () => {
  creating.value = true;
  try {
    await stingraysStore.createStingray({
      number: createForm.value.number,
      state: createForm.value.state,
      notes: createForm.value.notes || null,
    });
    $q.notify({
      type: "positive",
      message: `Stingray ${createForm.value.number} créé`,
    });
    createDialogOpen.value = false;
    createForm.value = {
      number: null,
      state: "in_service",
      notes: "",
    };
    await load();
  } catch (error) {
    console.error("Error creating stingray:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la création du stingray",
      caption: error.message,
    });
  } finally {
    creating.value = false;
  }
};

const load = async () => {
  loading.value = true;
  try {
    stingrays.value = await stingraysStore.fetchStingrays();
  } catch (error) {
    console.error("Error loading stingrays:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des stingrays",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style scoped></style>
