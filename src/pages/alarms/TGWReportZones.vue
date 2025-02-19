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
                  zones: alarm.TGWzone || {
                    zones: [],
                  },
                  alarmId: alarm.alarmId,
                };
              })
          "
          row-key="alarmId"
          wrap-cells
          virtual-scroll
          :rows-per-page-options="[10, 20, 50]"
          :filter="filter.search"
          dense
        >
          <!-- zone is a select -->
          <template v-slot:body-cell-zones="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <q-select
                    v-model="props.row.zones.zones"
                    :options="zoneOptions"
                    emit-value
                    map-options
                    use-chips
                    multiple
                    fill-input
                    use-input
                    input-debounce="0"
                    @update:model-value="handleUpdate($event, props.row)"
                    @keypress="handleEnter($event, props.row)"
                  >
                    <template v-slot:selected-item="scope">
                      <q-chip
                        removable
                        dense
                        @remove="handleRemove(scope.opt, props.row)"
                        :tabindex="scope.tabindex"
                        class="q-ma-none"
                      >
                        <q-avatar
                          :color="zoneColors[scope.opt]"
                          text-color="white"
                        >
                          {{ scope.opt }}
                        </q-avatar>
                      </q-chip>
                    </template>
                  </q-select>
                  <!-- <q-input
                    @keydown.enter="handleEnter($event, props.row, 0)"
                    @keydown.tab="handleEnter($event, props.row, 0)"
                  /> -->
                </div>
                <!-- <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone"
                    :color="zoneColors[props.row.zone]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone }}
                  </q-avatar>
                </div> -->
              </div>
            </q-td>
          </template>
          <!-- <template v-slot:body-cell-zone2="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <q-input
                    @keydown.enter="handleEnter($event, props.row, 1)"
                    @keydown.tab="handleEnter($event, props.row, 1)"
                  />
                </div>
                <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone2"
                    :color="zoneColors[props.row.zone2]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone2 }}
                  </q-avatar>
                </div>
              </div>
            </q-td>
          </template>
          <template v-slot:body-cell-zone3="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <q-input
                    @keydown.enter="handleEnter($event, props.row, 2)"
                    @keydown.tab="handleEnter($event, props.row, 2)"
                  />
                </div>
                <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone3"
                    :color="zoneColors[props.row.zone3]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone3 }}
                  </q-avatar>
                </div>
              </div>
            </q-td>
          </template>
          <template v-slot:body-cell-zone4="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <q-input
                    @keydown.enter="handleEnter($event, props.row, 3)"
                    @keydown.tab="handleEnter($event, props.row, 3)"
                  />
                </div>
                <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone4"
                    :color="zoneColors[props.row.zone4]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone4 }}
                  </q-avatar>
                </div>
              </div>
            </q-td>
          </template>
          <template v-slot:body-cell-zone5="props">
            <q-td>
              <div class="row items-center">
                <div class="col">
                  <q-input
                    @keydown.enter="handleEnter($event, props.row, 4)"
                    @keydown.tab="handleEnter($event, props.row, 4)"
                  />
                </div>
                <div class="col col-auto">
                  <q-avatar
                    v-if="props.row.zone5"
                    :color="zoneColors[props.row.zone5]"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ props.row.zone5 }}
                  </q-avatar>
                </div>
              </div>
            </q-td>
          </template> -->
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
              <!-- <q-td>
                <q-btn
                  color="grey"
                  icon="mdi-refresh"
                  @click="refresh"
                  flat
                  round
                />
              </q-td> -->
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
  "SH",
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
  SH: "blue",
  XX: "black",
});
const $q = useQuasar();

