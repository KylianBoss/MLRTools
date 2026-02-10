<template>
  <q-page padding>
    <div class="q-mb-md">
      <div class="text-h4 q-mb-sm">Analyse des alarmes quotidiennes</div>
      <div class="text-subtitle2 text-grey-7">
        Analyser et classifier les alarmes primaires de la veille ({{
          yesterdayDate
        }})
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Total alarmes</div>
            <div class="text-h5">{{ alarms.length }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Traitées</div>
            <div class="text-h5 text-positive">{{ treatedCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Groupées</div>
            <div class="text-h5 text-info">{{ groupedCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">En attente</div>
            <div class="text-h5 text-warning">{{ pendingCount }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-auto">
        <q-input
          v-model="searchText"
          outlined
          dense
          placeholder="Rechercher..."
          clearable
          style="min-width: 250px"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-btn
          color="primary"
          label="Grouper la sélection"
          icon="link"
          :disable="selectedAlarms.length < 2"
          @click="groupSelectedAlarms"
        />
      </div>
      <div class="col-auto">
        <q-btn
          color="positive"
          label="Marquer comme traité"
          icon="check"
          :disable="selectedAlarms.length === 0"
          @click="markAsTreated"
        />
      </div>
      <div class="col-auto">
        <q-btn
          flat
          color="grey-7"
          label="Actualiser"
          icon="refresh"
          @click="loadAlarms"
        />
      </div>
      <div class="col"></div>
      <div class="col-auto">
        <q-btn-toggle
          v-model="viewMode"
          toggle-color="primary"
          :options="[
            { label: 'Tableau', value: 'table', icon: 'table_chart' },
            { label: 'Groupes', value: 'groups', icon: 'workspaces' },
          ]"
        />
      </div>
      <div class="col-auto">
        <q-toggle
          v-model="showGrouped"
          label="Afficher groupées"
          color="info"
          v-if="viewMode === 'table'"
        />
      </div>
    </div>

    <!-- Group View -->
    <AlarmGroupView
      v-if="viewMode === 'groups'"
      :alarms="alarms"
      @edit-comment="editComment"
      @ungroup="ungroupAlarm"
      @view-details="viewDetails"
    />

    <!-- Alarms Table -->
    <q-table
      v-if="viewMode === 'table'"
      :rows="filteredAlarms"
      :columns="columns"
      row-key="dbId"
      selection="multiple"
      v-model:selected="selectedAlarms"
      :loading="loading"
      flat
      bordered
      :rows-per-page-options="[10, 25, 50, 100]"
      virtual-scroll
    >
      <!-- Group Badge -->
      <template v-slot:body-cell-x_group="props">
        <q-td :props="props">
          <q-badge v-if="props.row.x_group" color="info">
            Groupe {{ props.row.x_group }}
          </q-badge>
          <q-btn
            v-if="props.row.x_group"
            flat
            dense
            round
            size="xs"
            icon="link_off"
            color="grey"
            @click="ungroupAlarm(props.row.dbId)"
          >
            <q-tooltip>Dégrouper</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <!-- Time of Occurrence -->
      <template v-slot:body-cell-timeOfOccurence="props">
        <q-td :props="props">
          {{ formatDate(props.row.timeOfOccurence) }}
        </q-td>
      </template>

      <!-- Time of Acknowledge -->
      <template v-slot:body-cell-timeOfAcknowledge="props">
        <q-td :props="props">
          {{ formatDate(props.row.timeOfAcknowledge) }}
        </q-td>
      </template>

      <!-- Duration -->
      <template v-slot:body-cell-duration="props">
        <q-td :props="props">
          {{ formatDuration(props.row.duration) }}
        </q-td>
      </template>

      <!-- State Toggle -->
      <template v-slot:body-cell-x_state="props">
        <q-td :props="props">
          <q-toggle
            :model-value="props.row.x_state === 'planned'"
            @update:model-value="
              (val) =>
                updateState(props.row.dbId, val ? 'planned' : 'unplanned')
            "
            :color="props.row.x_state === 'planned' ? 'orange' : 'red'"
            checked-icon="event"
            unchecked-icon="warning"
          >
            <q-tooltip>
              {{
                props.row.x_state === "planned" ? "Planifié" : "Non planifié"
              }}
            </q-tooltip>
          </q-toggle>
        </q-td>
      </template>

      <!-- Treated Status -->
      <template v-slot:body-cell-x_treated="props">
        <q-td :props="props">
          <q-icon
            v-if="props.row.x_treated"
            name="check_circle"
            color="positive"
            size="sm"
          />
          <q-icon
            v-else
            name="radio_button_unchecked"
            color="grey-5"
            size="sm"
          />
        </q-td>
      </template>

      <!-- Comment -->
      <template v-slot:body-cell-x_comment="props">
        <q-td :props="props">
          <div class="row items-center no-wrap">
            <div class="col ellipsis" style="max-width: 200px">
              {{ props.row.x_comment || "-" }}
            </div>
            <div class="col-auto">
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="edit"
                color="grey-7"
                @click="editComment(props.row)"
              >
                <q-tooltip>Modifier le commentaire</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-td>
      </template>

      <!-- Actions -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat dense round size="sm" icon="more_vert" color="grey-7">
            <q-menu>
              <q-list style="min-width: 200px">
                <q-item clickable v-close-popup @click="editComment(props.row)">
                  <q-item-section avatar>
                    <q-icon name="comment" />
                  </q-item-section>
                  <q-item-section>Modifier le commentaire</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="markSingleAsTreated(props.row.dbId)"
                >
                  <q-item-section avatar>
                    <q-icon name="check" />
                  </q-item-section>
                  <q-item-section>Marquer comme traité</q-item-section>
                </q-item>
                <q-separator />
                <q-item-label header>Classification</q-item-label>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'primary')"
                >
                  <q-item-section avatar>
                    <q-icon name="error" color="red" />
                  </q-item-section>
                  <q-item-section>Arrêt (Primary)</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'secondary')"
                >
                  <q-item-section avatar>
                    <q-icon name="info" color="blue" />
                  </q-item-section>
                  <q-item-section>Info (Secondary)</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'human')"
                >
                  <q-item-section avatar>
                    <q-icon name="person" color="primary" />
                  </q-item-section>
                  <q-item-section>Humain</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'other')"
                >
                  <q-item-section avatar>
                    <q-icon name="label" color="grey" />
                  </q-item-section>
                  <q-item-section>Autre</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="viewDetails(props.row)">
                  <q-item-section avatar>
                    <q-icon name="info" />
                  </q-item-section>
                  <q-item-section>Voir les détails</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Comment Dialog -->
    <q-dialog v-model="commentDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Modifier le commentaire</div>
          <div class="text-caption text-grey-7">
            {{ currentAlarm?.alarmText }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="commentText"
            type="textarea"
            label="Commentaire"
            rows="4"
            outlined
            autofocus
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" v-close-popup />
          <q-btn label="Enregistrer" color="primary" @click="saveComment" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Details Dialog -->
    <q-dialog v-model="detailsDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Détails de l'alarme</div>
        </q-card-section>

        <q-card-section v-if="currentAlarm">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label caption>ID Base de données</q-item-label>
                <q-item-label>{{ currentAlarm.dbId }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>ID Alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmId }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Heure de début</q-item-label>
                <q-item-label>{{
                  formatDate(currentAlarm.timeOfOccurence)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Heure de fin</q-item-label>
                <q-item-label>{{
                  formatDate(currentAlarm.timeOfAcknowledge)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Durée</q-item-label>
                <q-item-label>{{
                  formatDuration(currentAlarm.duration)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Source de données</q-item-label>
                <q-item-label>{{ currentAlarm.dataSource }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Zone d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmArea }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Code d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmCode }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Texte d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmText }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Sévérité</q-item-label>
                <q-item-label>{{ currentAlarm.severity }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>État</q-item-label>
                <q-item-label>
                  <q-badge
                    :color="
                      currentAlarm.x_state === 'planned' ? 'orange' : 'red'
                    "
                  >
                    {{
                      currentAlarm.x_state === "planned"
                        ? "Planifié"
                        : "Non planifié"
                    }}
                  </q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="currentAlarm.x_group">
              <q-item-section>
                <q-item-label caption>Groupe</q-item-label>
                <q-item-label>
                  <q-badge color="info"
                    >Groupe {{ currentAlarm.x_group }}</q-badge
                  >
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="currentAlarm.x_comment">
              <q-item-section>
                <q-item-label caption>Commentaire</q-item-label>
                <q-item-label>{{ currentAlarm.x_comment }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { api } from "boot/axios";
import { ref, onMounted, computed } from "vue";
import { useQuasar } from "quasar";
import dayjs from "dayjs";
import AlarmGroupView from "src/components/alarms/AlarmGroupView.vue";

const $q = useQuasar();

const alarms = ref([]);
const selectedAlarms = ref([]);
const loading = ref(false);
const showGrouped = ref(true);
const viewMode = ref("table");
const commentDialog = ref(false);
const detailsDialog = ref(false);
const currentAlarm = ref(null);
const commentText = ref("");
const searchText = ref("");

const yesterdayDate = computed(() => {
  return dayjs().subtract(1, "day").format("YYYY-MM-DD");
});

const columns = [
  {
    name: "x_group",
    label: "Groupe",
    field: "x_group",
    align: "center",
    sortable: true,
  },
  {
    name: "timeOfOccurence",
    label: "Début",
    field: "timeOfOccurence",
    align: "left",
    sortable: true,
  },
  {
    name: "timeOfAcknowledge",
    label: "Fin",
    field: "timeOfAcknowledge",
    align: "left",
    sortable: true,
  },
  {
    name: "dataSource",
    label: "Source",
    field: "dataSource",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmArea",
    label: "Zone",
    field: "alarmArea",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmCode",
    label: "Code",
    field: "alarmCode",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmText",
    label: "Texte de l'alarme",
    field: "alarmText",
    align: "left",
    sortable: true,
  },
  {
    name: "duration",
    label: "Durée",
    field: "duration",
    align: "right",
    sortable: true,
  },
  {
    name: "severity",
    label: "Sévérité",
    field: "severity",
    align: "center",
    sortable: true,
  },
  {
    name: "x_state",
    label: "État",
    field: "x_state",
    align: "center",
    sortable: true,
  },
  {
    name: "x_treated",
    label: "Traité",
    field: "x_treated",
    align: "center",
    sortable: true,
  },
  {
    name: "x_comment",
    label: "Commentaire",
    field: "x_comment",
    align: "left",
  },
  {
    name: "actions",
    label: "Actions",
    field: "actions",
    align: "center",
  },
];

const filteredAlarms = computed(() => {
  let filtered = alarms.value;

  // Filter by showGrouped
  if (!showGrouped.value) {
    filtered = filtered.filter((alarm) => !alarm.x_group);
  }

  // Filter by search text
  if (searchText.value && searchText.value.trim() !== "") {
    const search = searchText.value.toLowerCase().trim();
    filtered = filtered.filter((alarm) => {
      return (
        alarm.alarmText?.toLowerCase().includes(search) ||
        alarm.alarmCode?.toLowerCase().includes(search) ||
        alarm.alarmArea?.toLowerCase().includes(search) ||
        alarm.dataSource?.toLowerCase().includes(search) ||
        alarm.severity?.toLowerCase().includes(search) ||
        alarm.x_comment?.toLowerCase().includes(search)
      );
    });
  }

  return filtered;
});

const treatedCount = computed(() => {
  return alarms.value.filter((alarm) => alarm.x_treated).length;
});

const groupedCount = computed(() => {
  return alarms.value.filter((alarm) => alarm.x_group).length;
});

const pendingCount = computed(() => {
  return alarms.value.filter((alarm) => !alarm.x_treated).length;
});

const loadAlarms = async () => {
  loading.value = true;
  try {
    const response = await api.get("/alarms/daily-analysis");
    alarms.value = response.data;
  } catch (error) {
    console.error("Error fetching daily analysis data:", error);
    $q.notify({
      type: "negative",
      message: "Échec du chargement des alarmes",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  return dayjs(dateString).format("YYYY-MM-DD HH:mm:ss");
};

const formatDuration = (seconds) => {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const updateState = async (dbId, state) => {
  try {
    const response = await api.patch("/alarms/update-state", {
      dbId,
      state,
      updateGroup: true,
    });

    // Update all affected alarms in the UI
    if (response.data.affectedDbIds) {
      response.data.affectedDbIds.forEach((affectedDbId) => {
        const alarm = alarms.value.find((a) => a.dbId === affectedDbId);
        if (alarm) {
          alarm.x_state = state;
        }
      });
    }

    const count = response.data.updatedCount || 1;
    $q.notify({
      type: "positive",
      message:
        count > 1
          ? `${count} alarmes marquées comme ${
              state === "planned" ? "planifiées" : "non planifiées"
            }`
          : `Alarme marquée comme ${
              state === "planned" ? "planifiée" : "non planifiée"
            }`,
    });
  } catch (error) {
    console.error("Error updating state:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la mise à jour de l'état",
      caption: error.message,
    });
  }
};

const markAsTreated = async () => {
  try {
    const dbIds = selectedAlarms.value.map((a) => a.dbId);
    await api.patch("/alarms/mark-treated", { dbIds });

    selectedAlarms.value.forEach((selectedAlarm) => {
      const alarm = alarms.value.find((a) => a.dbId === selectedAlarm.dbId);
      if (alarm) {
        alarm.x_treated = true;
      }
    });

    $q.notify({
      type: "positive",
      message: `${dbIds.length} alarme(s) marquée(s) comme traitée(s)`,
    });

    selectedAlarms.value = [];
  } catch (error) {
    console.error("Error marking as treated:", error);
    $q.notify({
      type: "negative",
      message: "Échec du marquage des alarmes comme traitées",
      caption: error.message,
    });
  }
};

const markSingleAsTreated = async (dbId) => {
  try {
    await api.patch("/alarms/mark-treated", { dbIds: [dbId] });
    const alarm = alarms.value.find((a) => a.dbId === dbId);
    if (alarm) {
      alarm.x_treated = true;
    }
    $q.notify({
      type: "positive",
      message: "Alarme marquée comme traitée",
    });
  } catch (error) {
    console.error("Error marking as treated:", error);
    $q.notify({
      type: "negative",
      message: "Échec du marquage de l'alarme comme traitée",
      caption: error.message,
    });
  }
};

const groupSelectedAlarms = async () => {
  if (selectedAlarms.value.length < 2) {
    $q.notify({
      type: "warning",
      message: "Veuillez sélectionner au moins 2 alarmes à grouper",
    });
    return;
  }

  try {
    const dbIds = selectedAlarms.value.map((a) => a.dbId);
    const response = await api.post("/alarms/group-alarms", { dbIds });

    selectedAlarms.value.forEach((selectedAlarm) => {
      const alarm = alarms.value.find((a) => a.dbId === selectedAlarm.dbId);
      if (alarm) {
        alarm.x_group = response.data.groupId;
      }
    });

    $q.notify({
      type: "positive",
      message: `${dbIds.length} alarmes groupées ensemble`,
      caption: `ID du groupe: ${response.data.groupId}`,
    });

    selectedAlarms.value = [];
  } catch (error) {
    console.error("Error grouping alarms:", error);
    $q.notify({
      type: "negative",
      message: "Échec du groupement des alarmes",
      caption: error.message,
    });
  }
};

const ungroupAlarm = async (dbId) => {
  try {
    await api.patch("/alarms/ungroup-alarm", { dbId });
    const alarm = alarms.value.find((a) => a.dbId === dbId);
    if (alarm) {
      alarm.x_group = null;
    }
    $q.notify({
      type: "positive",
      message: "Alarme dégroupée",
    });
  } catch (error) {
    console.error("Error ungrouping alarm:", error);
    $q.notify({
      type: "negative",
      message: "Échec du dégroupement de l'alarme",
      caption: error.message,
    });
  }
};

const editComment = (alarm) => {
  currentAlarm.value = alarm;
  commentText.value = alarm.x_comment || "";
  commentDialog.value = true;
};

const saveComment = async () => {
  try {
    await api.patch("/alarms/update-comment", {
      dbId: currentAlarm.value.dbId,
      comment: commentText.value,
    });

    const alarm = alarms.value.find((a) => a.dbId === currentAlarm.value.dbId);
    if (alarm) {
      alarm.x_comment = commentText.value;
    }

    $q.notify({
      type: "positive",
      message: "Commentaire mis à jour",
    });

    commentDialog.value = false;
    currentAlarm.value = null;
    commentText.value = "";
  } catch (error) {
    console.error("Error updating comment:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la mise à jour du commentaire",
      caption: error.message,
    });
  }
};

const viewDetails = (alarm) => {
  currentAlarm.value = alarm;
  detailsDialog.value = true;
};

const classifyAlarm = async (alarmId, type) => {
  try {
    const endpoint = `/alarms/${type}`;
    await api.post(endpoint, { alarmId });

    $q.notify({
      type: "positive",
      message: `Alarme classifiée comme "${type}"`,
      caption: "Rechargement des alarmes...",
    });

    // Recharger les alarmes après classification
    await loadAlarms();
  } catch (error) {
    console.error("Error classifying alarm:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la classification de l'alarme",
      caption: error.message,
    });
  }
};

onMounted(async () => {
  await loadAlarms();
});
</script>

<style scoped>
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
