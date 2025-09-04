<template>
  <q-page padding>
    <!-- Create an input to import a txt file -->
    <q-card class="q-mb-md">
      <q-card-section v-if="!dataLogStore.loading" class="q-pa-md">
        <q-btn
          color="primary"
          label="Select File"
          @click="triggerFileInput"
          class="full-width q-mb-md"
          v-if="!data.length"
          :loading="loading"
        />
        <q-file
          v-model="selectedFilePath"
          type="file"
          accept=".csv"
          multiple
          style="display: none"
          ref="fileInput"
          :loading="loading"
        />
        <q-btn
          v-if="selectedFilePath"
          color="secondary"
          label="Import"
          @click="importFile"
          class="full-width"
          :loading="loading"
        />
      </q-card-section>
      <q-card-section v-if="dataLogStore.loading">
        <q-linear-progress
          stripe
          size="25px"
          :value="dataLogStore.progression.percentComplete / 100"
          class="text-center"
        >
          <div class="absolute-full flex flex-center">
            <q-badge
              text-color="white"
              :label="`Chargement des données... ${
                dataLogStore.progression.percentComplete
              }% temps restant ${dayjs
                .duration(estimatedTimeLeft, 'seconds')
                .format('HH:mm:ss')} (${
                dataLogStore.progression.linesProcessed
              }/${dataLogStore.progression.totalLines})`"
            />
          </div>
        </q-linear-progress>
        <q-expansion-item label="Dernier objet traité" icon="mdi-information">
          <pre>{{ dataLogStore.lastObjectTreated }}</pre>
        </q-expansion-item>
      </q-card-section>
      <q-card-section v-if="dataLogStore.importError.length > 0">
        <q-icon name="error" color="negative" />
        <span class="text-negative">{{ dataLogStore.importError }}</span>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useDataLogStore } from "stores/datalog";
import dayjs from "dayjs";
import { useQuasar } from "quasar";
import { api } from "boot/axios";

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const selectedFilePath = ref(null);
const saved = ref(false);
const data = ref("");
const estimatedTimeLeft = ref(0);
const fileInput = ref(null);
const loading = ref(false);

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.pickFiles();
  } else {
    console.error("File input reference is not set.");
    $q.notify({
      type: "negative",
      message: "File input reference is not set.",
    });
  }
};

const importFile = async () => {
  if (!selectedFilePath.value) return;

  for (const file of selectedFilePath.value) {
    loading.value = true;
    try {
      const fileType = file.name.split(".").pop().toLowerCase();
      if (fileType !== "csv") {
        $q.notify({
          type: "negative",
          message: "Unsupported file type: " + fileType,
          actions: [{ icon: "close", color: "white" }],
          timeout: 0,
        });
        continue;
      }
      const fileReader = new FileReader();
      const fileContent = await new Promise((resolve, reject) => {
        fileReader.onload = (event) => resolve(event.target.result);
        fileReader.onerror = (error) => reject(error);
        fileReader.readAsText(file);
      });

      api
        .post("alarms/import-alarms", { data: fileContent })
        .then((response) => {
          $q.notify({
            type: "positive",
            message: `File : ${file.name} imported successfully`,
            actions: [{ icon: "close", color: "white" }],
            timeout: 0,
          });
          $q.notify({
            type: "positive",
            message: `Importation de ${response.data.recieved} alarmes, ${response.data.inserted} nouvelles alarmes insérées dans la base de donnée.`,
            actions: [{ icon: "close", color: "white" }],
            position: "top",
            timeout: 10000,
          });
          loading.value = false;
        })
        .catch((error) => {
          console.error("Error importing file:", error);
          $q.notify({
            type: "negative",
            message: "Error importing file: " + error.message,
            actions: [{ icon: "close", color: "white" }],
            timeout: 0,
          });
          loading.value = false;
        });

      //   const totalLines = fileContent.length;
      //   console.log("Total lines:", totalLines);
      //   dataLogStore.startImport(totalLines);

      //   const chunkSize = 1000;
      //   const chunks = [];
      //   for (let i = 0; i < fileContent.length; i += chunkSize) {
      //     chunks.push(fileContent.slice(i, i + chunkSize));
      //   }

      //   for (const chunk of chunks) {
      //     await dataLogStore.importDataChunk(chunk, fileType);
      //     estimatedTimeLeft.value = dataLogStore.progression.estimatedTimeLeft;
      //   }

      //   $q.notify({
      //     type: "positive",
      //     message: `File : ${file.name} imported successfully`,
      //     actions: [{ icon: "close", color: "white" }],
      //     timeout: 0,
      //   });

      //   dataLogStore.finishImport();
    } catch (error) {
      console.error("Error importing file:", error);
      $q.notify({
        type: "negative",
        message: "Error importing file: " + error.message,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });
    }
  }
  saved.value = false;
  selectedFilePath.value = null;
};

// const excludeAlarm = async (alarmId) => {
//   await dataLogStore.excludeAlarm(alarmId);
//   // dataLogStore.initialize();
// };

// const translateAlarm = async (alarmId) => {
//   $q.dialog({
//     title: "Ajouter une traduction",
//     message: "Entrez la traduction de l'alarme",
//     prompt: {
//       model: "",
//       type: "text",
//     },
//     cancel: true,
//     persistent: true,
//   }).onOk(async (data) => {
//     await dataLogStore.translateAlarm(alarmId, data);
//     // dataLogStore.initialize();
//   });
// };

onMounted(async () => {
  // dataLogStore.initialize();
  setInterval(() => {
    if (dataLogStore.importing) {
      estimatedTimeLeft.value = estimatedTimeLeft.value - 1;
    }
  }, 1000);
});
</script>
