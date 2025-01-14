<template>
  <q-page padding>
    <div class="text-h4">TGW Rapport zones</div>
    <div>
      Rapport pour lier les alarmes aux bonnes zones du rapport TGW afin
      d'extraire les bons chiffres.
    </div>
    <div class="row">
      <div class="col">
        <q-table
          :rows="
            dataLogStore.alarms
              .filter((alarm) => {
                return (
                  (!filter.dataSource ||
                    alarm.dataSource
                      .toUpperCase()
                      .includes(filter.dataSource.toUpperCase())) &&
                  (!filter.alarmArea ||
                    alarm.alarmArea
                      .toUpperCase()
                      .includes(filter.alarmArea.toUpperCase())) &&
                  (!filter.alarmCode ||
                    alarm.alarmCode
                      .toUpperCase()
                      .includes(filter.alarmCode.toUpperCase())) &&
                  (!filter.zone ||
                    alarm.TGWzone.toUpperCase().includes(
                      filter.zone.toUpperCase()
                    ))
                );
              })
              .map((alarm) => {
                return {
                  dataSource: alarm.dataSource.toUpperCase(),
                  alarmArea: alarm.alarmArea.toUpperCase(),
                  alarmCode: alarm.alarmCode.toUpperCase(),
                  zone: alarm.TGWzone ? alarm.TGWzone.zone : null,
                  alarmId: alarm.alarmId,
                };
              })
          "
          row-key="alarmId"
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[10, 20, 50]"
          :filter="filter.search"
        >
          <!-- zone is a select -->
          <template v-slot:body-cell-zone="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <!-- <q-select
                v-model="props.row.zone"
                :options="zoneOptions"
                emit-value
                map-options
                use-chips
                use-input
                option-value="zone"
                option-label="zone"
                @update:model-value="dataLogStore.updateAlarmZone(props.row)"
                @keydown.enter="handleEnter($event, props.row)"
              /> -->
                  <q-input
                    @keydown.enter="handleEnter($event, props.row)"
                    @keydown.tab="handleEnter($event, props.row)"
                  />
                </div>
                <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone"
                    :color="zoneColors[props.row.zone]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone }}
                  </q-avatar>
                </div>
              </div>
            </q-td>
          </template>
          <!-- alarm id is a link to the alarm list -->
          <template v-slot:body-cell-alarmId="props">
            <q-td>
              <router-link
                :to="{
                  name: 'alarm-list',
                  query: { alarmId: props.row.alarmId },
                }"
                class="text-primary"
              >
                {{ props.row.alarmId }}
              </router-link>
            </q-td>
          </template>
          <template v-slot:top>
            <q-tr>
              <q-td>
                <q-input
                  v-model="filter.search"
                  label="Rechercher"
                  color="primary"
                  dense
                  class="full-width"
                />
              </q-td>
              <q-td>
                Traité :
                {{
                  dataLogStore.alarms.filter((alarm) => alarm.TGWzone).length
                }}
                / {{ dataLogStore.alarms.length }} ({{
                  Math.round(
                    (dataLogStore.alarms.filter((alarm) => alarm.TGWzone)
                      .length /
                      dataLogStore.alarms.length) *
                      100
                  )
                }}%)
              </q-td>
            </q-tr>
            <q-tr>
              <q-th key="dataSource">
                <q-input
                  v-model="filter.dataSource"
                  :debounce="300"
                  placeholder="Filtrer par data source"
                />
              </q-th>
              <q-th key="alarmArea">
                <q-input
                  v-model="filter.alarmArea"
                  :debounce="300"
                  placeholder="Filtrer par alarm area"
                />
              </q-th>
              <q-th key="alarmCode">
                <q-input
                  v-model="filter.alarmCode"
                  :debounce="300"
                  placeholder="Filtrer par alarm code"
                />
              </q-th>
              <q-th key="zone">
                <q-input
                  v-model="filter.zone"
                  :debounce="300"
                  placeholder="Filtrer par zone TGW"
                />
              </q-th>
            </q-tr>
          </template>
        </q-table>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useAppStore } from "stores/app";
import { useDataLogStore } from "stores/datalog";
import { useQuasar } from "quasar";

const App = useAppStore();
const dataLogStore = useDataLogStore();
const filter = ref({
  search: null,
  dataSource: null,
  alarmArea: null,
  alarmCode: null,
  zone: null,
});
const zoneOptions = ref([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "XX",
]);
const zoneColors = ref({
  A: "red",
  B: "orange",
  C: "yellow",
  D: "green",
  E: "teal",
  F: "blue",
  G: "purple",
  H: "pink",
  I: "brown",
  J: "grey",
  K: "red",
  L: "orange",
  M: "yellow",
  N: "green",
  O: "teal",
  P: "blue",
  Q: "purple",
  R: "pink",
  S: "brown",
  T: "grey",
  U: "red",
  V: "orange",
  W: "yellow",
  X: "green",
  Y: "teal",
  Z: "blue",
  AA: "purple",
  AB: "pink",
  AC: "brown",
  AD: "grey",
  AE: "red",
  AF: "orange",
  AG: "yellow",
  XX: "black",
});
const $q = useQuasar();

const handleEnter = (event, row) => {
  if (zoneOptions.value.includes(event.target.value.toUpperCase())) {
    const newZone = event.target.value.toUpperCase();
    if (row.zone !== newZone && row.zone && row.zone.length > 0) {
      $q.dialog({
        title: "Changement de zone",
        message: `Voulez-vous vraiment changer la zone de l'alarme ${row.alarmId} de ${row.zone} à ${newZone} ?`,
        ok: "Oui",
        cancel: "Non",
      })
        .onOk(() => {
          row.zone = newZone;
          dataLogStore.updateAlarmZone(row);
          event.target.blur();
        })
        .onCancel(() => {
          return;
        });
    } else {
      row.zone = newZone;
      event.target.blur();
      dataLogStore.updateAlarmZone(row);
    }
  } else {
    $q.notify({
      type: "negative",
      message: "Zone invalide",
      actions: [{ icon: "close", color: "white" }],
      position: "top",
      timeout: 1000,
    });
  }
};

onMounted(async () => {
  dataLogStore.initialize();
});
</script>

<style></style>
