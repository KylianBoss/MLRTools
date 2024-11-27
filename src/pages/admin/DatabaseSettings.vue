<template>
  <q-page padding>
    <div class="text-h4">Database</div>
    <div class="row">
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
  </q-page>
</template>

<script setup>
import { useDBStore } from "stores/db";

const DB = useDBStore();
</script>

<style></style>
