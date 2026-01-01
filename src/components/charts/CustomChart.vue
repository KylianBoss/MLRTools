<template>
  <q-card>
    <q-card-section v-if="chartVisibility">
      <vue-apex-charts
        ref="chart"
        height="350"
        :options="chartOptions"
        :series="chartSeries"
        :key="chartSeries.length"
        v-if="chartSeries.some((s) => s.data && s.data.length > 0)"
      />
      <div v-else class="text-center q-gutter-xs">
        <div style="font-size: 20px; font-weight: bold">
          {{ props.chartData.chartName }}
        </div>
      </div>
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
        v-if="rows.length > 0"
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
      <div v-else>
        <q-banner class="bg-green text-dark">
          <template v-slot:avatar>
            <q-icon name="mdi-check-circle" />
          </template>
          <div>
            Il n'y a pas eu d'erreurs dans ce groupe au cours des 7 derniers
            jours.
          </div>
        </q-banner>
      </div>
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
  chartData: {
    type: Object,
    required: true,
  },
  alarmList: {
    type: Array,
    required: false,
    default: () => [],
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
    text: props.chartData.chartName,
    align: "center",
    style: {
      fontSize: "20px",
      fontWeight: "bold",
    },
  },
  dataLabels: {
    enabled: true,
    enabledOnSeries: [],
    offsetY: -10,
  },
  series: [],
  stroke: {
    width: [2, 3, 3],
    curve: "smooth",
  },
  legend: {
    offsetX: 40,
    show: true,
    position: "bottom",
    horizontalAlign: "center",
  },
  plotOptions: {
    bar: {
      columnWidth: "30%",
      distributed: true,
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
  const response = await api
    .get(`/kpi/charts/custom/${props.chartData.id}`)
    .catch(() => {
      emits("loaded");
      return;
    });

  const chartData = response.data.chartData;
  const tableData = response.data.tableData;
  const options = response.data.options || {};

  const { tableRows, tableColumns } = formatDataForTable(tableData);
  rows.value = tableRows;
  columns.value = tableColumns;
  const errorValues = chartData
    .map((item) => parseFloat(item.data))
    .sort((a, b) => a - b);
  const percentile90Index = Math.floor(errorValues.length * 0.9);
  const max = Math.round(errorValues[percentile90Index] * 1.5);

  const barColors = chartData.map((item) => {
    const value = parseFloat(item.data);
    const target = parseFloat(item.target) || 0;
    const above = value > target;
    return above ? "#E74C3CA0" : "#27AE60A0";
  });

  chartSeries.value.push(
    {
      name: "Nombre d'erreurs",
      type: "column",
      data: chartData.map((item) => {
        return {
          x: item.date,
          y: item.data,
        };
      }),
    },
    {
      name: "Target",
      type: "line",
      data: chartData.map((item) => {
        return { x: item.date, y: item.target || 0 };
      }),
      color: "#3498DB",
    },
    {
      name: "Moyenne 7 jours (nombre)",
      type: "line",
      data: chartData.map((item) => {
        return { x: item.date, y: item.movingAverage };
      }),
      color: "#F39C12",
    }
  );
  chartOptions.value = {
    ...chartOptions.value,
    colors: barColors,
  }
  chartOptions.value.xaxis = {
    categories: chartData.map((item) => dayjs(item.date).format("YYYY-MM-DD")),
    labels: {
      show: true,
      rotate: -90,
      rotateAlways: true,
      formatter: (value) => {
        return dayjs(value).format("DD.MM.YY");
      },
    },
    tickAmount: options.xTickAmount || 30,
  };
  chartOptions.value.yaxis = [
    {
      seriesName: "Nombre d'erreurs",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Nombre d'erreurs",
      },
      min: 0,
      max: max,
    },
    {
      seriesName: "Target",
      axisTicks: {
        show: true,
      },
      axisBorder: {
        show: true,
      },
      title: {
        text: "Target",
      },
      min: 0,
      max: max,
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
      min: 0,
      max: max,
    },
  ];
  chartVisibility.value = true;
  emits("loaded");
};

const formatDataForTable = (data) => {
  let alarmMap = new Map();
  const dates = new Set();

  data.forEach((row) => {
    dates.add(row.day_date);

    JSON.parse(`[${row.alarms_detail}]`).forEach((alarm) => {
      if (!alarmMap.has(alarm.alarm_id)) {
        alarmMap.set(alarm.alarm_id, {
          dailyBreakdown: {},
          alarmId: alarm.alarm_id,
        });
      }

      alarmMap.get(alarm.alarm_id).dailyBreakdown[row.day_date] = alarm.count;
    });
  });

  // Make a total per alarm
  alarmMap.forEach((value, key) => {
    value.count = Object.values(value.dailyBreakdown).reduce(
      (sum, current) => sum + current,
      0
    );
    alarmMap.set(key, value);
  });

  // Order alarmMap by count desc
  alarmMap = new Map(
    Array.from(alarmMap.entries()).sort((a, b) => b[1].count - a[1].count)
  );

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

  const tableRows = Array.from(alarmMap.values())
    .sort((a, b) => a.count > b.count)
    .map((alarm) => {
      const row = {
        alarmId: alarm.alarmId,
        dataSource:
          props.alarmList.find((a) => a.alarmId === alarm.alarmId)
            ?.dataSource || "UNKNOWN",
        alarmArea: props.alarmList.find((a) => a.alarmId === alarm.alarmId)
          ?.alarmArea,
        error:
          props.alarmList.find((a) => a.alarmId === alarm.alarmId)?.alarmText ||
          alarm.alarmId,
      };

      sortedDates.forEach((date) => {
        row[date] = alarm.dailyBreakdown[date] || 0;
      });

      return row;
    });

  // tableRows.unshift({
  //   alarmId: "header",
  //   dataSource: "Total erreurs",
  //   alarmArea: "----",
  //   error: totalOccurrences,
  //   ...Object.fromEntries(
  //     sortedDates.map((date) => [
  //       date,
  //       data.find((d) => d.date === date)?.total_count || -1,
  //     ])
  //   ),
  // });

  return { tableRows, tableColumns };
};

const cellFormat = (value, row) => {
  if (row.alarmArea === "----") return "text-dark text-bold bg-blue-3";
  if (value === null || value === undefined) return "text-grey bg-grey";
  if (value === 0) return "text-grey bg-grey";
  if (value === -1) return "text-white";

  const rowsValues = rows.value
    .slice(1, rows.value.length) // Exclude first two rows (headers and tray amounts)
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
  console.log("CustomChart mounted for chart:", props.chartData.chartName);
});
</script>

<style></style>
