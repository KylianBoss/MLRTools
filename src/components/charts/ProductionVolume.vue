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
});
const locale = [
  {
    name: "fr",
    options: {
      months: [
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
      ],
      shortMonths: [
        "Jan",
        "Fév",
        "Mar",
        "Avr",
        "Mai",
        "Juin",
        "Juil",
        "Août",
        "Sep",
        "Oct",
        "Nov",
        "Déc",
      ],
      days: [
        "Dimanche",
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
      ],
      shortDays: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
      toolbar: {
        download: "Télécharger SVG",
        selection: "Sélection",
        selectionZoom: "Sélectionner pour zoomer",
        zoomIn: "Zoomer",
        zoomOut: "Dézoomer",
        pan: "Déplacer",
        reset: "Réinitialiser le zoom",
      },
    },
  },
];
const chartOptions = ref({
  chart: {
    height: 350,
    type: "area",
    stackable: false,
    defaultLocale: "fr",
    locales: locale,
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
    width: [2, 2], // Width for both series
    dashArray: [0, 3], // Solid line for area, dashed for median
  },
  fill: {
    type: ["gradient", "none"], // Fill for area series, no fill for median line
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
        data: response.data.map((item) => [dayjs(item.date).valueOf(), median]),
        type: "line",
        color: "#2E93fA",
        dashArray: 3,
        zIndex: 11,
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
