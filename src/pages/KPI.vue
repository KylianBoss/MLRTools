<template>
  <q-page padding>
    <div class="text-h4">KPI</div>
    <div class="row">
      <div class="col">Période d'affichage :</div>
    </div>
    <div class="row">
      <div class="col">
        <q-date
          v-model="toDisplay"
          :events="days"
          class="full-width"
          minimal
          range
          :navigation-max-year-month="dayjs().format('YYYY/MM')"
          landscape
          title="Période d'affichage"
          first-day-of-week="1"
        />
      </div>
    </div>
    <div class="row q-pt-xs">
      <div class="col">
        <q-expansion-item
          label="Top 3 erreurs - Nombre"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
          v-model="sectionKPITop3"
        >
          <q-table
            :rows="KPITop3Number"
            :columns="[
              {
                name: 'dataSource',
                label: 'Zone',
                align: 'left',
                field: 'dataSource',
              },
              {
                name: 'alarmArea',
                label: 'Zone de l\'alarme',
                align: 'left',
                field: 'alarmArea',
              },
              {
                mame: 'alarmCode',
                label: 'Code de l\'alarme',
                align: 'left',
                field: 'alarmCode',
              },
              {
                name: 'alarmText',
                label: 'Text de l\'alarme',
                align: 'left',
                field: 'alarmText',
              },
              {
                name: 'count',
                label: 'Nombre',
                align: 'right',
                field: 'count',
              },
            ]"
            :rows-per-page-options="[3]"
            hide-bottom
            row-key="date"
            flat
            bordered
            dense
          />
        </q-expansion-item>
      </div>
    </div>
    <div class="row q-pt-xs">
      <div class="col">
        <q-expansion-item
          label="Top 3 erreurs - Durée"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
          v-model="sectionKPITop3"
        >
          <q-table
            :rows="KPITop3Duration"
            :columns="[
              {
                name: 'dataSource',
                label: 'Zone',
                align: 'left',
                field: 'dataSource',
              },
              {
                name: 'alarmArea',
                label: 'Zone de l\'alarme',
                align: 'left',
                field: 'alarmArea',
              },
              {
                mame: 'alarmCode',
                label: 'Code de l\'alarme',
                align: 'left',
                field: 'alarmCode',
              },
              {
                name: 'alarmText',
                label: 'Text de l\'alarme',
                align: 'left',
                field: 'alarmText',
              },
              {
                name: 'duration',
                label: 'Durée',
                align: 'right',
                field: (row) => {
                  return dayjs(row.duration * 1000).format(
                    row.duration > 60 * 60 * 24 ? 'DDj HH:mm:ss' : 'HH:mm:ss'
                  );
                },
              },
            ]"
            :rows-per-page-options="[3]"
            hide-bottom
            row-key="date"
            flat
            bordered
            dense
          />
        </q-expansion-item>
      </div>
    </div>
    <div class="row q-pt-xs">
      <div class="col">
        <q-expansion-item
          label="Top 3 erreurs par zone"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
          v-model="sectionKPITop3Zone"
        >
          <q-expansion-item
            :label="zone.dataSource"
            header-class="bg-primary text-weight-bold text-white"
            expand-icon-class="text-white"
            v-for="zone in KPITop3PerZone"
            :key="zone.dataSource"
            name="zone"
            popup
          >
            <q-table
              :rows="zone.alarms"
              :columns="[
                {
                  name: 'alarmText',
                  label: 'Text de l\'alarme',
                  align: 'left',
                  field: 'alarmText',
                },
                {
                  name: 'alarmArea',
                  label: 'Zone de l\'alarme',
                  align: 'left',
                  field: 'alarmArea',
                },
                {
                  mame: 'alarmCode',
                  label: 'Code de l\'alarme',
                  align: 'left',
                  field: 'alarmCode',
                },
                {
                  name: 'count',
                  label: 'Nombre',
                  align: 'left',
                  field: 'count',
                },
              ]"
              :rows-per-page-options="[3]"
              hide-bottom
              row-key="alarmId"
              flat
              bordered
            />
          </q-expansion-item>
        </q-expansion-item>
      </div>
    </div>
    <div class="row q-pt-xs" v-if="KPITop3Number.length > 0">
      <div class="col">
        <q-expansion-item
          label="Graphiques"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
        >
          <messages-by-day
            :from="toDisplay.from"
            :to="toDisplay.to"
            v-if="typeof toDisplay !== 'string'"
          />
          <errors-per-zone-count :from="toDisplay.from" :to="toDisplay.to" />
        </q-expansion-item>
      </div>
    </div>
    <div
      class="row q-pt-xs"
      v-if="typeof toDisplay == 'string' && dayResume.length > 0"
    >
      <div class="col">
        <q-expansion-item
          label="Résumé de la journée"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
        >
          <div
            class="row full-width"
            v-for="zone in dayResume"
            :key="zone.dataSource"
          >
            <div class="col">
              <div class="row">
                <div class="col">{{ zone.dataSource }}</div>
              </div>
              <div class="row">
                <div class="col col-3">Runtime :</div>
                <div class="col col-3">
                  {{ zone.runtime.toFixed(2) }} minutes
                </div>
                <div class="col col-3">Stoptime :</div>
                <div class="col col-3">
                  {{ zone.stoptime.toFixed(2) }} minutes
                </div>
                <div class="col col-3">Nombre de pannes :</div>
                <div class="col col-3">
                  {{ zone.nbFaillures }}
                </div>
                <div class="col col-3">MTBF :</div>
                <div class="col col-3">{{ zone.MTBF.toFixed(2) }} minutes</div>
                <div class="col col-3">MTTR :</div>
                <div class="col col-3">{{ zone.MTTR.toFixed(2) }} minutes</div>
                <div class="col col-3">Disponibilité :</div>
                <div class="col col-3">
                  {{ (zone.dispo * 100).toFixed(2) }}%
                </div>
              </div>
              <div class="row">
                <div
                  v-for="d in zone.data"
                  :key="d.id"
                  class="text-transparent"
                  :class="d.state == 0 ? 'bg-positive' : 'bg-negative'"
                  :style="`width: ${d.duration}%`"
                  :title="d.alarmText"
                >
                  .
                </div>
              </div>
            </div>
          </div>
        </q-expansion-item>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar, QSpinnerFacebook } from "quasar";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { useDataLogStore } from "stores/datalog";
