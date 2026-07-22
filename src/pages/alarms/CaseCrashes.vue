<template>
  <q-page padding>
    <div class="q-mb-sm">
      <div class="text-h5 q-mb-xs">Chutes de tours de caisses</div>
      <div class="text-caption text-grey-7">
        Enregistrement manuel des chutes de tours de caisses par zone
      </div>
    </div>

    <!-- Add Case Crash Form -->
    <q-card
      flat
      bordered
      class="q-mb-sm"
      v-if="App.userHasAccess('canAccessCaseCrashes')"
    >
      <q-card-section class="q-pa-sm">
        <div class="text-subtitle2 q-mb-sm">Enregistrer une chute</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-4">
            <q-input
              v-model="form.crashDate"
              label="Date de la chute"
              outlined
              dense
              type="date"
            />
          </div>
          <div class="col-12 col-md-4">
            <q-select
              v-model="form.zone"
              :options="ZONES"
              label="Zone"
              outlined
              dense
              emit-value
              map-options
            />
          </div>
          <div class="col-12 col-md-4">
            <q-select
              v-model="form.caseTypes"
              :options="CASE_TYPES"
              label="Types de caisses"
              outlined
              dense
              multiple
              emit-value
              map-options
              use-chips
            />
          </div>
          <div class="col-12 text-right">
            <q-btn
              color="primary"
              dense
              label="Ajouter"
              icon="add"
              @click="addCrash"
              :disable="!isFormValid"
              class="q-px-sm"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Pivot Table -->
    <q-card flat bordered class="q-mb-sm">
      <q-card-section class="q-pa-sm">
        <div class="row items-center q-mb-sm">
          <div class="col">
            <div class="text-subtitle2">Nombre de chutes par zone et par jour</div>
          </div>
          <div class="col-auto">
            <q-btn
              flat
              round
              dense
              icon="refresh"
              color="primary"
              @click="loadAll"
              :loading="loading"
            >
              <q-tooltip>Actualiser</q-tooltip>
            </q-btn>
          </div>
        </div>

        <div class="table-scroll">
          <q-markup-table flat bordered dense separator="cell">
            <thead>
              <tr>
                <th class="text-left date-header">
                  <div class="row items-center no-wrap">
                    <span>Date</span>
                    <q-icon
                      name="filter_alt"
                      size="xs"
                      class="q-ml-xs cursor-pointer"
                      :color="dateFilterActive ? 'primary' : 'grey-6'"
                    >
                      <q-menu anchor="bottom left" self="top left">
                        <div class="q-pa-sm date-filter-menu">
                          <div class="row items-center justify-between q-mb-xs">
                            <div class="text-caption text-grey-7">Filtrer par date</div>
                            <q-btn
                              flat
                              dense
                              no-caps
                              size="sm"
                              label="Tout sélectionner"
                              color="primary"
                              @click="selectAllDates"
                            />
                          </div>
                          <q-tree
                            :nodes="dateFilterTree"
                            node-key="key"
                            tick-strategy="leaf"
                            v-model:ticked="tickedDates"
                            dense
                            default-expand-all
                          />
                        </div>
                      </q-menu>
                    </q-icon>
                  </div>
                </th>
                <th v-for="zone in ZONES" :key="zone" class="text-center">
                  {{ zone }}
                </th>
              </tr>
              <tr class="total-row">
                <th class="text-left">Total</th>
                <th v-for="zone in ZONES" :key="zone" class="text-center">
                  {{ columnTotals[zone] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredPivotRows" :key="row.date">
                <td class="text-left text-weight-medium">
                  {{ formatDate(row.date) }}
                </td>
                <td
                  v-for="zone in ZONES"
                  :key="zone"
                  class="text-center"
                  :class="row[zone] > 0 ? 'text-weight-bold text-negative' : 'text-grey-5'"
                >
                  {{ row[zone] || 0 }}
                </td>
              </tr>
              <tr v-if="filteredPivotRows.length === 0">
                <td :colspan="ZONES.length + 1" class="text-center text-grey-7">
                  Aucune chute enregistrée
                </td>
              </tr>
            </tbody>
            <tfoot v-if="filteredPivotRows.length > 0">
              <tr class="total-row">
                <th class="text-left">Total</th>
                <th v-for="zone in ZONES" :key="zone" class="text-center">
                  {{ columnTotals[zone] }}
                </th>
              </tr>
            </tfoot>
          </q-markup-table>
        </div>
      </q-card-section>
    </q-card>

    <!-- Crashes List -->
    <q-card flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="row items-center q-mb-sm">
          <div class="col">
            <div class="text-subtitle2">
              Détail des chutes
              <q-badge color="primary" :label="filteredCrashes.length" />
            </div>
          </div>
        </div>

        <div v-if="filteredCrashes.length > 0" class="crash-rows">
          <div
            v-for="crash in filteredCrashes"
            :key="crash.id"
            class="crash-row row items-center q-py-sm q-px-sm"
          >
            <div class="col-2">
              <div class="text-weight-medium">
                {{ formatDate(crash.crashDate) }}
              </div>
            </div>
            <div class="col-2">
              <q-badge color="primary" :label="crash.zone" />
            </div>
            <div class="col-4">
              <q-badge
                v-for="caseType in crash.caseTypes"
                :key="caseType"
                color="grey-7"
                :label="caseType"
                class="q-mr-xs"
              />
            </div>
            <div class="col-3 text-grey-7">
              <q-icon name="person" size="xs" class="q-mr-xs" />
              {{ crash.creatorFullname || crash.createdBy }}
            </div>
            <div class="col-1 text-right">
              <div v-if="canModify(crash)" class="row q-gutter-xs justify-end crash-row-actions">
                <q-btn
                  flat
                  dense
                  size="sm"
                  round
                  icon="edit"
                  color="primary"
                  @click="editCrash(crash)"
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
                  @click="deleteCrash(crash.id)"
                >
                  <q-tooltip>Supprimer</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center text-grey-7 q-pa-md">
          <q-icon name="event_busy" size="48px" />
          <div class="q-mt-sm text-caption">Aucune chute enregistrée</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Edit Dialog -->
    <q-dialog v-model="editDialogOpen">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-subtitle1">Modifier la chute</div>
        </q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="editForm.crashDate"
            label="Date de la chute"
            outlined
            dense
            type="date"
          />
          <q-select
            v-model="editForm.zone"
            :options="ZONES"
            label="Zone"
            outlined
            dense
            emit-value
            map-options
          />
          <q-select
            v-model="editForm.caseTypes"
            :options="CASE_TYPES"
            label="Types de caisses"
            outlined
            dense
            multiple
            emit-value
            map-options
            use-chips
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annuler" v-close-popup />
          <q-btn
            color="primary"
            label="Enregistrer"
            @click="saveEdit"
            :disable="!editForm.zone || !editForm.crashDate || editForm.caseTypes.length === 0"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";
import dayjs from "dayjs";
import { useAppStore } from "stores/app";

const $q = useQuasar();
const App = useAppStore();

const ZONES = [
  "F013",
  "X001",
  "X002",
  "X003",
  "X101",
  "X102",
  "X103",
  "X104",
];

const CASE_TYPES = ["A", "B", "C", "E", "H", "U"];

const loading = ref(false);
const crashes = ref([]);
const pivotRows = ref([]);
const tickedDates = ref([]);

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Toutes les dates (chutes + lignes du tableau croisé) pour construire l'arbre de filtre
const allDates = computed(() => {
  const dates = new Set();
  crashes.value.forEach((c) => dates.add(c.crashDate));
  pivotRows.value.forEach((r) => dates.add(r.date));
  return [...dates].sort();
});

const dateFilterTree = computed(() => {
  const years = new Map();

  allDates.value.forEach((date) => {
    const [year, month, day] = date.split("-");
    if (!years.has(year)) {
      years.set(year, new Map());
    }
    const months = years.get(year);
    if (!months.has(month)) {
      months.set(month, new Set());
    }
    months.get(month).add(day);
  });

  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({
      key: `y:${year}`,
      label: year,
      children: [...months.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, days]) => ({
          key: `m:${year}-${month}`,
          label: MONTH_NAMES[parseInt(month, 10) - 1],
          children: [...days]
            .sort()
            .map((day) => ({
              key: `d:${year}-${month}-${day}`,
              label: day,
            })),
        })),
    }));
});

