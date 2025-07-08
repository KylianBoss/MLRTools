<template>
  <q-card>
    <q-card-section v-if="chartVisibility">
      <vue-apex-charts
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
            <div v-if="props.col.name === 'error'" class="text-weight-medium">
              {{ props.value }}
            </div>
            <div v-else class="text-center" :class="cellFormat(props.value)">
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
import { ref, watch } from "vue";
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
      name: "Pannes / 1000 trays (nombre)",
      type: "column",
      data: errorsByThousand.data.map((item) => item.number.toFixed(2)),
    },
    {
      name: "Panne / 1000 trays (temps)",
      type: "column",
      data: errorsByThousand.data.map((item) => item.time),
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
      seriesName: "Pannes / 1000 trays (nombre)",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Nombre de pannes / 1000 trays",
      },
    },
    {
      seriesName: "Pannes / 1000 trays (nombre)",
      show: false,
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
    },
  ];
  chartVisibility.value = true;
};

const formatDataForTable = (data) => {
  const alarmMap = new Map();
  const dates = new Set();

  data.forEach((row) => {
    dates.add(row.alarm_date);

    if (!alarmMap.has(row.alarmId)) {
      alarmMap.set(row.alarmId, {
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
      error: alarm.error,
    };

    sortedDates.forEach((date) => {
      row[date] = alarm.dailyBreakdown[date] || 0;
    });

    return row;
  });

  return { tableRows, tableColumns };
};

const cellFormat = (value) => {
  if (value === 0) return "text-grey bg-grey";
  if (value < 5) return "text-dark bg-green";
  if (value < 10) return "text-dark bg-yellow";
  if (value < 20) return "text-dark bg-orange";
  return "text-dark bg-red";
};

getData();
</script>

<style></style>
