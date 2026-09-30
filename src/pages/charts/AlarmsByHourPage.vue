<template>
  <q-page padding>
    <div class="text-h4">Pannes par heure</div>
    <!-- Veille + moyenne : deux grands graphes côte à côte -->
    <div class="row q-my-xs q-col-gutter-md">
      <div class="col-12 col-md-6">
        <alarms-by-hour-chart :date="yesterday" :locale="locale" :height="380" />
      </div>
      <div class="col-12 col-md-6">
        <alarms-by-hour-average-chart :locale="locale" :height="380" />
      </div>
    </div>
    <q-separator class="q-my-md" />
    <!-- J-2 à J-7 : grille 3 colonnes x 2 lignes -->
    <div class="row q-my-xs q-col-gutter-md">
      <div class="col-12 col-md-4" v-for="date in olderDays" :key="date">
        <alarms-by-hour-chart :date="date" :locale="locale" :height="260" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import AlarmsByHourChart from "components/charts/AlarmsByHourChart.vue";
import AlarmsByHourAverageChart from "components/charts/AlarmsByHourAverageChart.vue";
import dayjs from "dayjs";
import { computed } from "vue";

// Veille (grand graphe du haut)
const yesterday = computed(() => dayjs().subtract(1, "day").format("YYYY-MM-DD"));

// J-2 à J-7 (grille 3x2 du bas), aujourd'hui exclu : données incomplètes
const olderDays = computed(() =>
  Array.from({ length: 6 }, (_, i) =>
    dayjs()
      .subtract(i + 2, "day")
      .format("YYYY-MM-DD")
  )
);

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
</script>

<style></style>