// Coche toutes les dates par défaut dès qu'elles sont chargées
watch(allDates, (dates) => {
  const known = new Set(tickedDates.value.map((k) => k.replace(/^d:/, "")));
  const isFirstLoad = tickedDates.value.length === 0;
  if (isFirstLoad) {
    tickedDates.value = dates.map((d) => `d:${d}`);
    return;
  }
  // Ajoute automatiquement les nouvelles dates (ex: après l'ajout d'une chute)
  dates.forEach((d) => {
    if (!known.has(d)) {
      tickedDates.value.push(`d:${d}`);
    }
  });
});

const selectAllDates = () => {
  tickedDates.value = allDates.value.map((d) => `d:${d}`);
};

const selectedDaySet = computed(() => {
  return new Set(
    tickedDates.value
      .filter((k) => k.startsWith("d:"))
      .map((k) => k.replace(/^d:/, ""))
  );
});

const dateFilterActive = computed(() => {
  return selectedDaySet.value.size < allDates.value.length;
});

const filteredCrashes = computed(() => {
  return crashes.value.filter((c) => selectedDaySet.value.has(c.crashDate));
});

const filteredPivotRows = computed(() => {
  return pivotRows.value.filter((r) => selectedDaySet.value.has(r.date));
});

const form = ref({
  crashDate: dayjs().format("YYYY-MM-DD"),
  zone: null,
  caseTypes: [],
});

