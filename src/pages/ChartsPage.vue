<template>
  <q-page padding>
    <div class="text-h4">Graphiques</div>
    <!-- <div class="text-h5">Messages d'erreur par zone</div>
    <vue-apex-charts
      type="pie"
      height="350"
      :options="chartMessagesCountOptions"
      :series="chartMessagesCountSeries"
      v-if="chartMessagesCountVisibility"
    /> -->
    <div class="row">
      <div class="col">
        <messages-by-day
          :from="dayjs().set('date', 1).set('month', 1).format('YYYY-MM-DD')"
          :to="dayjs().format('YYYY-MM-DD')"
        />
      </div>
    </div>
    <div class="row">
      <div class="col">
        <errors-per-zone-count
          :from="dayjs().set('date', 1).set('month', 1).format('YYYY-MM-DD')"
          :to="dayjs().format('YYYY-MM-DD')"
        />
      </div>
      <div class="col"></div>
    </div>
  </q-page>
</template>

<script setup>
import MessagesByDay from "src/components/charts/MessagesByDay.vue";
import ErrorsPerZoneCount from "src/components/charts/ErrorsPerZoneCount.vue";
import VueApexCharts from "vue3-apexcharts";
import dayjs from "dayjs";
import { ref } from "vue";

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
const chartMessagesCountOptions = ref({
  chart: {
    height: 350,
    type: "pie",
    stackable: false,
    defaultLocale: "fr",
    locales: locale,
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
    position: "right",
  },
});
const chartMessagesCountSeries = ref([]);
const chartMessagesCountVisibility = ref(false);

window.electron
  .serverRequest(
    "GET",
    `/charts/messages-per-zone/${dayjs()
      .set("date", 1)
      .set("month", 1)
      .format("YYYY-MM-DD")}/${dayjs().format("YYYY-MM-DD")}`
  )
  .then((response) => {
    console.log("RESPONSE", response);
    chartMessagesCountSeries.value = response.data.map((item) => item.count);
    chartMessagesCountOptions.value.labels = response.data.map(
      (item) => item.dataSource
    );
    chartMessagesCountVisibility.value = true;
  });
</script>

<style></style>
