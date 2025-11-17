<template>
  <q-page padding>
    <div class="text-h4">KPI</div>
    <div class="row">
      <div class="col">Période d'affichage :</div>
    </div>
    <div class="row">
      <div class="col">
        <q-card class="q-ma-none q-pa-none">
          <q-card-section class="q-ma-none q-pa-none">
            <q-date
              v-model="toDisplay"
              :events="days"
              :options="(date) => !dataLogStore.isDayOff(date)"
              :event-color="
                (date) =>
                  dataLogStore.isMissingProductionData(date)
                    ? 'negative'
                    : 'secondary'
              "
              class="full-width"
              minimal
              range
              :navigation-max-year-month="dayjs().format('YYYY/MM')"
              landscape
              title="Période d'affichage"
              first-day-of-week="1"
              locale="fr"
              flat
            />
            <div class="row">
              <div class="col">
                <q-expansion-item label="Légende" dense>
                  <small>
                    <q-icon
                      name="mdi-circle-small"
                      color="negative"
                      size="4em"
                      dense
                    />Données mais pas d'horaire de production
                    <q-icon
                      name="mdi-circle-small"
                      color="secondary"
                      size="4em"
                      dense
                    />Données et horaires de production
                  </small>
                </q-expansion-item>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
    <div class="row q-pt-xs">
      <div class="col">
        <q-expansion-item
          label="Top erreurs - Nombre"
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
            :rows-per-page-options="[0]"
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
          label="Top erreurs - Durée"
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
            :rows-per-page-options="[0]"
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
          label="Top erreurs par zone"
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
    <div class="row q-pt-xs" v-if="KPITop3Number.length > 0 && false">
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
    <div class="row q-pt-xs">
      <div class="col">
        <q-linear-progress
          v-if="dayResume.map((d) => d.dataSource).length < dataSources.length"
          color="secondary"
          :value="
            dayResume.map((d) => d.dataSource).length / dataSources.length
          "
        />
        <q-expansion-item
          label="Résumé de la journée"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
          :disable="gettingData"
        >
          <vue-apex-charts
            type="rangeBar"
            height="500"
            :options="chartOptions"
            :series="chartOptions.series"
            :key="chartOptions.series.length"
            v-if="getData && false"
          />
          <q-btn
            flat
            @click="exportImage('dayResumeTable')"
            icon="mdi-file-download"
            label="Exporter le tableau"
          />
          <q-table
            id="dayResumeTable"
            :rows="dayResume"
            :columns="[
              {
                name: 'dataSource',
                label: 'Zone',
                align: 'left',
                field: 'dataSource',
              },
              {
                name: 'runtime',
                label: 'Runtime [min]',
                align: 'right',
                field: (row) => {
                  return row.runtime.toFixed(2);
                },
              },
              {
                name: 'stoptime',
                label: 'Stoptime [min]',
                align: 'right',
                field: (row) => {
                  return row.stoptime.toFixed(2);
                },
              },
              {
                name: 'nbFaillures',
                label: 'Nombre de pannes [#]',
                align: 'right',
                field: 'nbFaillures',
              },
              {
                name: 'MTBF',
                label: 'MTBF [min]',
                align: 'right',
                field: (row) => {
                  return row.MTBF.toFixed(2);
                },
              },
              {
                name: 'MTTR',
                label: 'MTTR [min]',
                align: 'right',
                field: (row) => {
                  return row.MTTR.toFixed(2);
                },
              },
              {
                name: 'dispo',
                label: 'Disponibilité',
                align: 'right',
                field: (row) => {
                  return (row.dispo * 100).toFixed(2) + '%';
                },
              },
            ]"
            row-key="dataSource"
            flat
            bordered
            dense
            :rows-per-page-options="[0]"
          />
        </q-expansion-item>
      </div>
    </div>
    <div class="row q-pt-xs">
      <div class="col">
        <q-expansion-item
          label="Alarmes par utilisateur"
          header-class="bg-primary text-weight-bold text-white"
          expand-icon-class="text-white"
        >
          <vue-apex-charts
            type="bar"
            height="400"
            :options="assignedUsersChartOption"
            :series="assignedUsersChartOption.series"
            :key="
              assignedUsersChartOption.series.length +
              assignedUsersChartOption.title.text
            "
          />
        </q-expansion-item>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useQuasar, QSpinnerFacebook, event } from "quasar";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import utc from "dayjs/plugin/utc";
