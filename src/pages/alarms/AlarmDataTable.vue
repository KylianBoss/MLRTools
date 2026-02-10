<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">Données d'alarmes</div>
      <q-btn
        color="primary"
        icon="refresh"
        label="Rafraîchir"
        @click="loadAlarmData"
      />
    </div>

    <q-table
      :rows="alarmData"
      :columns="columns"
      v-model:pagination="pagination"
      :rows-per-page-options="[10, 20, 50, 100]"
      row-key="dbId"
      wrap-cells
      flat
      bordered
      :loading="loading"
      @request="onRequest"
    >
      <template v-slot:top>
        <q-space />
        <q-input
          v-model="dateFrom"
          label="Date de début"
          type="date"
          dense
          class="q-mr-sm"
          style="width: 200px"
        />
        <q-input
          v-model="dateTo"
          label="Date de fin"
          type="date"
          dense
          class="q-mr-sm"
          style="width: 200px"
        />
        <q-btn
          color="primary"
          icon="search"
          label="Rechercher"
          @click="loadAlarmData"
        />
      </template>

      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="dbId" :props="props">
            {{ props.row.dbId }}
          </q-td>
          <q-td key="timeOfOccurence" :props="props">
            {{ formatDateTime(props.row.timeOfOccurence) }}
          </q-td>
          <q-td key="timeOfAcknowledge" :props="props">
            {{ formatDateTime(props.row.timeOfAcknowledge) }}
          </q-td>
          <q-td key="duration" :props="props">
            {{ formatDuration(props.row.duration) }}
          </q-td>
          <q-td key="dataSource" :props="props">
            {{ props.row.dataSource }}
          </q-td>
          <q-td key="alarmArea" :props="props">
            {{ props.row.alarmArea }}
          </q-td>
          <q-td key="alarmCode" :props="props">
            {{ props.row.alarmCode }}
          </q-td>
          <q-td key="alarmText" :props="props">
            {{ props.row.alarmText }}
          </q-td>
          <q-td key="severity" :props="props">
            <q-badge
              :color="getSeverityColor(props.row.severity)"
              :label="props.row.severity"
            />
          </q-td>
          <q-td key="classification" :props="props">
            {{ props.row.classification }}
          </q-td>
          <q-td key="assignedUser" :props="props">
            {{ props.row.assignedUser }}
          </q-td>
          <q-td key="alarmId" :props="props">
            {{ props.row.alarmId }}
          </q-td>
          <!-- Actionable x_ fields -->
          <q-td
            key="x_state"
            :props="props"
            class="cursor-pointer"
            @click="editState(props.row)"
          >
            <q-badge :color="getStateColor(props.row.x_state)">
              {{ props.row.x_state || "Non défini" }}
            </q-badge>
            <q-icon name="edit" size="xs" class="q-ml-xs" />
          </q-td>
          <q-td
            key="x_group"
            :props="props"
            class="cursor-pointer"
            @click="editGroup(props.row)"
          >
            {{ props.row.x_group || "—" }}
            <q-icon name="edit" size="xs" class="q-ml-xs" />
          </q-td>
          <q-td
            key="x_treated"
            :props="props"
            class="cursor-pointer"
            @click="toggleTreated(props.row)"
          >
            <q-checkbox
              :model-value="props.row.x_treated"
              @update:model-value="updateTreated(props.row, $event)"
              dense
            />
          </q-td>
          <q-td
            key="x_comment"
            :props="props"
            class="cursor-pointer"
            @click="editComment(props.row)"
          >
            <div class="ellipsis" style="max-width: 200px">
              {{ props.row.x_comment || "—" }}
            </div>
            <q-icon name="edit" size="xs" class="q-ml-xs" />
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useQuasar } from "quasar";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";

dayjs.extend(duration);

const $q = useQuasar();

const alarmData = ref([]);
const loading = ref(false);
const dateFrom = ref(dayjs().subtract(7, "days").format("YYYY-MM-DD"));
const dateTo = ref(dayjs().format("YYYY-MM-DD"));

const pagination = ref({
  sortBy: "timeOfOccurence",
  descending: true,
  page: 1,
  rowsPerPage: 20,
  rowsNumber: 0,
});