const handleUpdate = (event, row) => {
  dataLogStore.updateAlarmZone({
    alarmId: row.alarmId,
    zones: event.sort(),
  });
};
const handleEnter = (event, row) => {
  if (event.code !== "Space") return;

  const newZone = event.target.value.trim().toUpperCase();

  if (newZone.length === 0) return;

  // Check for duplicates
  if ([...row.zones.zones].includes(newZone)) {
    $q.notify({
      type: "negative",
      message: "Zone déjà attribuée",
      actions: [{ icon: "close", color: "white" }],
      position: "top",
      timeout: 1000,
    });
    event.target.value = "";
    return;
  }

  // Check for valid zone
  if (!zoneOptions.value.includes(newZone)) {
    $q.notify({
      type: "negative",
      message: "Zone invalide",
      actions: [{ icon: "close", color: "white" }],
      position: "top",
      timeout: 1000,
    });
    event.target.value = "";
    return;
  }

  // Array of all zones
  const newZones = [...row.zones.zones, newZone].sort();

  // Reset the input
  event.target.value = "";

  // Save the new zones
  dataLogStore.updateAlarmZone({
    alarmId: row.alarmId,
    zones: newZones,
  });

  // Reset the input
  event.target.value = "";
  // let zones = [];
  // if (event.target.value.length > 0 && event.key !== "Backspace") {
  //   const newZone = event.target.value.toUpperCase();
  //   zones = [...row.zones.zones, newZone].sort();
  // } else {
  //   zones = row.zones.zones.slice(0, -1);
  // }
  // console.log(zones);

  // if (zones.some((zone) => !zoneOptions.value.includes(zone))) {
  //   $q.notify({
  //     type: "negative",
  //     message: "Zone invalide",
  //     actions: [{ icon: "close", color: "white" }],
  //     position: "top",
  //     timeout: 1000,
  //   });
  //   return;
  // }

  // // Check for duplicates
  // if (new Set(zones).size !== zones.length) {
  //   return;
  // }

  // Check for too many zones
  // if (zones.length > 5) {
  //   $q.notify({
  //     type: "negative",
  //     message: "Trop de zones",
  //     actions: [{ icon: "close", color: "white" }],
  //     position: "top",
  //     timeout: 1000,
  //   });
  //   return;
  // }

  // dataLogStore
  //   .updateAlarmZone({
  //     alarmId: row.alarmId,
  //     zones,
  //   })
  //   .then(() => {
  //     event.target.blur();
  //     event.target.value = "";
  //     event.target.focus();
  //   });

  // if (zoneOptions.value.includes(event.target.value.toUpperCase())) {
  //   const newZone = event.target.value.toUpperCase();
  //   const zones = [row.zone, row.zone2, row.zone3, row.zone4, row.zone5];
  //   if (zones.includes(newZone)) {
  //     $q.notify({
  //       type: "negative",
  //       message: "Zone déjà attribuée",
  //       actions: [{ icon: "close", color: "white" }],
  //       position: "top",
  //       timeout: 1000,
  //     });
  //     return;
  //   }
  //   if (zones[level] !== newZone && zones[level] && zones[level].length > 0) {
  //     $q.dialog({
  //       title: "Changement de zone",
  //       message: `Voulez-vous vraiment changer la zone de l'alarme ${row.alarmId} de ${zones[level]} à ${newZone} ?`,
  //       ok: "Oui",
  //       cancel: "Non",
  //     })
  //       .onOk(() => {
  //         zones[level] = newZone;
  //         row.zone = zones[0];
  //         row.zone2 = zones[1];
  //         row.zone3 = zones[2];
  //         row.zone4 = zones[3];
  //         row.zone5 = zones[4];
  //         dataLogStore.updateAlarmZone(row);
  //         event.target.blur();
  //       })
  //       .onCancel(() => {
  //         return;
  //       });
  //   } else {
  //     zones[level] = newZone;
  //     event.target.blur();
  //     row.zone = zones[0];
  //     row.zone2 = zones[1];
  //     row.zone3 = zones[2];
  //     row.zone4 = zones[3];
  //     row.zone5 = zones[4];
  //     dataLogStore.updateAlarmZone(row);
  //   }
  // } else {
  //   $q.notify({
  //     type: "negative",
  //     message: "Zone invalide",
  //     actions: [{ icon: "close", color: "white" }],
  //     position: "top",
  //     timeout: 1000,
  //   });
  // }
};
const handleRemove = (zone, row) => {
  const zones = row.zones.zones.filter((z) => z !== zone);
  dataLogStore.updateAlarmZone({
    alarmId: row.alarmId,
    zones,
  });
};
// const refresh = () => {
//   for (const alarm of dataLogStore.alarms) {
//     if (!alarm.TGWzone) continue;
//     dataLogStore.updateAlarmZone({
//       alarmId: alarm.alarmId,
//       zones: alarm.TGWzone.zones.filter((z) => z),
//     });
//   }
// };

onMounted(async () => {
  dataLogStore.initialize();
});
</script>

<style></style>
