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
          label="Demander au bot d'extraire le WMS pour une date"
          color="primary"
          @click="askExtractWMS"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander au bot d'extraire le nombre de trays pour une date"
          color="primary"
          @click="askExtractTrayAmount"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander au bot d'extraire les données SAV pour une date"
          color="primary"
          @click="askExtractSAV"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Demander aux bots de redémarrer"
          color="primary"
          @click="askBotToRestart"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Extraire le nombre de trays pour une date"
          color="primary"
          @click="extractTrayAmount"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Internal route to charts"
          color="primary"
          @click="routeToCharts"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <!-- <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Maximise"
          color="primary"
          @click="maximise"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div>
    <div class="row q-py-xs">
      <div class="col">
        <q-btn
          label="Fullscreen"
          color="primary"
          @click="fullscreen"
          class="full-width"
          :loading="DB.loadingState"
        />
      </div>
    </div> -->
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

// const extractTrayAmount = () => {
//   $q.dialog({
//     title: "Extraire le nombre de trays",
//     message: "Saisir la date pour l'extraction",
//     prompt: {
//       label: "Date",
//       type: "date",
//       mask: "##.##.####",
//       model: null,
//     },
//     cancel: true,
//     persistent: true,
//   }).onOk((data) => {
//     const date = data;
//     api
//       .get(`/extract/${date}`)
//       .then((response) => {
//         if (response.data.success) {
//           $q.notify({
//             type: "positive",
//             message: `Extraction réussie pour la date ${date}`,
//           });
//         } else {
//           $q.notify({
//             type: "negative",
//             message: "Erreur lors de l'extraction des trays",
//           });
//         }
//       })
//       .catch((error) => {
//         $q.notify({
//           type: "negative",
//           message: `Erreur: ${error.message}`,
//         });
//       });
//   });
// };

const askExtractTrayAmount = () => {
  $q.dialog({
    title: "Demander au bot d'extraire le nombre de trays",
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
      .post(`/bot/ask/extract`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire les trays le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askExtractWMS = () => {
  $q.dialog({
    title: "Demander au bot d'extraire le WMS",
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
      .post(`/bot/ask/extractWMS`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire le WMS pour le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askExtractSAV = () => {
  $q.dialog({
    title: "Demander au bot d'extraire les données SAV",
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
      .post(`/bot/ask/extractSAV`, { date })
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Le bot a été notifié pour extraire les données SAV pour le ${date}`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const askBotToRestart = () => {
  $q.dialog({
    title: "Demander aux bots de redémarrer",
    message: "Êtes-vous sûr de vouloir redémarrer tous les bots ?",
    cancel: true,
    persistent: true,
  }).onOk(() => {
    api
      .post(`/bot/ask/restart`)
      .then((response) => {
        $q.notify({
          type: "positive",
          message: `Les bots ont été notifiés pour redémarrer`,
        });
      })
      .catch((error) => {
        $q.notify({
          type: "negative",
          message: `Erreur: ${error.message}`,
        });
      });
  });
};

const routeToCharts = () => {
  api
    .get(`/cron/test`)
    .then((response) => {
      $q.notify({
        type: "positive",
        message: `Commande de routage envoyée au frontend`,
      });
    })
    .catch((error) => {
      $q.notify({
        type: "negative",
        message: `Erreur: ${error.message}`,
      });
    });
};

const maximise = () => {
  window.electron.maximizeApp();
};

const fullscreen = () => {
  window.electron.toggleFullscreenApp();
};
</script>

<style></style>