const isFormValid = computed(() => {
  return Boolean(form.value.crashDate) && Boolean(form.value.zone) &&
    form.value.caseTypes.length > 0;
});

const columnTotals = computed(() => {
  const totals = {};
  ZONES.forEach((zone) => (totals[zone] = 0));

  filteredPivotRows.value.forEach((row) => {
    ZONES.forEach((zone) => {
      totals[zone] += row[zone] || 0;
    });
  });

  return totals;
});

const editDialogOpen = ref(false);
const editForm = ref({
  id: null,
  crashDate: "",
  zone: null,
  caseTypes: [],
});

const formatDate = (date) => {
  return dayjs(date).format("DD/MM/YYYY");
};

const canModify = (crash) => {
  return crash.createdBy === App.userId;
};

const loadCrashes = async () => {
  const response = await api.get("/case-crashes");
  crashes.value = response.data;
};

const loadPivot = async () => {
  const response = await api.get("/case-crashes/pivot");
  pivotRows.value = response.data.rows.sort((a, b) =>
    b.date.localeCompare(a.date)
  );
};

const loadAll = async () => {
  loading.value = true;
  try {
    await Promise.all([loadCrashes(), loadPivot()]);
  } catch (error) {
    console.error("Error loading case crashes:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des chutes",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const addCrash = async () => {
  if (!isFormValid.value) {
    $q.notify({
      type: "warning",
      message: "Veuillez remplir la date, la zone et au moins un type de caisse",
    });
    return;
  }

  try {
    await api.post("/case-crashes", { ...form.value });

    $q.notify({
      type: "positive",
      message: "Chute enregistrée avec succès",
    });

    form.value = {
      crashDate: dayjs().format("YYYY-MM-DD"),
      zone: null,
      caseTypes: [],
    };

    await loadAll();
  } catch (error) {
    console.error("Error adding case crash:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'ajout de la chute",
      caption: error.response?.data?.error || error.message,
    });
  }
};

const editCrash = (crash) => {
  editForm.value = {
    id: crash.id,
    crashDate: crash.crashDate,
    zone: crash.zone,
    caseTypes: [...crash.caseTypes],
  };
  editDialogOpen.value = true;
};

const saveEdit = async () => {
  try {
    const { id, ...updateData } = editForm.value;
    await api.patch(`/case-crashes/${id}`, updateData);

    $q.notify({
      type: "positive",
      message: "Chute modifiée avec succès",
    });

    editDialogOpen.value = false;
    await loadAll();
  } catch (error) {
    console.error("Error updating case crash:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la modification",
      caption: error.response?.data?.error || error.message,
    });
  }
};

const deleteCrash = async (id) => {
  $q.dialog({
    title: "Confirmer la suppression",
    message: "Êtes-vous sûr de vouloir supprimer cette chute ?",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/case-crashes/${id}`);

      $q.notify({
        type: "positive",
        message: "Chute supprimée",
      });

      await loadAll();
    } catch (error) {
      console.error("Error deleting case crash:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la suppression",
        caption: error.response?.data?.error || error.message,
      });
    }
  });
};

onMounted(async () => {
  await loadAll();
});
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
}

.total-row th {
  background: rgba(0, 0, 0, 0.04);
  font-weight: bold;
}

.date-filter-menu {
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
}

.date-header {
  white-space: nowrap;
}

.crash-rows {
  display: flex;
  flex-direction: column;
}

.crash-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.crash-row:last-child {
  border-bottom: none;
}

.crash-row:hover {
  background: rgba(0, 0, 0, 0.03);
}

.crash-row-actions {
  visibility: hidden;
}

.crash-row:hover .crash-row-actions {
  visibility: visible;
}
</style>
