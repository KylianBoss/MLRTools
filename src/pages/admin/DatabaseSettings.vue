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
  </q-page>
</template>

<script setup>
import { useDBStore } from "stores/db";
import { useQuasar } from "quasar";

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
</script>

<style></style>
