<template>
  <q-page padding id="failures-charts-page">
    <div class="text-h4">Graphiques des pannes</div>
    <pre>{{ allLoaded }}</pre>
    <div class="row q-my-xs">
      <div class="col">
        <q-btn
          color="primary"
          class="full-width"
          label="Imprimer en PDF"
          @click="printPDF"
        />
      </div>
    </div>
    <div class="row q-my-xs">
      <div class="col">
        <seven-days-average :locale="locale" @loaded="groupCharts[groups.length] = true" />
      </div>
    </div>
    <div class="row q-my-xs" v-for="(group, index) in groups" :key="index">
      <div class="col">
        <group-chart
          :locale="locale"
          :group="group"
          @loaded="groupCharts[index] = true"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import SevenDaysAverage from "components/charts/SevenDaysAverage.vue";
import GroupChart from "components/charts/GroupChart.vue";
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
const groupCharts = ref([false]);
const allLoaded = computed(() => {
  return groupCharts.value.every((v) => v);
});

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

const printPDF = () => {
  const _doc = document.querySelector("#failures-charts-page");
  if (!_doc) {
    console.error("Élément non trouvé pour l'impression PDF");
    return;
  }

  const groupChartsElements = groupCharts.value;
  if (groupChartsElements && groupChartsElements.length > 0) {
    groupChartsElements.forEach(async (chart) => {
      console.log(chart.chart);
      const img = await chart.getChart();
      console.log(img);
    });
  }

  api
    .post("/kpi/charts/print", {
      html: _doc.innerHTML,
    })
    .then((response) => {
      // Response.data is the PDF in base64 format
      const pdfData = `data:application/pdf;base64,${response.data}`;
      const link = document.createElement("a");
      link.href = pdfData;
      link.download = "failures-charts.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch((error) => {
      console.error("Erreur lors de l'impression PDF:", error);
    });
};

onMounted(() => {
  fetchGroups();
});
</script>

<style></style>