import MessagesByDay from "src/components/charts/MessagesByDay.vue";
import ErrorsPerZoneCount from "src/components/charts/ErrorsPerZoneCount.vue";
import VueApexCharts from "vue3-apexcharts";

dayjs.extend(isBetween);

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const sectionKPITop3 = ref(false);
const sectionKPITop3Zone = ref(false);
const toDisplay = ref({
  from: dayjs().set("date", 1).format("YYYY/MM/DD"),
  to: dayjs().format("YYYY/MM/DD"),
});
const days = computed(() =>
  dataLogStore.dates.map((date) => dayjs(date).format("YYYY/MM/DD"))
);

const dataSources = [
  "F001",
  "F002",
  "F003",
  "F004",
  "F005",
  "F006",
  "F007",
  "F008",
  "F009",
  "F010",
  "F011",
  "F012",
  "F013",
  "X001",
  "X002",
  "X003",
  "X101",
  "X102",
  "X103",
  "X104",
];
const KPITop3Number = ref([]);
const KPITop3Duration = ref([]);
const KPITop3PerZone = ref([]);
const dayResume = ref([]);

watch(toDisplay, async (newDate, oldValue) => {
  if (JSON.stringify(newDate) === JSON.stringify(oldValue)) return;
  if (newDate === null) return;
  showLoading();

  sectionKPITop3.value = false;
  sectionKPITop3Zone.value = false;

  await getData(newDate);
  sectionKPITop3.value = true;
  $q.loading.hide();
});