import { useDataLogStore } from "stores/datalog";
import MessagesByDay from "src/components/charts/MessagesByDay.vue";
import ErrorsPerZoneCount from "src/components/charts/ErrorsPerZoneCount.vue";
import VueApexCharts from "vue3-apexcharts";
import html2canvas from "html2canvas";

dayjs.extend(isBetween);
dayjs.extend(utc);

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const sectionKPITop3 = ref(false);
const sectionKPITop3Zone = ref(false);
const toDisplay = ref(null);
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
  "W001",
  "W002",
  "W003",
  "W004",
  "W005",
  "W006",
];
const KPITop3Number = ref([]);
const KPITop3Duration = ref([]);
const KPITop3PerZone = ref([]);
const dayResume = ref([]);
const chartOptions = {
  chart: {
    type: "rangeBar",
    toolbar: {
      show: true,
    },
    animations: {
      enabled: false,
    },
    zoom: {
      enabled: true,
      allowMouseWheelZoom: false,
    },
    events: {
      mouseMove: function (event, chartContext, config) {
        // Get X coordinate of mouse pointer relative to chart
        const chartArea =
          chartContext.ctx.w.globals.dom.baseEl.querySelector(
            ".apexcharts-inner"
          );
        const rect = chartArea.getBoundingClientRect();
        const x = event.clientX - rect.left;

        // Remove existing marker line if it exists
        const existingLine =
          chartContext.ctx.w.globals.dom.baseEl.querySelector(
            ".apexcharts-marker-line"
          );
        if (existingLine) {
          existingLine.remove();
        }

        // Create and add new marker line
        if (x >= 0 && x <= rect.width) {
          const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          line.setAttribute("class", "apexcharts-marker-line");
          line.setAttribute("x1", x);
          line.setAttribute("x2", x);
          line.setAttribute("y1", 0);
          line.setAttribute("y2", rect.height);
          line.setAttribute("stroke", "#b6b6b6");
          line.setAttribute("stroke-width", "1");
          line.setAttribute("stroke-dasharray", "3");

          chartArea.appendChild(line);
        }
      },
      mouseLeave: function (event, chartContext, config) {
        // Remove marker line when mouse leaves chart area
        const line = chartContext.ctx.w.globals.dom.baseEl.querySelector(
          ".apexcharts-marker-line"
        );
        if (line) {
          line.remove();
        }
      },
    },
  },
  plotOptions: {
    bar: {
      horizontal: true,
      barHeight: "80%",
      rangeBarGroupRows: true,
    },
  },
  xaxis: {
    type: "datetime",
    labels: {
      datetimeFormatter: {
        hour: "HH:mm",
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        fontSize: "12px",
      },
    },
  },
  grid: {
    show: false,
  },
  colors: ["#00E396", "#FF4560"],
  tooltip: {
    // x: {
    //   format: "HH:mm",
    // },
    custom: function ({ series, seriesIndex, dataPointIndex, w }) {
      const data = chartOptions.series[seriesIndex].data[dataPointIndex];
      return (
        '<q-card class="q-pa-xs"><q-card-section>' +
        '<div class="text-h6">' +
        w.globals.labels[seriesIndex] +
        "</div>" +
        `<div>État : <span class="text-weight-bold text-${
          data.errorText == "Running" ? "positive" : "negative"
        }">${
          data.errorText == "Running" ? "Fonctionnement" : "Arrêt"
        }</span></div>` +
        `<div>Temps : ${dayjs.utc(data.start).format("HH:mm")} - ${dayjs
          .utc(data.end)
          .format("HH:mm")}</div>` +
        `<div>Durée : ${dayjs(data.end).diff(
          data.start,
          "minute"
        )} minutes</div>` +
        `<div>Message : ${data.errorText}</div>` +
        "</q-card-section></q-card>"
      );
    },
  },
  legend: {
    show: false,
  },
  series: [],
};
const assignedUsersChartOption = ref({
  chart: {
    type: "bar",
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: "55%",
    },
  },
  xaxis: {
    labels: {
      rotate: -45,
      rotateAlways: true,
    },
  },
  title: {
    text: "Nombre d'alarmes traitées par utilisateur",
    align: "center",
  },
  dataLabels: {
    enabled: true,
  },
  tooltip: {
    enabled: false,
  },
  colors: ["#ff6600"],
  series: [],
});
const allLoaded = ref({});
const timeoutLoading = ref(null);
const gettingData = ref(false);
const alarmsByUsers = ref([]);

