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
const chartSeries = ref([]);
const chartVisibility = ref(false);

const getData = () => {
  chartOptions.value.title.text = dayjs(props.from).isSame(props.to)
    ? `Nombre de messages pour le ${dayjs(props.from).format("DD.MM.YYYY")}`
    : `Nombre de messages pour la période du ${dayjs(props.from).format(
        "DD.MM.YYYY"
      )} au ${dayjs(props.to).format("DD.MM.YYYY")}`;
  chartSeries.value = [];
  window.electron
    .serverRequest(
      "GET",
      `/charts/messages-count/${dayjs(props.from).format("YYYY-MM-DD")}/${dayjs(
        props.to
      ).format("YYYY-MM-DD")}`
    )
    .then((response) => {
      if (!response.data.length) {
        chartVisibility.value = false;
        return;
      }
      chartSeries.value.push({
        name: "Erreurs",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.error];
        }),
        color: "#C10015",
        zIndex: 10,
      });
      chartSeries.value.push({
        name: "Avertissements",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.warning];
        }),
        color: "#F2C037",
        zIndex: 5,
      });
      chartSeries.value.push({
        name: "Total",
        data: response.data.map((item) => {
          return [dayjs(item.date).valueOf(), item.total];
        }),
        color: "#000000",
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
