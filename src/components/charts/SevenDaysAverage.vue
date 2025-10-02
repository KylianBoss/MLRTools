<template>
  <q-card>
    <q-card-section v-if="chartVisibility">
      <vue-apex-charts
        type="bar"
        height="250"
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
        hide-bottom
      >
        <template v-slot:body-cell="props">
          <q-td :props="props">
            <div
              v-if="props.col.name === 'dataSource'"
              class="text-weight-medium"
            >
              {{ props.value }}
            </div>
            <div
              v-else-if="props.col.name === 'alarmArea'"
              class="text-weight-medium"
            >
              {{ props.value }}
            </div>
            <div
              v-else-if="props.col.name === 'error'"
              class="text-weight-medium"
            >
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
});
const chartOptions = ref({
  chart: {
    height: 350,
    type: "bar",
    stackable: false,
    defaultLocale: "fr",
    locales: props.locale,
  },
  title: {
    text: `Rapport des 7 derniers jours`,
    align: "center",
    style: {
      fontSize: "20px",
      fontWeight: "bold",
    },
  },
  dataLabels: {
    enabled: true,
    offsetY: -20,
    style: {
      fontSize: "12px",
      fontWeight: "bold",
    },
    background: {
      enabled: true,
      foreColor: "#1D1D1D",
      borderRadius: 2,
      padding: 4,
      opacity: 0.9,
      borderWidth: 1,
      borderColor: "#1D1D1D",
    },
  },
  series: [],
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
      horizontal: false,
      dataLabels: {
        position: "top",
      },
    },
  },
});
const chartSeries = ref([]);
const rows = ref([]);
const columns = ref([]);
const chartVisibility = ref(false);

const emits = defineEmits(["loaded"]);

const getData = async () => {
  chartSeries.value = [];

  const data = await api.get(`/kpi/charts/global-last-7-days`);

  const errorsFromLastSevenDays = await api.get(
    `/kpi/charts/global-last-7-days/top-10`
  );
  const { tableRows, tableColumns } = await formatDataForTable(
    errorsFromLastSevenDays.data
  );
  rows.value = tableRows;
  columns.value = tableColumns;
  const max = Math.round(Math.max(data.data.avg_errors_per_thousand, data.data.avg_downtime_minutes_per_thousand) * 1.5);

  chartSeries.value.push(
    {
      name: "Nombre de pannes",
      data: [
        {
          x: "Nombre d'erreurs moyen",
          y: (data.data.avg_errors_per_thousand).toFixed(1),
          goals: [
            {
              name: "Target",
              value: 0,
              strokeColor: "#C10015",
            },
          ],
        },
      ],
    },
    {
      name: "Temps de pannes [min]",
      data: [
        {
          x: "Temps de panne moyen",
          y: (data.data.avg_downtime_minutes_per_thousand).toFixed(1),
          goals: [
            {
              name: "Target",
              value: 0,
              strokeColor: "#C10015",
            },
          ],
        },
      ],
    }
  );
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
        text: "Nombre / 1000 trays",
      },
      min: 0,
      max: max,
    },
    {
      opposite: true,
      seriesName: "Pannes / 1000 trays (temps [minutes])",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Temps / 1000 trays [min]",
        rotate: 90,
      },
      min: 0,
      max: max,
    },
  ];
  chartVisibility.value = true;
  emits("loaded");
};

const formatDataForTable = async (data) => {
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

  const amountsData = await api.get(`/kpi/charts/amount`);
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de trays sortie (entrée palletiseurs)",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const amountEntry = amountsData.data
          .filter(
            (t) =>
              t.date === date &&
              ["X101", "X102", "X103", "X104"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, amountEntry];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de trays entrée (sortie dépalettiseurs)",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const amountEntry = amountsData.data
          .filter(
            (t) =>
              t.date === date &&
              ["X001", "X002", "X003", "X004"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, amountEntry];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de palettes sortie",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const amountEntry = amountsData.data
          .filter((t) => t.date === date && ["F013"].includes(t.zoneName))
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, amountEntry];
      })
    ),
  });
  tableRows.unshift({
    dataSource: "----",
    alarmArea: "----",
    error: "Quantité de palettes entrée",
    ...Object.fromEntries(
      sortedDates.map((date) => {
        const amountEntry = amountsData.data
          .filter(
            (t) =>
              t.date === date &&
              ["X001_PAL", "X002_PAL", "X003_PAL"].includes(t.zoneName)
          )
          .reduce((sum, curr) => sum + curr.total, 0);
        return [date, amountEntry];
      })
    ),
  });

  return { tableRows, tableColumns };
};

const cellFormat = (value, row) => {
  if (row.dataSource === "----") return "text-dark text-bold bg-blue-3";
  if (value === null || value === undefined) return "text-grey bg-grey";
  if (value === 0) return "text-grey bg-grey";

  const rowsValues = rows.value
    .slice(4, rows.value.length)
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
