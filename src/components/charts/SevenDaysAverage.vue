<template>
  <q-card>
    <q-card-section>
      <vue-apex-charts
        type="bar"
        height="250"
        :options="chartOptions"
        :series="chartSeries"
        :key="chartSeries.length"
        v-if="chartVisibility"
      />
    </q-card-section>
    <q-card-section>
      <q-table
        :rows="topErrors"
        :columns="columns"
        :rows-per-page-options="[0]"
        no-data-label="Aucune erreur trouvée"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import dayjs from "dayjs";
import { ref, watch } from "vue";
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
  },
  dataLabels: {
    enabled: false,
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
    },
  },
});
const chartSeries = ref([]);
const topErrors = ref([]);
const chartVisibility = ref(false);

const emits = defineEmits(["loaded"]);

const columns = ref([{ name: "error", label: "Erreur", field: "error" }]);
for (let i = 1; i <= 7; i++) {
  columns.value.push({
    name: `day${i}`,
    label: dayjs()
      .subtract(8 - i, "day")
      .format("DD/MM"),
    field: `day${i}`,
  });
}

const getData = async () => {
  chartSeries.value = [];

  const data = await api.get(`/kpi/charts/global-last-7-days`);
  console.log(data);

  chartSeries.value.push(
    {
      name: "Nombre de pannes",
      data: [
        {
          x: "Nombre d'erreurs moyen",
          y: data.data.avg_errors_per_thousand,
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
      name: "Temps de pannes",
      data: [
        {
          x: "Temps de panne moyen",
          y: data.data.avg_downtime_minutes_per_thousand,
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
  chartVisibility.value = true;
  emits("loaded");
  // api.get(
  //     `/charts/last-7-days`
  //   )
  //   .then((response) => {
  //     const { topErrors, chartData } = response.data;

  //     topErrors.value = topErrors;

  //     chartSeries.value.push({
  //       name: "Erreurs",
  //       data: response.data.map((item) => {
  //         return [dayjs(item.date).valueOf(), item.error];
  //       }),
  //       color: "#C10015",
  //       zIndex: 10,
  //     });
  //     chartSeries.value.push({
  //       name: "Avertissements",
  //       data: response.data.map((item) => {
  //         return [dayjs(item.date).valueOf(), item.warning];
  //       }),
  //       color: "#F2C037",
  //       zIndex: 5,
  //     });
  //     chartSeries.value.push({
  //       name: "Total",
  //       data: response.data.map((item) => {
  //         return [dayjs(item.date).valueOf(), item.total];
  //       }),
  //       color: "#000000",
  //     });
  //     chartVisibility.value = true;
  //   });
};

// watch(
//   props,
//   () => {
//     if (dayjs(props.from).isValid() && dayjs(props.to).isValid()) getData();
//   },
//   { deep: true }
// );

getData();
</script>

<style></style>
