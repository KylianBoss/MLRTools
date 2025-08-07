<template>
  <q-page padding>
    <div class="text-h4">Maintenances planifiées</div>
    <!-- <div class="row">
      <div class="col">Période d'affichage :</div>
    </div> -->
    <div class="row">
      <div class="col">
        <q-table
          :rows="maintenances"
          :columns="columns"
          row-key="id"
          class="q-pa-md"
          flat
          bordered
          dense
          :filter="filter"
        >
          <template v-slot:top>
            <q-input
              v-model="filter"
              placeholder="Rechercher..."
              class="q-mb-md"
              dense
              outlined
              debounce="300"
            />
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props" class="text-right">
              <q-btn
                color="positive"
                icon="mdi-play"
                @click="startMaintenance(props.row)"
                flat
                round
                title="Démarrer la maintenance"
                :disable="
                  (props.row.assignedTo &&
                    props.row.assignedTo.id !== App.user.id) ||
                  App.userHasAccess('canStartMaintenance') === false
                "
                v-if="
                  props.row.status === 'scheduled' ||
                  props.row.status === 'assigned'
                "
              />
              <q-btn
                color="warning"
                icon="mdi-play"
                @click="continueMaintenance(props.row)"
                flat
                round
                title="Continuer la maintenance"
                :disable="
                  props.row.assignedTo &&
                  props.row.assignedTo.id !== App.user.id
                "
                v-if="
                  props.row.status === 'in_progress' &&
                  props.row.assignedTo.id == App.user.id
                "
              />
              <q-btn
                icon="mdi-account-arrow-down"
                @click="assignMaintenance(props.row)"
                flat
                round
                v-if="App.isAdmin && props.row.assignedTo == null"
                title="Assigner à un utilisateur"
              />
            </q-td>
          </template>
        </q-table>
      </div>
    </div>
    <q-dialog v-model="assignUserDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section class="text-h6">
          Assigner la maintenance de {{ selectedMaintenance.plan.location }}
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="selectedUser"
            :options="users"
            option-label="fullname"
            option-value="id"
            label="Sélectionnez un utilisateur"
            emit-value
            map-options
            filled
          />
        </q-card-section>
        <q-card-actions>
          <q-btn
            color="primary"
            label="Assigner"
            @click="assignSelectedUser"
          />
          <q-btn flat label="Annuler" @click="assignUserDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import dayjs from "dayjs";
import { useAppStore } from "stores/app";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";

const App = useAppStore();
const router = useRouter();
const $q = useQuasar();
const maintenances = ref([]);
const users = ref([]);
const selectedUser = ref(null);
const selectedMaintenance = ref(null);
const assignUserDialog = ref(false);
const columns = [
  {
    name: "location",
    label: "Emplacement",
    field: (row) => row.plan.location || "N/A",
    value: (row) => row.plan.location || "N/A",
    align: "left",
    sortable: true,
  },
  {
    name: "description",
    label: "Description",
    field: (row) => row.plan.description || "Aucune description",
    value: (row) => row.plan.description || "Aucune description",
    align: "left",
    sortable: true,
  },
  {
    name: "type",
    label: "Type",
    field: (row) => row.plan.type || "N/A",
    value: (row) => row.plan.type || "N/A",
    align: "center",
    sortable: true,
  },
  {
    name: "scheduled",
    label: "Plannifié pour",
    field: (row) => dayjs(row.scheduled).format("DD.MM.YYYY"),
    value: (row) => dayjs(row.scheduled).toDate(),
    align: "center",
    sortable: true,
  },
  {
    name: "status",
    label: "Status",
    field: (row) => {
      switch (row.status) {
        case "scheduled":
          return "Planifié";
        case "assigned":
          return "Assigné";
        case "in_progress":
          return "En cours";
        case "completed":
          return "Terminé";
        case "cancelled":
          return "Annulé";
        default:
          return "Inconnu";
      }
    },
    value: (row) => {
      switch (row.status) {
        case "scheduled":
          return "Planifié";
        case "in_progress":
          return "En cours";
        case "completed":
          return "Terminé";
        default:
          return "Inconnu";
      }
    },
    align: "center",
    sortable: true,
  },
  {
    name: "assignedTo",
    label: "Assigné à",
    field: (row) => (row.assignedTo ? row.assignedTo.fullname : null),
    value: (row) => (row.assignedTo ? row.assignedTo.fullname : null),
    align: "left",
    sortable: true,
  },
  {
    name: "actions",
    label: "Actions",
    field: "actions",
    align: "right",
    sortable: false,
  },
];
const filter = ref("");

const startMaintenance = async (data) => {
  $q.dialog({
    title: "Démarrer la maintenance",
    message: `Êtes-vous sûr de vouloir démarrer la maintenance pour ${data.plan.location}?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      const response = await api.post("/maintenance/start", {
        id: data.id,
        userId: App.user.id,
      });
      if (response.data.success) {
        fetchMaintenances();
        router.push({
          name: "maintenance-actual",
          params: { maintenanceId: data.id },
        });
      } else {
        App.notify("Erreur lors du démarrage de la maintenance", "negative");
      }
    } catch (error) {
      console.error("Error starting maintenance:", error);
      App.notify("Erreur lors du démarrage de la maintenance", "negative");
    }
  });
};

const assignMaintenance = async (data) => {
  selectedUser.value = null;
  assignUserDialog.value = true;
  selectedMaintenance.value = data;
  try {
    const response = await api.get("/users");
    users.value = response.data.map((user) => ({
      id: user.id,
      fullname: user.fullname,
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    App.notify("Erreur lors de la récupération des utilisateurs", "negative");
  }
};

const assignSelectedUser = async () => {
  if (!selectedUser.value) {
    App.notify("Veuillez sélectionner un utilisateur", "warning");
    return;
  }
  try {
    const response = await api.post("/maintenance/assign", {
      maintenanceId: selectedMaintenance.value.id,
      userId: selectedUser.value,
    });
    if (response.data.success) {
      App.notify("Maintenance assignée avec succès", "positive");
      fetchMaintenances();
      assignUserDialog.value = false;
    } else {
      App.notify("Erreur lors de l'assignation de la maintenance", "negative");
    }
  } catch (error) {
    console.error("Error assigning maintenance:", error);
    App.notify("Erreur lors de l'assignation de la maintenance", "negative");
  }
};

const continueMaintenance = async (data) => {
  console.log(data);
  try {
    router.push({
      name: "maintenance-actual",
      params: { maintenanceId: data.id },
    });
  } catch (error) {
    console.error("Error continuing maintenance:", error);
  }
};

const fetchMaintenances = async () => {
  try {
    const response = await api.get("/maintenance/planned");
    maintenances.value = response.data;
  } catch (error) {
    console.error("Error fetching maintenances:", error);
  }
};

onMounted(() => {
  fetchMaintenances();
});
</script>

<style></style>