const columns = [
  {
    name: "dbId",
    label: "ID",
    field: "dbId",
    align: "left",
    sortable: true,
  },
  {
    name: "timeOfOccurence",
    label: "Date d'occurrence",
    field: "timeOfOccurence",
    align: "left",
    sortable: true,
  },
  {
    name: "timeOfAcknowledge",
    label: "Date d'accusé",
    field: "timeOfAcknowledge",
    align: "left",
    sortable: true,
  },
  {
    name: "duration",
    label: "Durée",
    field: "duration",
    align: "left",
    sortable: true,
  },
  {
    name: "dataSource",
    label: "Source",
    field: "dataSource",
    align: "left",
    sortable: true,
  },
  {
    name: "alarmArea",
    label: "Zone",
    field: "alarmArea",
    align: "left",
    sortable: true,
  },
  {
    name: "alarmCode",
    label: "Code",
    field: "alarmCode",
    align: "left",
    sortable: true,
  },
  {
    name: "alarmText",
    label: "Texte",
    field: "alarmText",
    align: "left",
  },
  {
    name: "severity",
    label: "Sévérité",
    field: "severity",
    align: "left",
    sortable: true,
  },
  {
    name: "classification",
    label: "Classification",
    field: "classification",
    align: "left",
  },
  {
    name: "assignedUser",
    label: "Utilisateur",
    field: "assignedUser",
    align: "left",
  },
  {
    name: "alarmId",
    label: "ID Alarme",
    field: "alarmId",
    align: "left",
  },
  {
    name: "x_state",
    label: "État",
    field: "x_state",
    align: "center",
    sortable: true,
  },
  {
    name: "x_group",
    label: "Groupe",
    field: "x_group",
    align: "left",
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
];

const loadAlarmData = async () => {
  loading.value = true;
  try {
    const response = await api.get("/alarms", {
      params: {
        startRow: (pagination.value.page - 1) * pagination.value.rowsPerPage,
        count: pagination.value.rowsPerPage,
        filter: {
          date: {
            from: dayjs(dateFrom.value).format("YYYY-MM-DD 00:00:00"),
            to: dayjs(dateTo.value).format("YYYY-MM-DD 23:59:59"),
          },
          excluded: false,
          excludedCode: false,
        },
        sortBy: pagination.value.sortBy,
        descending: pagination.value.descending,
        sum: false,
      },
    });
    alarmData.value = response.data;

    // Get total count
    const countResponse = await api.get("/alarms/count", {
      params: {
        date: {
          from: dayjs(dateFrom.value).format("YYYY-MM-DD 00:00:00"),
          to: dayjs(dateTo.value).format("YYYY-MM-DD 23:59:59"),
        },
        excluded: false,
        excludedCode: false,
      },
    });
    pagination.value.rowsNumber = countResponse.data;
  } catch (error) {
    console.error("Error loading alarm data:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des données",
    });
  } finally {
    loading.value = false;
  }
};

const onRequest = async (props) => {
  pagination.value = props.pagination;
  await loadAlarmData();
};

const formatDateTime = (date) => {
  return date ? dayjs(date).format("DD.MM.YYYY HH:mm:ss") : "—";
};

const formatDuration = (seconds) => {
  if (!seconds) return "—";
  return dayjs.duration(seconds, "seconds").format("HH:mm:ss");
};

const getSeverityColor = (severity) => {
  const colors = {
    Critical: "red",
    Warning: "orange",
    Info: "blue",
    Normal: "green",
  };
  return colors[severity] || "grey";
};

const getStateColor = (state) => {
  const colors = {
    unplanned: "orange",
    planned: "blue",
    resolved: "green",
    cancelled: "grey",
  };
  return colors[state] || "grey";
};

const editState = (row) => {
  $q.dialog({
    title: "Modifier l'état",
    message: "Sélectionnez un nouvel état pour cette alarme",
    options: {
      type: "radio",
      model: row.x_state || "unplanned",
      items: [
        { label: "Non planifié", value: "unplanned" },
        { label: "Planifié", value: "planned" },
        { label: "Résolu", value: "resolved" },
        { label: "Annulé", value: "cancelled" },
      ],
    },
    cancel: true,
    persistent: false,
  }).onOk(async (data) => {
    try {
      await api.post("/alarms/update-state", {
        dbId: row.dbId,
        x_state: data,
      });
      row.x_state = data;
      $q.notify({
        type: "positive",
        message: "État mis à jour",
      });
    } catch (error) {
      console.error("Error updating state:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la mise à jour",
      });
    }
  });
};

const editGroup = (row) => {
  $q.dialog({
    title: "Modifier le groupe",
    message: "Entrez le groupe pour cette alarme",
    prompt: {
      model: row.x_group || "",
      type: "text",
    },
    cancel: true,
    persistent: false,
  }).onOk(async (data) => {
    try {
      await api.post("/alarms/update-group", {
        dbId: row.dbId,
        x_group: data,
      });
      row.x_group = data;
      $q.notify({
        type: "positive",
        message: "Groupe mis à jour",
      });
    } catch (error) {
      console.error("Error updating group:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la mise à jour",
      });
    }
  });
};

const toggleTreated = (row) => {
  updateTreated(row, !row.x_treated);
};

const updateTreated = async (row, value) => {
  try {
    await api.post("/alarms/update-treated", {
      dbId: row.dbId,
      x_treated: value,
    });
    row.x_treated = value;
    $q.notify({
      type: "positive",
      message: "Statut de traitement mis à jour",
    });
  } catch (error) {
    console.error("Error updating treated status:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la mise à jour",
    });
  }
};

const editComment = (row) => {
  $q.dialog({
    title: "Modifier le commentaire",
    message: "Entrez un commentaire pour cette alarme",
    prompt: {
      model: row.x_comment || "",
      type: "textarea",
    },
    cancel: true,
    persistent: false,
  }).onOk(async (data) => {
    try {
      await api.post("/alarms/update-comment", {
        dbId: row.dbId,
        x_comment: data,
      });
      row.x_comment = data;
      $q.notify({
        type: "positive",
        message: "Commentaire mis à jour",
      });
    } catch (error) {
      console.error("Error updating comment:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la mise à jour",
      });
    }
  });
};

onMounted(() => {
  loadAlarmData();
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
.cursor-pointer:hover {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>
