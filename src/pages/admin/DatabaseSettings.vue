<template>
  <q-page padding>
    <div class="text-h4">Database</div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Synchroniser les modèles"
          color="primary"
          @click="DB.syncModels"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Vider la table day resume"
          color="primary"
          @click="DB.emptyDayResume"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Vider la table day resume à date précise"
          color="primary"
          @click="selectDateToEmpty"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Extraire le nombre de trays pour une date"
          color="primary"
          @click="extractTrayAmount"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useDBStore } from "stores/db";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const DB = useDBStore();
const $q = useQuasar();

const selectDateToEmpty = () => {
  $q.dialog({
    title: "Vider la table day resume à date précise",
    message: "Saisir la date à laquelle vider la table",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    persistent: true,
  }).onOk((data) => {
    DB.emptyDayResumeAtDate(data);
  });
};

const extractTrayAmount = () => {
  $q.dialog({
    title: "Extraire le nombre de trays",
    message: "Saisir la date pour l'extraction",
    prompt: {
      label: "Date",
      type: "date",
      mask: "##.##.####",
      model: null,
    },
    cancel: true,
    persistent: true,
  }).onOk((data) => {
    const date = data;
    api
      .get(`/extract/${date}`)
      .then((response) => {
        if (response.data.success) {
          $q.notify({
            type: "positive",
            message: `Extraction réussie pour la date ${date}`,
          });
        } else {
          $q.notify({
            type: "negative",
            message: "Erreur lors de l'extraction des trays",
          });
        }
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};
</script>

<style></style>
