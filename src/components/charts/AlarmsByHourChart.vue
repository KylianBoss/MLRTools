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
import { ref, watch, onMounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  // Jour à afficher (YYYY-MM-DD). Le graphe montre les 24h de ce jour.
  date: {
    type: String,
    required: true,
  },
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

// Noms des jours en français, dans l'ordre dayjs().day() (0 = dimanche)
const DAY_NAMES = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

const titleFor = (date) =>
  `Pannes par heure - ${DAY_NAMES[dayjs(date).day()]} ${dayjs(date).format(
    "DD.MM.YYYY"
  )}`;

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
    text: titleFor(props.date),
    align: "center",
    style: {
      fontSize: "16px",
      fontWeight: "bold",
    },
  },
  dataLabels: {
    enabled: true,
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
      text: "Nombre de pannes",
    },
    forceNiceScale: true,
  },
  colors: ["#00897B"],
});
const chartSeries = ref([]);
const chartVisibility = ref(false);

const getData = async () => {
  chartVisibility.value = false;

  try {
    const response = await api.get("/kpi/charts/alarms-by-hour", {
      params: { from: props.date, to: props.date },
    });

    const hourly = response.data ?? [];
    const counts = Array.from({ length: 24 }, (_, h) => {
      const row = hourly.find((r) => r.hourOfDay === h);
      return row ? row.alarmCount : 0;
    });

    // Met en évidence les heures de pointe (haut du top 25%)
    const max = Math.max(...counts, 0);
    chartOptions.value = {
      ...chartOptions.value,
      title: {
        ...chartOptions.value.title,
        text: titleFor(props.date),
      },
      colors: counts.map((c) =>
        max > 0 && c >= max * 0.75 ? "#C10015" : "#00897B"
      ),
    };

    chartSeries.value = [
      {
        name: "Pannes",
        data: counts,
      },
    ];

    chartVisibility.value = true;
    emits("loaded");
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des pannes par heure:",
      error
    );
  }
};

onMounted(() => {
  getData();
});

watch(() => props.date, getData);
</script>

<style></style>
