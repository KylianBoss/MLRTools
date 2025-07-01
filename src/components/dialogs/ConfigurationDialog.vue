<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Configuration manquante</div>
        <div>Veuillez charger le fichier de configuration</div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="configFile"
          type="file"
          accept=".json"
          label="Fichier de configuration"
          required
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          flat
          label="Charger"
          color="primary"
          @click="onOk"
          :disable="!configFile"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref } from "vue";

const configFile = ref(null);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const onOk = () => {
  onDialogOK(configFile.value);
};
</script>

<style></style>
