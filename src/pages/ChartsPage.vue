<template>
  <q-page padding>
    <div class="text-h4">Graphiques généraux</div>
    <div class="row">
      <div class="col">
        <q-input
          filled
          v-model="period.from"
          type="date"
          label="Du"
          dense
          :debounce="1000"
        />
      </div>
      <div class="col">
        <q-input
          filled
          v-model="period.to"
          type="date"
          label="Au"
          dense
          :debounce="1000"
        />
      </div>
    </div>
    <div class="row">
      <div class="col">
        <messages-by-day :from="period.from" :to="period.to" :locale="locale" />
      </div>
    </div>
    <div class="row">
      <div class="col">
        <errors-per-zone-count
          :from="period.from"
          :to="period.to"
          :locale="locale"
        />
      </div>
    </div>
    <div class="row">
      <div class="col">
        <production-volume
          :from="period.from"
          :to="period.to"
          :locale="locale"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import MessagesByDay from "components/charts/MessagesByDay.vue";
import ErrorsPerZoneCount from "components/charts/ErrorsPerZoneCount.vue";
import ProductionVolume from "components/charts/ProductionVolume.vue";
import dayjs from "dayjs";
import { ref } from "vue";

const period = ref({
  // First day of the current month
  from: dayjs().startOf("month").format("YYYY-MM-DD"),
  to: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
});

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
