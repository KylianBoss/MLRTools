<template>
  <vue-apex-charts
    type="pie"
    height="350"
    :options="chartOptions"
    :series="chartSeries"
    v-if="chartVisibility"
    :key="chartSeries.length"
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
    type: "pie",
    stackable: false,
    defaultLocale: "fr",
    locales: props.locale,
    toolbar: {
      show: true,
      tools: {
        download: true,
      },
    },
  },
  title: {
    text: `Nombre de messages par zones pour la période du ${dayjs(
      props.from
    ).format("DD.MM.YYYY")} au ${dayjs(props.to).format("DD.MM.YYYY")}`,
    align: "left",
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
    position: "bottom",
  },
});
const chartSeries = ref([]);
const chartVisibility = ref(false);

const getData = () => {
  chartOptions.value.title.text = dayjs(props.from).isSame(props.to)
    ? `Nombre de messages par zones pour le ${dayjs(props.from).format(
        "DD.MM.YYYY"
      )}`
    : `Nombre de messages par zones pour la période du ${dayjs(
        props.from
      ).format("DD.MM.YYYY")} au ${dayjs(props.to).format("DD.MM.YYYY")}`;
  chartSeries.value = [];
  window.electron
    .serverRequest(
      "GET",
      `/charts/messages-per-zone/${dayjs(props.from).format(
        "YYYY-MM-DD"
      )}/${dayjs(props.to).format("YYYY-MM-DD")}`
    )
    .then((response) => {
      chartSeries.value = response.data.map((item) => item.count);
      // Remove everything that is less than 5% of the total but don't change the total
      const total = chartSeries.value.reduce((acc, cur) => acc + cur, 0);
      chartSeries.value = chartSeries.value.filter((item) => item / total > 0.05);
      chartOptions.value.labels = response.data.map((item) => item.dataSource).filter((item, index) => chartSeries.value[index] / total > 0.05);
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
