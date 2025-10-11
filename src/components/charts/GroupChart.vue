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
          {{ props.group.groupName }}
        </div>
        <div style="font-size: 14px; font-weight: normal">
          {{ `(${props.group.zones.map((z) => z.description).join(", ")})` }}
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
    style: {
      fontSize: "20px",
      fontWeight: "bold",
    },
  },
  subtitle: {
    text: `(${
      props.group.zones.map((z) => z.description).join(", ").length > 180
        ? props.group.zones
            .map((z) => z.description)
            .join(", ")
            .slice(0, 180) + "..."
        : props.group.zones.map((z) => z.description).join(", ")
    })`,
    align: "center",
    style: {
      fontSize: "14px",
      fontWeight: "normal",
    },
  },
  dataLabels: {
    enabled: false,
    enabledOnSeries: [1, 2],
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
  const response = await api
    .get(`/kpi/charts/alarms-by-group/${props.group.groupName}`)
    .catch(() => ({ data: [] }));
  const data = response.data;
  const filteredData = data.chartData.filter(
    (d) => d.minProdReached && d.errors > 0 && d.downtime > 0
  );

  const { tableRows, tableColumns } = formatDataForTable(data);
  rows.value = tableRows;
  columns.value = tableColumns;
  const errorValues = filteredData
    .map((item) => parseFloat(item.errors))
    .sort((a, b) => a - b);
  const percentile90Index = Math.floor(errorValues.length * 0.9);
  const max = Math.round(errorValues[percentile90Index] * 1.5);

  // Calculer la ligne de tendance (régression linéaire)
  const calculateTrendLine = (values) => {
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = values.map((v) => parseFloat(v));

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      data: xValues.map((x) => (slope * x + intercept).toFixed(2)),
      slope: slope,
    };
  };

  const trendLine = calculateTrendLine(filteredData.map((item) => item.errors));

  const getTrendColor = (slope) => {
    const avgValue =
      filteredData.reduce((sum, item) => sum + parseFloat(item.errors), 0) /
      filteredData.length;
    const relativeSlope = Math.abs(slope) / avgValue; // Pente relative en %

    if (relativeSlope < 0.01) return "#FFA500"; // Orange - stable (< 1% de variation)
    return slope < 0 ? "#00C853" : "#FF1744"; // Vert si descend, Rouge si monte
  };

  const trendColor = getTrendColor(trendLine.slope);

  chartSeries.value.push(
    {
      name: "Tendance",
      type: "line",
      data: trendLine.data,
      color: trendColor,
    },
    {
      name: "Moyenne 7 jours (nombre)",
      type: "line",
      data: filteredData.map((item) => item.movingAverageErrors),
      color: "#C10015",
    },
    {
      name:
        data.chartData[0]?.transportType === "tray"
          ? "Pannes / 1000 trays (temps [minutes])"
          : "Pannes / 100 palettes (temps [minutes])",
      type: "column",
      data: filteredData.map((item) => item.downtime.toFixed(2)),
      color: "#00e396",
    },
    {
      name:
        data.chartData[0]?.transportType === "tray"
          ? "Pannes / 1000 trays (nombre)"
          : "Pannes / 100 palettes (nombre)",
      type: "column",
      data: filteredData.map((item) => item.errors.toFixed(2)),
      color: "#008ffb",
    }
  );

  chartOptions.value.xaxis = {
    categories: filteredData.map((item) =>
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

  chartOptions.value.stroke = {
    width: [3, 2, 0, 0], // Largeur des lignes pour chaque série
    dashArray: [5, 0, 0, 0], // Pointillés pour la tendance uniquement
  };

  chartOptions.value.yaxis = [
    {
      opposite: true,
      seriesName: "Tendance",
      show: false,
      min: 0,
      max: max,
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
      min: 0,
      max: max,
    },
    {
      opposite: true,
      seriesName:
        data.chartData[0]?.transportType === "tray"
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
          data.chartData[0]?.transportType === "tray"
            ? "Temps de pannes / 1000 trays (minutes)"
            : "Temps de pannes / 100 palettes (minutes)",
        rotate: 90,
      },
      min: 0,
      color: "#008ffb",
    },
    {
      seriesName:
        data.chartData[0]?.transportType === "tray"
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
          data.chartData[0]?.transportType === "tray"
            ? "Nombre de pannes / 1000 trays"
            : "Nombre de pannes / 100 palettes",
      },
      min: 0,
      max: max,
      color: "#00e396",
    },
  ];
  chartVisibility.value = true;
  emits("loaded");
};

const formatDataForTable = (data) => {
  let alarmMap = new Map();
  const dates = new Set();

  if (data.alarms.length === 0) return { tableRows: [], tableColumns: [] };

  data.alarms.forEach((row) => {
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

  if (
    sortedDates
      .map((d) => {
        return data.chartData.find((t) => t.date === d)?.traysAmount || 0;
      })
      .some((v) => v > 0)
  )
    tableRows.unshift({
      dataSource: "----",
      alarmArea: "----",
      error:
        data.chartData[0].transportType === "tray"
          ? "Quantité de trays"
          : "Quantité de palettes",
      ...Object.fromEntries(
        sortedDates.map((date) => {
          const trayEntry = data.chartData.find((t) => t.date === date);
          return [date, trayEntry ? trayEntry.traysAmount : 0];
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
});
</script>

<style></style>
