<template>
  <q-card>
    <q-card-section v-if="chartVisibility">
      <vue-apex-charts
        ref="chart"
        height="350"
        :options="chartOptions"
        :series="chartSeries"
        :key="chartSeries.length"
      />
    </q-card-section>
    <q-card-section v-else>
      <q-skeleton height="350px" square />
    </q-card-section>
    <q-card-section v-if="chartVisibility">
      <q-table
        :rows="rows"
        :columns="columns"
        :rows-per-page-options="[0]"
        no-data-label="Aucune erreur trouvée"
        row-key="alarmId"
        flat
        bordered
        dense
      >
        <template v-slot:body-cell="props">
          <q-td :props="props">
            <div v-if="props.col.name === 'dataSource'" class="text-weight-medium">
              {{ props.value }}
            </div>
            <div v-else-if="props.col.name === 'alarmArea'" class="text-weight-medium">
              {{ props.value }}
            </div>
            <div v-else-if="props.col.name === 'error'" class="text-weight-medium">
              {{ props.value }}
            </div>
            <div
              v-else
              class="text-center"
              :class="cellFormat(props.value, props.row)"
            >
              {{ props.value }}
            </div>
          </q-td>
        </template>

        <template v-slot:header-cell="props">
          <q-th :props="props" class="text-weight-bold">
            {{ props.col.label }}
          </q-th>
        </template>

        <!-- Message si pas de données -->
        <template v-slot:no-data>
          <div class="full-width row flex-center text-grey q-gutter-sm">
            <q-icon size="2em" name="warning" />
            <span>Aucune donnée disponible</span>
          </div>
        </template>
      </q-table>
    </q-card-section>
    <q-card-section v-else>
      <skeleton-table />
    </q-card-section>
  </q-card>
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import SkeletonTable from "../SkeletonTable.vue";
import dayjs from "dayjs";
import { ref, onMounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  locale: {
    type: Array,
    required: false,
  },
  group: {
    type: Object,
    required: true,
  },
});

const chart = ref(null);
const chartOptions = ref({
  chart: {
    height: 350,
    type: "line",
    stackable: false,
    defaultLocale: "fr",
    locales: props.locale,
  },
  title: {
    text: props.group.groupName,
    align: "center",
  },
  subtitle: {
    text: `(${props.group.zones.map((z) => z.description).join(", ")})`,
    align: "center",
  },
  dataLabels: {
    enabled: true,
    enabledOnSeries: [0, 1],
    offsetY: -10,
  },
  series: [],
  stroke: {
    width: 2,
    curve: "smooth",
  },
  legend: {
    horizontalAlign: "left",
    offsetX: 40,
  },
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
  },
  plotOptions: {
    bar: {
      columnWidth: "20%",
    },
  },
});
const chartSeries = ref([]);
const rows = ref([]);
const columns = ref([]);
const chartVisibility = ref(false);

defineExpose({
  chart,
});
const emits = defineEmits(["loaded"]);