const getData = (filter) => {
  return new Promise(async (resolve) => {
    if (typeof filter === "string") {
      const from = dayjs(filter)
        .set("hour", 0)
        .set("minute", 0)
        .set("second", 0)
        .format("YYYY-MM-DD HH:mm:ss");
      const to = dayjs(filter)
        .set("hour", 23)
        .set("minute", 59)
        .set("second", 59)
        .format("YYYY-MM-DD HH:mm:ss");
      const kpiTop3Count = await dataLogStore.getKPItop3Count({
        from,
        to,
        includesExcluded: false,
      });
      const kpiTop3Duration = await dataLogStore.getKPItop3Duration({
        from,
        to,
        includesExcluded: false,
      });
      for (const dataSource of dataSources) {
        const alarms = await dataLogStore.getKPItop3CountPerZone({
          from,
          to,
          dataSource,
          includesExcluded: false,
        });
        KPITop3PerZone.value.push({
          dataSource,
          alarms,
        });
        console.info("Send:", dataSource);
        dataLogStore
          .getDayResume({
            from,
            to,
            dataSource,
          })
          .then((day) => {
            if (day.length === 0) return;
            const totalTimeInSeconds = dayjs(
              day[day.length - 1].timeOfAcknowledge
            ).diff(day[0].timeOfOccurence, "second");
            const runtime = totalTimeInSeconds / 60;
            const stoptime =
              day.reduce((acc, message) => {
                if (message.alarmCode == 0) return acc;
                return acc + message.duration;
              }, 0) / 60;
            const nbFaillures = day.reduce((acc, message) => {
              if (message.alarmCode == 0) return acc;
              return acc + 1;
            }, 0);
            const MTTR = stoptime / nbFaillures;
            const MTBF = runtime / nbFaillures;
            const dispo = MTBF / (MTBF + MTTR);
            dayResume.value.push({
              dataSource,
              runtime,
              stoptime,
              nbFaillures,
              MTBF,
              MTTR,
              dispo,
              data: day.map((message) => {
                return {
                  id: message.group_id,
                  state: message.alarmCode,
                  alarmText: message.alarmText,
                  startTime: dayjs(message.timeOfOccurence).format(
                    "YYYY-MM-DD HH:mm:ss"
                  ),
                  endTime: dayjs(message.timeOfAcknowledge).format(
                    "YYYY-MM-DD HH:mm:ss"
                  ),
                  duration: mapValue(
                    message.duration,
                    0,
                    totalTimeInSeconds,
                    0,
                    100
                  ),
                };
              }),
            });
            console.info("Recieve:", dataSource);
          });
      }
      KPITop3Number.value = kpiTop3Count;
      KPITop3Duration.value = kpiTop3Duration;
      $q.loading.hide();
      resolve();
    } else if (typeof filter === typeof {}) {
      const from = dayjs(filter.from)
        .set("hour", 0)
        .set("minute", 0)
        .set("second", 0)
        .format("YYYY-MM-DD HH:mm:ss");
      const to = dayjs(filter.to)
        .set("hour", 23)
        .set("minute", 59)
        .set("second", 59)
        .format("YYYY-MM-DD HH:mm:ss");
      const kpiTop3Count = await dataLogStore.getKPItop3Count({
        from,
        to,
        includesExcluded: false,
      });
      const kpiTop3Duration = await dataLogStore.getKPItop3Duration({
        from,
        to,
        includesExcluded: false,
      });
      for (const dataSource of dataSources) {
        const alarms = await dataLogStore.getKPItop3CountPerZone({
          from,
          to,
          dataSource,
          includesExcluded: false,
        });
        KPITop3PerZone.value.push({
          dataSource,
          alarms,
        });
      }
      dayResume.value = [];
      KPITop3Number.value = kpiTop3Count;
      KPITop3Duration.value = kpiTop3Duration;
      $q.loading.hide();
      resolve();
    }
  });
};

onMounted(async () => {
  showLoading();
  dataLogStore.initialize();
  // await getData(toDisplay.value);
  sectionKPITop3.value = true;
  $q.loading.hide();
});

const showLoading = () => {
  $q.loading.show({
    spinner: QSpinnerFacebook,
    spinnerColor: "primary",
    spinnerSize: 160,
    backgroundColor: "dark",
    message: "Rechargement des données...",
    messageColor: "white",
  });
};

function mapValue(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
</script>

<style></style>
