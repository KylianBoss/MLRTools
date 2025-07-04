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
        />
        <q-file
          v-model="selectedFilePath"
          type="file"
          accept=".txt,.csv"
          multiple
          style="display: none"
          ref="fileInput"
        />
        <textarea
          v-model="data"
          rows="5"
          class="full-width"
          placeholder="Paste your data here"
          v-if="!selectedFilePath"
        />
        <q-btn
          v-if="selectedFilePath || data.length"
          color="secondary"
          label="Import"
          @click="importFile"
          class="full-width"
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

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const selectedFilePath = ref(null);
const saved = ref(false);
// const date = ref(dayjs().format("YYYY/MM/DD"));
// const filter = ref("");
const data = ref("");
const estimatedTimeLeft = ref(0);
const fileInput = ref(null);

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

const selectFile = async () => {
  // try {
  //   const result = await window.electron.selectFile({
  //     name: "Text Files or CSV",
  //     extensions: ["txt", "csv"],
  //   });
  //   if (result.canceled) {
  //     return;
  //   }
  //   selectedFilePath.value = result.filePaths;
  // } catch (error) {
  //   console.error("Error selecting file:", error);
  //   $q.notify({
  //     type: "negative",
  //     message: "Error selecting file: " + error.message,
  //   });
  // }
};

const importFile = async () => {
  if (!data.value && !selectedFilePath.value) {
    $q.notify({
      type: "negative",
      message: "No data to import",
    });
    return;
  }

  if (data.value && data.value.length) {
    console.log("Importing data from textarea");
    try {
      const fileContent = data.value.split("\n");
      const totalLines = fileContent.length;
      dataLogStore.startImport(totalLines);

      for (const line of fileContent) {
        await dataLogStore.importDataChunk([line]);
        estimatedTimeLeft.value = dataLogStore.progression.estimatedTimeLeft;
      }

      $q.notify({
        type: "positive",
        message: "Data imported successfully",
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });

      dataLogStore.finishImport();
      data.value = "";
      saved.value = false;
      return;
    } catch (error) {
      console.error("Error importing data:", error);
      $q.notify({
        type: "negative",
        message: "Error importing data: " + error.message,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });
      return;
    }
  }

  if (!selectedFilePath.value) return;

  for (const file of selectedFilePath.value) {
    try {
      const fileType = file.name.split(".").pop().toLowerCase();
      const fileReader = new FileReader();
      const fileContent = await new Promise((resolve, reject) => {
        fileReader.onload = (event) => {
          const content = event.target.result;
          resolve(
            content
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          );
        };
        fileReader.onerror = (error) => reject(error);
        fileReader.readAsText(file);
      });

      const totalLines = fileContent.length;
      console.log("Total lines:", totalLines);
      dataLogStore.startImport(totalLines);

      const chunkSize = 1000;
      const chunks = [];
      for (let i = 0; i < fileContent.length; i += chunkSize) {
        chunks.push(fileContent.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        await dataLogStore.importDataChunk(chunk, fileType);
        estimatedTimeLeft.value = dataLogStore.progression.estimatedTimeLeft;
      }

      $q.notify({
        type: "positive",
        message: `File : ${file.name} imported successfully`,
        actions: [{ icon: "close", color: "white" }],
        timeout: 0,
      });

      dataLogStore.finishImport();
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
