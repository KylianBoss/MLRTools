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
          :disable="loading"
        />
        <q-linear-progress
          v-if="printing"
          stripe
          :value="printValue"
          class="q-mt-sm text-center"
          style="height: 25px"
        >
          <div class="absolute-full flex flex-center">
            <q-badge
              text-color="white"
              :label="`${Math.round(printValue * 100)}%`"
            />
          </div>
        </q-linear-progress>
      </div>
    </div>
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
          @loaded="customCharts[index] = true"
          :id="`group-chart-${groups.length + index + 1}`"
          v-if="charts.filter((gc) => gc).length + 2 >= groups.length + index"
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
import * as htmlToImage from "html-to-image";

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
const printing = ref(false);
const printValue = ref(0);
const groups = ref([]);
const customs = ref([]);
const groupCharts = ref([false]);
const customCharts = ref([false]);
const charts = computed(() => {
  return [...groupCharts.value, ...customCharts.value];
});
const loading = ref(false);
const allLoaded = computed(() => {
  return charts.value.every((v) => v);
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

const printPDF = async () => {
  if (!allLoaded.value) {
    console.warn("Tous les graphiques ne sont pas encore chargés.");
    return;
  }
  printing.value = true;
  printValue.value = 0;
  loading.value = true;
  const maxPrintingSteps = charts.value.length + 2;
  let currentStep = 0;
  const updateProgress = () => {
    currentStep++;
    printValue.value = currentStep / maxPrintingSteps;
  };
  const id = await api.get("/kpi/charts/print").then((response) => {
    return response.data.id;
  });
  updateProgress();
  console.log(id);

  // Capture the SevenDaysAverage chart
  // const sevenDaysChartNode = document.getElementById(`seven-days-average-chart`);
  // domtoimage.toPng(sevenDaysChartNode).then(async (dataUrl) => {
  //   await api.post(`/kpi/charts/print/${id}`, { image: dataUrl });
  //   updateProgress();
  // })
  // .catch((error) => {
  //   console.error("Erreur lors de la capture du graphique Seven Days Average:", error);
  //   return;
  // });

  // Capture each group chart
  for (let i = 0; i < charts.value.length - 1; i++) {
    if (charts.value[i]) {
      let node = document.getElementById(`group-chart-${i}`);
      if (!node) {
        console.error(`Element with ID group-chart-${i} not found.`);
        continue;
      }
      const image = await htmlToImage
        .toPng(node, { backgroundColor: "#ffffff" })
        .catch((error) => {
          console.error(
            `Erreur lors de la capture du graphique group-chart-${i}:`,
            error
          );
        });

      await api.post(`/kpi/charts/print/${id}`, { image });
      updateProgress();
    }
  }
  // After capturing all charts, you can handle the PDF generation
  const pdfResponse = await api.get(`/kpi/charts/print/${id}`, {
    responseType: "blob", // Ensure the response is treated as a blob for PDF
  });
  updateProgress();
  const blob = new Blob([pdfResponse.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `KPI-${new Date().toISOString()}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  console.log("PDF generated and downloaded successfully.");
  loading.value = false;
  printing.value = false;
  printValue.value = 0;
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

const scrollTo = (selector) => {
  // const element = document.querySelector(selector);
  // if (element) {
  //   element.scrollIntoView({ behavior: "smooth" });
  // }
  return;
};

onMounted(() => {
  fetchGroups();
  fetchCustomCharts();
});
</script>

<style></style>
