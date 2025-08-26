<template>
  <q-page padding>
    <div class="text-h4">Defect handling</div>
    <div class="row">
      <div class="col"></div>
    </div>
    <div class="row">
      <div class="col">
        <q-table
          :rows="defects"
          :columns="columns"
          row-key="id"
          class="q-pa-md"
          flat
          bordered
          dense
          :filter="filter"
          :rows-per-page-options="[10, 20, 50, 100, 0]"
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
            <q-space />
            <q-btn
              color="primary"
              icon="mdi-plus"
              label="Ajouter un défaut"
              @click="createDefect"
            />
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from 'stores/app';
import { useRouter } from 'vue-router';
import { useDefectDialog } from 'src/plugins/useDefectDialog';

const App = useAppStore();
const router = useRouter();
const defects = ref([]);
const filter = ref('');
const columns = [
  {
    name: 'id',
    label: 'ID',
    field: 'id',
    align: 'left',
    sortable: true,
  },
  {
    name: 'location',
    label: 'Location',
    field: 'location',
    align: 'left',
    sortable: true,
  },
];
const defectDialog = useDefectDialog();

const createDefect = async () => {
  const data = await defectDialog.open();
  console.log(data);
};

const fetchDefects = async () => {
  try {
    const response = await api.get('/defects');
    defects.value = response.data;
  } catch (error) {
    console.error('Error fetching defects:', error);
  }
};

// onMounted(() => {
//   fetchDefects();
// });
</script>

<style></style>
