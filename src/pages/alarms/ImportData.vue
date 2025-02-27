<template>
  <q-page padding>
    <!-- Create an input to import a txt file -->
    <q-card class="q-mb-md">
      <q-card-section v-if="!dataLogStore.loading" class="q-pa-md">
        <q-btn
          color="primary"
          label="Select File"
          @click="selectFile"
          class="full-width q-mb-md"
          v-if="!data.length"
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
    <q-table
      :rows="dataLogStore.alarms"
      row-key="alarmId"
      wrap-cells
      flat
      bordered
      :filter="filter"
    >
      <template v-slot:top>
        <q-input
          v-model="filter"
          label="Rechercher"
          color="primary"
          dense
          class="full-width"
        />
      </template>
      <template v-slot:body="props">
        <tr :props="props">
          <td>{{ props.row.alarmId }}</td>
          <td>{{ props.row.dataSource.toUpperCase() }}</td>
          <td>{{ props.row.alarmArea.toUpperCase() }}</td>
          <td>{{ props.row.alarmCode.toUpperCase() }}</td>
          <td>{{ props.row.alarmText }}</td>
          <q-menu touch-position context-menu>
            <q-list dense style="min-width: 100px">
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.excludeAlarmId(props.row.alarmId)"
              >
                <q-item-section>Exclure cette alarme</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.excludeAlarmCode(props.row.alarmCode)"
                v-if="props.row.alarmCode"
              >
                <q-item-section>Exclure ce code d'alarme</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="translateAlarm(props.row.alarmId)"
              >
                <q-item-section>Ajouter une traduction</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </tr>
      </template>
    </q-table>
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
const date = ref(dayjs().format("YYYY/MM/DD"));
const filter = ref("");
const data = ref("");
const estimatedTimeLeft = ref(0);

const selectFile = async () => {
  try {
    const result = await window.electron.selectFile({
      name: "Text Files or CSV",
      extensions: ["txt", "csv"],
    });
    if (result.canceled) {
      return;
    }
    selectedFilePath.value = result.filePaths;
  } catch (error) {
    console.error("Error selecting file:", error);
    $q.notify({
      type: "negative",
      message: "Error selecting file: " + error.message,
    });
  }
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

  for (const filePath of selectedFilePath.value) {
    console.log("Importing file:", filePath);

    try {
      const fileType = filePath.split(".").pop().toLowerCase();
      const fileContent = await window.electron.readLargeFile(filePath);

      const totalLines = fileContent.reduce(
        (acc, chunk) => acc + chunk.length,
        0
      );
      console.log("Total lines:", totalLines);
      dataLogStore.startImport(totalLines);

      for (const chunk of fileContent) {
        await dataLogStore.importDataChunk(chunk, fileType);
        estimatedTimeLeft.value = dataLogStore.progression.estimatedTimeLeft;
      }

      $q.notify({
        type: "positive",
        message: `File : ${filePath} imported successfully`,
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

const translateAlarm = async (alarmId) => {
  $q.dialog({
    title: "Ajouter une traduction",
    message: "Entrez la traduction de l'alarme",
    prompt: {
      model: "",
      type: "text",
    },
    cancel: true,
    persistent: true,
  }).onOk(async (data) => {
    await dataLogStore.translateAlarm(alarmId, data);
    // dataLogStore.initialize();
  });
};

onMounted(async () => {
  dataLogStore.initialize();
  setInterval(() => {
    if (dataLogStore.importing) {
      estimatedTimeLeft.value = estimatedTimeLeft.value - 1;
    }
  }, 1000);
});
</script>