watch(toDisplay, async (newDate, oldValue) => {
  if (JSON.stringify(newDate) === JSON.stringify(oldValue)) return;
  if (newDate === null) return;

  sectionKPITop3.value = false;
  sectionKPITop3Zone.value = false;

  await getData(newDate);
  await getAlarmsByUser(newDate);
  sectionKPITop3.value = true;
});

const getData = (filter) => {
  return new Promise(async (resolve) => {
    if (gettingData.value) return;
    gettingData.value = true;
    chartOptions.series = [];
    dayResume.value = [];
    let from, to;
    if (typeof filter === "string") {
      from = dayjs(filter).format("YYYY-MM-DD");
      to = dayjs(filter).format("YYYY-MM-DD");
    } else if (typeof filter === "object") {
      from = dayjs(filter.from).format("YYYY-MM-DD");
      to = dayjs(filter.to).format("YYYY-MM-DD");
    }
    // const productionTime = dataLogStore.productionTimes(
    //   dayjs(filter).format("YYYY-MM-DD")
    // );
    // const from = dayjs(productionTime.from).format("YYYY-MM-DD");
    // const to = dayjs(productionTime.from).format("YYYY-MM-DD");
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
    const promises = [];
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
      showLoading(`Chargement ou calcul des données pour ${dataSource}...`);
      allLoaded.value[dataSource] = false;
      const d = dataLogStore
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
          const MTTR = stoptime / Math.max(nbFaillures, 1);
          const MTBF = runtime / Math.max(nbFaillures, 1);
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
          allLoaded.value[dataSource] = true;
          chartOptions.series.push({
            name: dataSource,
            data: day.map((message) => {
              return {
                x: dataSource,
                y: [
                  dayjs(message.timeOfOccurence).valueOf(),
                  dayjs(message.timeOfAcknowledge).valueOf(),
                ],
                start: dayjs(message.timeOfOccurence).valueOf(),
                end: dayjs(message.timeOfAcknowledge).valueOf(),
                fillColor: message.alarmText == "Running" ? "green" : "red",
                errorText: message.alarmText,
              };
            }),
          });
        })
        .catch((error) => {
          console.error("Error getting day resume:", error);
        });
      promises.push(d);
    }
    await Promise.all(promises);
    dayResume.value.sort((a, b) => {
      return a.dataSource.localeCompare(b.dataSource);
    });
    chartOptions.series.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    KPITop3Number.value = kpiTop3Count;
    KPITop3Duration.value = kpiTop3Duration;
    // $q.loading.hide();
    // Add total at the end of the table
    dayResume.value.push({
      dataSource: "Total",
      runtime:
        dayResume.value.reduce((acc, day) => acc + day.runtime, 0) /
        dayResume.value.length,
      stoptime: dayResume.value.reduce((acc, day) => acc + day.stoptime, 0),
      nbFaillures: dayResume.value.reduce(
        (acc, day) => acc + day.nbFaillures,
        0
      ),
      MTBF:
        dayResume.value.reduce((acc, day) => acc + day.runtime, 0) /
        dayResume.value.length /
        dayResume.value.reduce((acc, day) => acc + day.nbFaillures, 0),
      MTTR:
        dayResume.value.reduce((acc, day) => acc + day.stoptime, 0) /
        dayResume.value.reduce((acc, day) => acc + day.nbFaillures, 0),
      dispo:
        dayResume.value.reduce((acc, day) => acc + day.runtime, 0) /
        dayResume.value.length /
        dayResume.value.reduce((acc, day) => acc + day.nbFaillures, 0) /
        (dayResume.value.reduce((acc, day) => acc + day.runtime, 0) /
          dayResume.value.length /
          dayResume.value.reduce((acc, day) => acc + day.nbFaillures, 0) +
          dayResume.value.reduce((acc, day) => acc + day.stoptime, 0) /
            dayResume.value.reduce((acc, day) => acc + day.nbFaillures, 0)),
    });
    console.info("All data received");
    $q.loading.hide();
    gettingData.value = false;
    resolve();
    // } else if (typeof filter === typeof {}) {
    //   const from = dayjs(filter.from)
    //     .set("hour", 0)
    //     .set("minute", 0)
    //     .set("second", 0)
    //     .format("YYYY-MM-DD HH:mm:ss");
    //   const to = dayjs(filter.to)
    //     .set("hour", 23)
    //     .set("minute", 59)
    //     .set("second", 59)
    //     .format("YYYY-MM-DD HH:mm:ss");
    //   const kpiTop3Count = await dataLogStore.getKPItop3Count({
    //     from,
    //     to,
    //     includesExcluded: false,
    //   });
    //   const kpiTop3Duration = await dataLogStore.getKPItop3Duration({
    //     from,
    //     to,
    //     includesExcluded: false,
    //   });
    //   for (const dataSource of dataSources) {
    //     const alarms = await dataLogStore.getKPItop3CountPerZone({
    //       from,
    //       to,
    //       dataSource,
    //       includesExcluded: false,
    //     });
    //     KPITop3PerZone.value.push({
    //       dataSource,
    //       alarms,
    //     });
    //   }
    //   dayResume.value = [];
    //   KPITop3Number.value = kpiTop3Count;
    //   KPITop3Duration.value = kpiTop3Duration;
    //   $q.loading.hide();
    //   gettingData.value = false;
    //   resolve();
    // }
  });
};

