<template>
  <vue-apex-charts
    type="area"
    height="350"
    :options="chartMessagesCountOptions"
    :series="chartMessagesCountSeries"
    :key="chartMessagesCountSeries.length"
    v-if="chartMessagesCountVisibility"
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
const chartMessagesCountOptions = ref({
  chart: {
    height: 350,
    type: "area",
    stackable: false,
    defaultLocale: "fr",
    locales: locale,
  },
  title: {
    text: `Nombre de messages pour la période du ${dayjs(props.from).format(
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
    width: 2,
  },
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
  },
});
const chartMessagesCountSeries = ref([]);
const chartMessagesCountVisibility = ref(false);

const getData = () => {
  chartMessagesCountOptions.value.title.text = dayjs(props.from).isSame(
    props.to
  )
    ? `Nombre de messages pour le ${dayjs(props.from).format("DD.MM.YYYY")}`
    : `Nombre de messages pour la période du ${dayjs(props.from).format(
        "DD.MM.YYYY"
      )} au ${dayjs(props.to).format("DD.MM.YYYY")}`;
  chartMessagesCountSeries.value = [];
  window.electron
    .serverRequest(
      "GET",
      `/charts/messages-count/${dayjs(props.from).format("YYYY-MM-DD")}/${dayjs(
        props.to
      ).format("YYYY-MM-DD")}`
    )
    .then((response) => {
      if (!response.data.length) {
        chartMessagesCountVisibility.value = false;
        return;
      }
      chartMessagesCountSeries.value.push({
        name: "Erreurs",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.error];
        }),
        color: "#C10015",
        zIndex: 10,
      });
      chartMessagesCountSeries.value.push({
        name: "Avertissements",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.warning];
        }),
        color: "#F2C037",
        zIndex: 5,
      });
      chartMessagesCountSeries.value.push({
        name: "Total",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.total];
        }),
        color: "#000000",
      });
      chartMessagesCountVisibility.value = true;
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
