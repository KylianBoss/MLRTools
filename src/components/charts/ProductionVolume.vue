<template>
  <vue-apex-charts
    type="area"
    height="350"
    :options="chartOptions"
    :series="chartSeries"
    :key="chartSeries.length"
    v-if="chartVisibility"
  />
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import dayjs from "dayjs";
import { ref, watch } from "vue";

const props = defineProps({
  from: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  locale: {
    type: Array,
    required: false,
  },
});
const chartOptions = ref({
  chart: {
    height: 350,
    type: "area",
    stackable: false,
    defaultLocale: "fr",
    locales: props.locale,
  },
  title: {
    text: `Volume de production pour la période du ${dayjs(props.from).format(
      "DD.MM.YYYY"
    )} au ${dayjs(props.to).format("DD.MM.YYYY")}`,
    align: "left",
  },
  dataLabels: {
    enabled: false,
  },
  series: [],
  xaxis: {
    type: "datetime",
  },
  legend: {
    horizontalAlign: "left",
    offsetX: 40,
  },
  stroke: {
    width: [2, 2, 2],
    dashArray: [0, 3, 4],
  },
  fill: {
    type: ["gradient", "none", "none"], // Fill for area series, no fill for median line
  },
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
  },
});
const chartSeries = ref([]);
const chartVisibility = ref(false);

const getData = () => {
  chartOptions.value.title.text = dayjs(props.from).isSame(props.to, "day")
    ? `Volume de production pour le ${dayjs(props.from).format("DD.MM.YYYY")}`
    : `Volume de production pour la période du ${dayjs(props.from).format(
        "DD.MM.YYYY"
      )} au ${dayjs(props.to).format("DD.MM.YYYY")}`;
  chartSeries.value = [];
  window.electron
    .serverRequest("GET", `/charts/production/volume/${props.from}/${props.to}`)
    .then((response) => {
      chartSeries.value.push({
        name: "Volume de production [caisses]",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.boxTreated];
        }),
        color: "#ff6600",
        zIndex: 10,
      });

      // Calculate median
      const values = response.data.map((item) => item.boxTreated);
      const sortedValues = [...values].sort((a, b) => a - b);
      const median =
        sortedValues.length % 2 === 0
          ? (sortedValues[sortedValues.length / 2 - 1] +
              sortedValues[sortedValues.length / 2]) /
            2
          : sortedValues[Math.floor(sortedValues.length / 2)];

      // Add median line series
      chartSeries.value.push({
        name: "Médiane",
        data: response.data.map((item) => [dayjs(item.date).valueOf(), median.toFixed(0)]),
        type: "line",
        color: "#2E93fA",
        dashArray: 3,
        zIndex: 11,
      });

      // Calcul de la ligne de tendance
      const xValues = response.data.map((item) => dayjs(item.date).valueOf());
      const yValues = response.data.map((item) => item.boxTreated);

      // Calcul des coefficients de régression linéaire
      const n = xValues.length;
      const sumX = xValues.reduce((a, b) => a + b, 0);
      const sumY = yValues.reduce((a, b) => a + b, 0);
      const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
      const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Création des points de la ligne de tendance
      const trendLineData = xValues.map((x) => [x, (slope * x + intercept).toFixed(0)]);

      // Ajout de la série de ligne de tendance
      chartSeries.value.push({
        name: "Tendance",
        type: "line",
        data: trendLineData,
        color: "#00ff00",
        dashArray: 2,
        zIndex: 12,
      });

      chartVisibility.value = true;
    });
};

watch(
  props,
  () => {
    if (dayjs(props.from).isValid() && dayjs(props.to).isValid()) getData();
  },
  { deep: true }
);

getData();
</script>

<style></style>
