<template>
  <div class="text-h5">Messages d'erreur par zone</div>
  <vue-apex-charts
    type="pie"
    height="350"
    :options="chartOptions"
    :series="chartSeries"
    v-if="chartVisibility"
  />
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import dayjs from "dayjs";
import { ref } from "vue";

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
    type: "pie",
    stackable: false,
    defaultLocale: "fr",
    locales: locale,
  },
  dataLabels: {
    enabled: true,
    formatter: function (val) {
      return Math.floor(val) + "%";
    },
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
    width: 2,
  },
  legend: {
    show: true,
    position: "right",
  },
});
const chartSeries = ref([]);
const chartVisibility = ref(false);

window.electron
  .serverRequest(
    "GET",
    `/charts/messages-per-zone/${dayjs(props.from).format(
      "YYYY-MM-DD"
    )}/${dayjs(props.to).format("YYYY-MM-DD")}`
  )
  .then((response) => {
    chartSeries.value = response.data.map((item) => item.count);
    chartOptions.value.labels = response.data.map((item) => item.dataSource);
    chartVisibility.value = true;
  });
</script>

<style></style>