const getAlarmsByUser = async () => {
  const from =
    typeof toDisplay.value === "string"
      ? dayjs(toDisplay.value).format("YYYY-MM-DD")
      : dayjs(toDisplay.value.from).format("YYYY-MM-DD");
  const to =
    typeof toDisplay.value === "string"
      ? dayjs(toDisplay.value).format("YYYY-MM-DD")
      : dayjs(toDisplay.value.to).format("YYYY-MM-DD");
  alarmsByUsers.value = await dataLogStore.getAlarmsByUsers(from, to);

  assignedUsersChartOption.value.title.text = dayjs(from).isSame(to)
    ? `Nombre d'alarmes traitées par utilisateur le ${dayjs(from).format(
        "DD.MM.YYYY"
      )}`
    : `Nombre d'alarmes traitées par utilisateur du ${dayjs(from).format(
        "DD.MM.YYYY"
      )} au ${dayjs(to).format("DD.MM.YYYY")}`;

  assignedUsersChartOption.value.series = [
    {
      data: alarmsByUsers.value.map((item) => {
        return {
          y: item.QuantityTreated,
          x: item.assignedUser,
        };
      }),
    },
  ];
};

const exportImage = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  html2canvas(element, {
    backgroundColor: "#ffffff",
    allowTaint: true,
    useCORS: true,
    scale: 2, // Augmente la résolution de l'image
    logging: false, // Pour le débogage
  }).then((canvas) => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${id}.png`;
    link.click();
  });
};

onMounted(async () => {
  // showLoading(null, true);
  // toDisplay is the date off the last day with data and not a day off
  let date = dayjs(dataLogStore.dates[dataLogStore.dates.length - 1]);
  while (dataLogStore.isDayOff(date)) {
    date = date.subtract(1, "day");
  }
  toDisplay.value = date.format("YYYY/MM/DD");
  // await dataLogStore.initialize().then(async () => {
  //   await getData(toDisplay);
  //   await getAlarmsByUser(toDisplay);
  // });
  sectionKPITop3.value = false;
});

const showLoading = (message, timeout = false) => {
  $q.loading.show({
    spinner: QSpinnerFacebook,
    spinnerColor: "primary",
    spinnerSize: 160,
    backgroundColor: "dark",
    message: message ? message : "Rechargement des données...",
    messageColor: "white",
  });
  if (timeout) {
    console.log("Setting timeout");
    timeoutLoading.value = setTimeout(() => {
      $q.notify({
        message: "Impossible de charger les données",
        color: "negative",
        position: "top",
        timeout: 5000,
      });
      $q.loading.hide();
    }, 20000);
  }
  if (!timeout && timeoutLoading.value) {
    console.log("Clearing timeout");
    clearTimeout(timeoutLoading.value);
    timeoutLoading.value = null;
  }
};

function mapValue(x, in_min, in_max, out_min, out_max) {
  return ((x - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}
</script>

<style>
.apexcharts-marker-line {
  pointer-events: none;
  z-index: 1;
}
</style>
