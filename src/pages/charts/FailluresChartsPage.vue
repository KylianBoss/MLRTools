<template>
  <q-page padding>
    <div class="text-h4">Graphiques des pannes</div>
    {{ charts.filter((gc) => gc).length }} / {{ charts.length }} graphiques
    chargés.
    <div class="row q-my-xs">
      <div class="col">
        <seven-days-average
          :locale="locale"
          @loaded="groupCharts[groups.length] = true"
          :id="`group-chart-0`"
        />
      </div>
    </div>
    <div class="row q-my-xs" v-for="(group, index) in groups" :key="index">
      <div class="col">
        <group-chart
          :locale="locale"
          :group="group"
          @loaded="
            (groupCharts[index] = true), scrollTo(`#group-chart-${index}`)
          "
          :id="`group-chart-${index + 1}`"
          v-if="groupCharts.filter((gc) => gc).length + 2 >= index"
        />
      </div>
    </div>
    <div class="row q-my-xs" v-for="(chart, index) in customs" :key="index">
      <div class="col">
        <custom-chart
          :locale="locale"
          :chart-data="chart"
          :alarm-list="alarmList"
          @loaded="customCharts[index] = true"
          :id="`group-chart-${groups.length + index + 1}`"
          v-if="charts.filter((gc) => gc).length > groups.length + index"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import SevenDaysAverage from "components/charts/SevenDaysAverage.vue";
import GroupChart from "components/charts/GroupChart.vue";
import CustomChart from "components/charts/CustomChart.vue";
import { api } from "boot/axios";
import { ref, onMounted, computed } from "vue";

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
const customs = ref([]);
const groupCharts = ref([false]);
const customCharts = ref([false]);
const charts = computed(() => {
  return [...groupCharts.value, ...customCharts.value];
});
const alarmList = ref([]);

const fetchGroups = async () => {
  try {
    const response = await api.get("/kpi/groups");
    groups.value = response.data;
    groupCharts.value = Array.from(
      { length: response.data.length },
      () => false
    );
    groupCharts.value.push(false); // For the SevenDaysAverage chart
  } catch (error) {
    console.error("Erreur lors de la récupération des groupes:", error);
  }
};

const fetchCustomCharts = async () => {
  try {
    const response = await api.get("/charts/custom-charts");
    customs.value = response.data;
    customCharts.value = Array.from(
      { length: response.data.length },
      () => false
    );
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des graphiques personnalisés:",
      error
    );
  }
};

const scrollTo = (selector) => {
  return;
};

const fetchAlarmList = async () => {
  try {
    const response = await api.get("/alarms/unique");
    alarmList.value = response.data.filter((alarm) => alarm.alarmId);
  } catch (error) {
    console.error("Erreur lors de la récupération des alarmes:", error);
  }
};

onMounted(() => {
  fetchGroups();
  fetchCustomCharts();
  fetchAlarmList();
});
</script>

<style></style>
