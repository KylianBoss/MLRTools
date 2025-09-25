<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 80%">
      <q-card-section>
        <div v-if="props.chartData" class="text-h6">Modifier le graphique</div>
        <div v-else class="text-h6">Créer un nouveau graphique</div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="chart.chartName"
          label="Nom du graphique"
          outlined
          dense
          class="full-width"
          :disable="!!chart.id"
        />
        <q-input
          v-model="chart.createdByName"
          label="Créé par"
          outlined
          dense
          class="full-width q-mt-sm"
          :disable="!!chart.id"
          v-if="!!chart.createdBy"
        />
      </q-card-section>
      <!-- Alarm selection -->
      <q-card-section>
        <q-table
          :rows="alarmList"
          row-key="alarmId"
          selection="multiple"
          v-model:selected="chart.alarms"
          :columns="columns"
          row-class="text-uppercase"
          flat
          bordered
          dense
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[0]"
          style="height: 400px"
          :filter="filter"
          :loading="alarmList.length === 0"
        >
          <template v-slot:no-data>
            <div class="text-center full-width q-pa-md">
              <div class="text-h6 text-grey-4 q-mt-md">
                Aucune alarme disponible.
              </div>
            </div>
          </template>

          <template v-slot:top>
            <q-input
              v-model="filter"
              label="Rechercher"
              color="primary"
              dense
              class="full-width"
            >
              <template v-slot:append>
                <q-btn
                  flat
                  color="primary"
                  icon="close"
                  round
                  @click="filter = ''"
                  v-if="filter"
                />
              </template>
              <template v-slot:prepend>
                <q-icon name="mdi-magnify" />
              </template>
              <template v-slot:hint>
                Rechercher par ID d'alarme, source de données, zone d'alarme ou
                code d'alarme
              </template>
            </q-input>
          </template>
        </q-table>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Annuler" color="primary" @click="onDialogHide" />
        <q-btn
          flat
          label="OK"
          color="primary"
          :disable="chart.name?.length > 3 || chart.alarms?.length === 0"
          @click="onOk"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref, onMounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  chartData: {
    type: Object,
    required: false,
  },
});

const chart = ref(
  {
    chartName: "",
    alarms: [],
    ...props.chartData,
  }
);
const alarmList = ref([]);
const columns = [
  {
    name: "dataSource",
    label: "Datasource",
    field: "dataSource",
  },
  { name: "alarmArea", label: "Alarm Area", field: "alarmArea" },
  { name: "alarmCode", label: "Alarm Code", field: "alarmCode" },
  { name: "alarmText", label: "Alarm Text", field: "alarmText" },
];
const filter = ref("");

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const onOk = () => {
  const data = { ...chart.value };
  data.alarms = data.alarms.map((alarm) => alarm.alarmId);
  onDialogOK(data);
};

onMounted(() => {
  api.get("/alarms/unique").then((response) => {
    alarmList.value = response.data.filter((alarm) => alarm.alarmId);
    if (props.chartData?.alarms?.length) {
      chart.value.alarms = alarmList.value.filter((alarm) =>
        props.chartData.alarms.includes(alarm.alarmId)
      );
    }
  });
});
</script>

<style></style>
