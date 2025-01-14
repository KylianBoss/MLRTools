<template>
  <q-page padding>
    <div class="text-h4">Lieux suspects</div>
    <q-btn
      color="primary"
      label="Sélectionner un fichier"
      @click="selectFile"
      class="full-width q-mb-md"
    />
    <q-btn
      color="secondary"
      label="Créer le fichier de contrôle"
      @click="createFile"
      class="full-width q-mb-md"
      v-if="selectedFilePath"
    />
    <!-- <q-btn
      color="secondary"
      label="Imprimer"
      @click="print"
      class="full-width q-mb-md"
      v-if="pdfData"
    /> -->
    <object
      v-if="pdfData"
      :data="pdfData"
      type="application/pdf"
      width="100%"
      height="600"
      title="Fichier de contrôle des lieux suspects"
    />
    <!-- <vue-pdf-embed v-if="pdfData" :source="pdfData" /> -->
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import { useQuasar } from "quasar";
// import VuePdfEmbed from "vue-pdf-embed";

const $q = useQuasar();
const selectedFilePath = ref("");
const pdfData = ref("");

const selectFile = async () => {
  try {
    const result = await window.electron.selectFile({
      name: "Comma separated file",
      extensions: ["csv"],
    });
    if (result.canceled) {
      return;
    }
    selectedFilePath.value = result.filePaths[0];
  } catch (error) {
    console.error("Error selecting file:", error);
    $q.notify({
      type: "negative",
      message: "Error selecting file: " + error.message,
    });
  }
};

const createFile = async () => {
  if (!selectedFilePath.value) return;

  try {
    const fileContent = await window.electron.readLargeFile(
      selectedFilePath.value
    );

    const totalLines = fileContent.reduce(
      (acc, chunk) => acc + chunk.length,
      0
    );

    const places = new Set();
    for (const chunk of fileContent) {
      if (places.size === 0) chunk.shift();
      for (const line of chunk) {
        const data = line.replaceAll('"', "").split(";");
        const location = data[2].match(/G(\d+)R(\d+)E(\d+)K(\d+).+x(\d)z(\d)/);
        if (!location) continue;
        places.add({
          aisle: location[1],
          side: location[2] === "2" ? "Gauche" : "Droite",
          level: location[3],
          maintenanceLevel: [1, 2, 3, 4, 5].includes(Number(location[3]))
            ? `1 (1-5)`
            : [6, 7, 8, 9, 10, 11].includes(Number(location[3]))
            ? `2 (6-11)`
            : [12, 13, 14, 15, 16, 17].includes(Number(location[3]))
            ? `3 (12-17)`
            : [18, 19, 20, 21, 22, 23].includes(Number(location[3]))
            ? `4 (18-23)`
            : `5 (24-28)`,
          rack: location[4],
          x: location[5],
          z: location[6] === "1" ? "Devant" : "Derrière",
          trayNumber: data[4] ? data[4] : "VIDE",
        });
      }
    }

    window.electron
      .serverRequest("POST", "/print/suspicious-places", {
        places: [...places],
      })
      .then(async (res) => {
        // Print the file that you recieved as buffer
        pdfData.value = `data:application/pdf;base64,${res.data}`;
        selectedFilePath.value = "";
        $q.notify({
          type: "positive",
          message: "Fichier de contrôle créé avec succès",
          actions: [{ icon: "close", color: "white" }],
          timeout: 5000,
        });
      });
  } catch (error) {
    console.error("Error reading file:", error);
    $q.notify({
      type: "negative",
      message: "Error reading file: " + error.message,
    });
  }
};

const print = async () => {
  await window.electron.printPDF(pdfData.value);
};
</script>

<style></style>
