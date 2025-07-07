<template>
  <q-page padding>
    <div class="text-h4">Graphiques des pannes</div>
    <div class="row q-my-xs">
      <div class="col">
        <seven-days-average :locale="locale" />
      </div>
    </div>
    <div class="row q-my-xs" v-for="(group, index) in groups" :key="index">
      <div class="col">
        <group-chart :locale="locale" :group="group" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import SevenDaysAverage from "components/charts/SevenDaysAverage.vue";
import GroupChart from "components/charts/GroupChart.vue";
import { api } from "boot/axios";
import { ref, onMounted } from "vue";

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
const groups = ref([]);
const fetchGroups = async () => {
  try {
    const response = await api.get("/kpi/groups");
    groups.value = response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des groupes:", error);
  }
};

onMounted(() => {
  fetchGroups();
});
</script>

<style></style>
