<template>
  <vue-apex-charts
    type="bar"
    :height="height"
    :options="chartOptions"
    :series="chartSeries"
    :key="chartSeries.length"
    v-if="chartVisibility"
  />
  <q-skeleton v-else :height="`${height}px`" square />
</template>

<script setup>
import VueApexCharts from "vue3-apexcharts";
import dayjs from "dayjs";
import { ref, onMounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  locale: {
    type: Array,
    required: false,
  },
  height: {
    type: Number,
    default: 300,
  },
});

const emits = defineEmits(["loaded"]);

const chartOptions = ref({
  chart: {
    height: props.height,
    type: "bar",
    defaultLocale: "fr",
    locales: props.locale,
    toolbar: {
      show: true,
    },
  },
  title: {
    text: "Moyenne des pannes par heure - 7 derniers jours",
    align: "center",
    style: {
      fontSize: "16px",
      fontWeight: "bold",
    },
  },
  dataLabels: {
    enabled: true,
    formatter: (value) => value.toFixed(1),
    style: {
      fontSize: "11px",
      fontWeight: "bold",
    },
  },
  plotOptions: {
    bar: {
      columnWidth: "60%",
      borderRadius: 2,
      distributed: true,
      dataLabels: {
        position: "top",
      },
    },
  },
  legend: {
    show: false,
  },
  xaxis: {
    categories: Array.from({ length: 24 }, (_, h) => `${h}h`),
    title: {
      text: "Heure de la journée",
    },
  },
  yaxis: {
    title: {
      text: "Nombre moyen de pannes",
    },
    forceNiceScale: true,
  },
  colors: ["#00897B"],
});
const chartSeries = ref([]);
const chartVisibility = ref(false);

const DAYS_COUNT = 7;

const getData = async () => {
  chartVisibility.value = false;

  // Plage : de J-7 à J-1 (veille), aujourd'hui exclu (données incomplètes)
  const from = dayjs().subtract(DAYS_COUNT, "day").format("YYYY-MM-DD");
  const to = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  try {
    const response = await api.get("/kpi/charts/alarms-by-hour", {
      params: { from, to },
    });

    const hourly = response.data ?? [];
    // Somme sur les 7 jours ÷ 7 = moyenne par heure
    const averages = Array.from({ length: 24 }, (_, h) => {
      const row = hourly.find((r) => r.hourOfDay === h);
      const total = row ? row.alarmCount : 0;
      return Math.round((total / DAYS_COUNT) * 10) / 10;
    });

    // Met en évidence les heures de pointe (haut du top 25%)
    const max = Math.max(...averages, 0);
    chartOptions.value = {
      ...chartOptions.value,
      title: {
        ...chartOptions.value.title,
        text: `Moyenne des pannes par heure - du ${dayjs(from).format(
          "DD.MM.YYYY"
        )} au ${dayjs(to).format("DD.MM.YYYY")}`,
      },
      colors: averages.map((a) =>
        max > 0 && a >= max * 0.75 ? "#C10015" : "#00897B"
      ),
    };

    chartSeries.value = [
      {
        name: "Moyenne de pannes",
        data: averages,
      },
    ];

    chartVisibility.value = true;
    emits("loaded");
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de la moyenne des pannes par heure:",
      error
    );
  }
};

onMounted(() => {
  getData();
});
</script>

<style></style>
