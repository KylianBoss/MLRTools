<template>
  <q-page padding>
    <div class="text-h4">Graphiques des pannes</div>
    <div class="row q-my-xs">
      <div class="col">
        <q-btn
          color="primary"
          class="full-width"
          label="Imprimer en PDF"
          @click="printPDF"
          v-if="allLoaded"
          :loading="loading"
        />
      </div>
    </div>
    <div class="row q-my-xs">
      <div class="col">
        <seven-days-average
          :locale="locale"
          @loaded="groupCharts[groups.length] = true"
          :id="`seven-days-average-chart`"
        />
      </div>
    </div>
    <div class="row q-my-xs" v-for="(group, index) in groups" :key="index">
      <div class="col">
        {{ groupCharts.filter((gc) => gc).length }}, {{ index }}
        <group-chart
          :locale="locale"
          :group="group"
          @loaded="groupCharts[index] = true"
          :id="`group-chart-${index}`"
          v-if="groupCharts.filter((gc) => gc).length > index"
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
import html2canvas from "html2canvas";

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
const loading = ref(false);
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

const printPDF = async () => {
  if (!allLoaded.value) {
    console.warn("Tous les graphiques ne sont pas encore chargés.");
    return;
  }
  loading.value = true;
  const id = await api.get("/kpi/charts/print").then((response) => {
    return response.data.id;
  });

  // Capture the SevenDaysAverage chart
  const sevenDaysChartSelector = `#seven-days-average-chart`;
  const sevenDaysImageData = await captureElement(sevenDaysChartSelector);
  await api.post(`/kpi/charts/print/${id}`, { image: sevenDaysImageData });
  // Capture each group chart
  for (let i = 0; i < groupCharts.value.length - 1; i++) {
    if (groupCharts.value[i]) {
      const chartSelector = `#group-chart-${i}`;
      const imageData = await captureElement(chartSelector);
      api.post(`/kpi/charts/print/${id}`, { image: imageData });
    }
  }
  // After capturing all charts, you can handle the PDF generation
  const pdfResponse = await api.get(`/kpi/charts/print/${id}`, {
    responseType: "blob", // Ensure the response is treated as a blob for PDF
  });
  const blob = new Blob([pdfResponse.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `charts-${new Date().toISOString()}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  console.log("PDF generated and downloaded successfully.");
  loading.value = false;
};

// Dans le processus de rendu (renderer)
async function captureElement(selector) {
  const element = document.querySelector(selector);

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    allowTaint: true,
    useCORS: true,
    scale: 2, // Augmente la résolution de l'image
    logging: false, // Pour le débogage
    windowWidth: element.outerWidth,
    windowHeight: 800,
  });

  return canvas.toDataURL("image/png");
  // src.value = canvas.toDataURL("image/png");
}

onMounted(() => {
  fetchGroups();
});
</script>

<style></style>