const getData = async () => {
  chartSeries.value = [];
  const errorsByThousand = await api.get(
    `/kpi/charts/thousand-trays-number/${props.group.groupName}`
  );
  const errorsFromLastSevenDays = await api.get(
    `/kpi/charts/alarms-by-group/${props.group.groupName}`
  );
  const { tableRows, tableColumns } = formatDataForTable(
    errorsFromLastSevenDays.data
  );
  rows.value = tableRows;
  columns.value = tableColumns;

  chartSeries.value.push(
    {
      name:
        props.group.transportType === "tray"
          ? "Pannes / 1000 trays (nombre)"
          : "Pannes / 100 palettes (nombre)",
      type: "column",
      data: errorsByThousand.data.map((item) => item.number.toFixed(2)),
    },
    {
      name:
        props.group.transportType === "tray"
          ? "Pannes / 1000 trays (temps [minutes])"
          : "Pannes / 100 palettes (temps [minutes])",
      type: "column",
      data: errorsByThousand.data.map((item) => item.time.toFixed(2)),
    },
    {
      name: "Moyenne 7 jours (nombre)",
      type: "line",
      data: errorsByThousand.data.map((item) => item.movingAverage),
      color: "#C10015",
    }
  );
  chartOptions.value.xaxis = {
    categories: errorsByThousand.data.map((item) =>
      dayjs(item.date).format("YYYY-MM-DD")
    ),
    labels: {
      show: true,
      rotate: -90,
      rotateAlways: true,
      formatter: (value) => {
        return dayjs(value).format("DD/MM");
      },
    },
  };
  chartOptions.value.yaxis = [
    {
      seriesName:
        props.group.transportType === "tray"
          ? "Pannes / 1000 trays (nombre)"
          : "Pannes / 100 palettes (nombre)",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text:
          props.group.transportType === "tray"
            ? "Nombre de pannes / 1000 trays"
            : "Nombre de pannes / 100 palettes",
      },
    },
    {
      opposite: true,
      seriesName:
        props.group.transportType === "tray"
          ? "Pannes / 1000 trays (temps [minutes])"
          : "Pannes / 100 palettes (temps [minutes])",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text:
          props.group.transportType === "tray"
            ? "Temps de pannes / 1000 trays (minutes)"
            : "Temps de pannes / 100 palettes (minutes)",
        rotate: 90,
      },
    },
    {
      opposite: true,
      seriesName: "Moyenne mobile 7 jours",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Moyenne mobile 7 jours",
      },
      show: false,
    },
  ];
  chartVisibility.value = true;
  emits("loaded");
};

const formatDataForTable = (data) => {
  const alarmMap = new Map();
  const dates = new Set();

  data.forEach((row) => {
    dates.add(row.alarm_date);

    if (!alarmMap.has(row.alarmId)) {
      alarmMap.set(row.alarmId, {
        dataSource: row.dataSource,
        alarmArea: row.alarmArea,
        alarmId: row.alarmId,
        error: row.alarmText,
        dailyBreakdown: {},
      });
    }

    alarmMap.get(row.alarmId).dailyBreakdown[row.alarm_date] = row.daily_count;
  });

  const sortedDates = Array.from(dates).sort();

  const tableColumns = [
    {
      name: "dataSource",
      label: "Source",
      field: "dataSource",
      align: "left",
      sortable: false,
    },
    {
      name: "alarmArea",
      label: "Module",
      field: "alarmArea",
      align: "left",
      sortable: false,
    },
    {
      name: "error",
      label: "Erreur",
      field: "error",
      align: "left",
      sortable: false,
      style: "width: 300px;",
    },
  ];

  sortedDates.forEach((date) => {
    const formattedDate = dayjs(date).format("DD/MM");

    tableColumns.push({
      name: date,
      label: formattedDate,
      field: date,
      align: "center",
      sortable: false,
    });
  });

  const tableRows = Array.from(alarmMap.values()).map((alarm) => {
    const row = {
      alarmId: alarm.alarmId,
      dataSource: alarm.dataSource,
      alarmArea: alarm.alarmArea,
      error: alarm.error,
    };

    sortedDates.forEach((date) => {
      row[date] = alarm.dailyBreakdown[date] || 0;
    });

    return row;
  });

  return { tableRows, tableColumns };
};

const cellFormat = (value, row) => {
  if (value === null || value === undefined) return "text-grey bg-grey";
  if (value === 0) return "text-grey bg-grey";

  const rowsValues = rows.value
    .map((r) => Object.values(r).filter((v) => typeof v === "number"))
    .flat()
    .filter((v) => v > 0);
  const maxValue = Math.max(...rowsValues);
  const minValue = Math.min(...rowsValues);
  const range = maxValue - minValue;
  const normalizedValue = (value - minValue) / range;
  if (normalizedValue < 0.1) return "text-dark bg-green"; // Lowest 10%
  if (normalizedValue < 0.2) return "text-dark bg-yellow"; // Middle 20%
  if (normalizedValue < 0.5) return "text-dark bg-orange"; // Middle 20% to 50%
  return "text-dark bg-red"; // Highest 50%
};

onMounted(() => {
  getData();
});
</script>

<style></style>
