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
          <q-input
            v-if="editing === props.row.key"
            v-model="editValue"
            dense
            autofocus
            @keyup.enter="saveEdit(props.row)"
            @keyup.escape="cancelEdit"
          >
            <template v-slot:append>
              <q-btn
                flat
                dense
                round
                icon="mdi-check"
                color="positive"
                @click="saveEdit(props.row)"
              />
              <q-btn
                flat
                dense
                round
                icon="mdi-close"
                color="negative"
                @click="cancelEdit"
              />
            </template>
          </q-input>
          <span v-else>{{ props.row.value }}</span>
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
            v-if="editing !== props.row.key"
          />
        </q-td>
      </template>

      <template v-slot:body-cell-updatedAt="props">
        <q-td :props="props">
          {{ props.row.updatedAt ? new Date(props.row.updatedAt).toLocaleString("fr-FR") : "—" }}
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const $q = useQuasar();
const settings = ref([]);
const loading = ref(false);
const editing = ref(null);
const editValue = ref("");

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
  editing.value = row.key;
  editValue.value = row.value;
};

const cancelEdit = () => {
  editing.value = null;
  editValue.value = "";
};

const saveEdit = async (row) => {
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
