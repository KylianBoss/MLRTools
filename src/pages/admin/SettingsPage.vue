<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Paramètres</div>

    <q-table
      :rows="settings"
      :columns="columns"
      row-key="key"
      :loading="loading"
      flat
      bordered
      :pagination="{ rowsPerPage: 0 }"
      hide-pagination
    >
      <template v-slot:body-cell-value="props">
        <q-td :props="props">
          <span>{{ truncateValue(props.row.value) }}</span>
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            flat
            dense
            round
            icon="mdi-pencil-outline"
            @click="startEdit(props.row)"
          />
        </q-td>
      </template>

      <template v-slot:body-cell-updatedAt="props">
        <q-td :props="props">
          {{ props.row.updatedAt ? new Date(props.row.updatedAt).toLocaleString("fr-FR") : "—" }}
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="editDialogOpen" @hide="cancelEdit">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ editingRow?.key }}</div>
          <div v-if="editingRow?.description" class="text-caption text-grey">
            {{ editingRow.description }}
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="editValue"
            dense
            autofocus
            autogrow
            @keyup.enter.ctrl="saveEdit(editingRow)"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" @click="editDialogOpen = false" />
          <q-btn flat label="Enregistrer" color="positive" @click="saveEdit(editingRow)" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const VALUE_DISPLAY_MAX_LENGTH = 20;

const $q = useQuasar();
const settings = ref([]);
const loading = ref(false);
const editDialogOpen = ref(false);
const editingRow = ref(null);
const editValue = ref("");

const truncateValue = (value) => {
  if (value == null) return "";
  const text = String(value);
  return text.length > VALUE_DISPLAY_MAX_LENGTH
    ? `${text.slice(0, VALUE_DISPLAY_MAX_LENGTH)}…`
    : text;
};

const columns = [
  {
    name: "key",
    label: "Clé",
    field: "key",
    align: "left",
    sortable: true,
  },
  {
    name: "value",
    label: "Valeur",
    field: "value",
    align: "left",
  },
  {
    name: "description",
    label: "Description",
    field: "description",
    align: "left",
  },
  {
    name: "updatedAt",
    label: "Dernière modification",
    field: "updatedAt",
    align: "left",
    sortable: true,
  },
  {
    name: "actions",
    label: "",
    field: "actions",
    align: "right",
  },
];

const fetchSettings = async () => {
  loading.value = true;
  try {
    const response = await api.get("/settings");
    settings.value = response.data;
  } catch (error) {
    $q.notify({ type: "negative", message: "Erreur lors du chargement des paramètres" });
  } finally {
    loading.value = false;
  }
};

const startEdit = (row) => {
  editingRow.value = row;
  editValue.value = row.value;
  editDialogOpen.value = true;
};

const cancelEdit = () => {
  editDialogOpen.value = false;
  editingRow.value = null;
  editValue.value = "";
};

const saveEdit = async (row) => {
  if (!row) return;
  if (editValue.value === row.value) {
    cancelEdit();
    return;
  }
  try {
    const response = await api.put(`/settings/${row.key}`, { value: editValue.value });
    const idx = settings.value.findIndex((s) => s.key === row.key);
    if (idx !== -1) settings.value[idx] = response.data;
    $q.notify({ type: "positive", message: `Paramètre "${row.key}" mis à jour` });
  } catch (error) {
    $q.notify({ type: "negative", message: "Erreur lors de la sauvegarde" });
  } finally {
    cancelEdit();
  }
};

onMounted(fetchSettings);
</script>
