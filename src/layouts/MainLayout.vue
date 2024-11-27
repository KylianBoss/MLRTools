<template>
  <q-layout view="hHh Lpr lff">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> Migros Logistique Romande </q-toolbar-title>
        <q-space />
        <!-- VERSION -->
        <span class="text-caption text-right" v-if="loaded">
          {{ App.user ? App.user.fullname : null }}<br />
          {{ pack.version }}
        </span>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="rightDrawerOpen"
      :breakpoint="500"
      bordered
      side="left"
      mini-to-overlay
      @mouseenter="miniState = false"
      @mouseleave="miniState = true"
      :mini="miniState"
      dense
      v-if="!App.notConfigured && App.user.autorised && loaded"
    >
      <q-scroll-area class="fit">
        <q-list>
          <q-item
            clickable
            v-ripple
            :to="{ name: 'home' }"
            :active="$route.name == 'home'"
            v-if="App.user.UserAccesses.includes('kpi')"
          >
            <q-item-section avatar>
              <q-icon name="mdi-chart-arc" />
            </q-item-section>
            <q-item-section>KPI</q-item-section>
          </q-item>
          <q-item
            clickable
            v-ripple
            :to="{ name: 'search' }"
            :active="$route.name == 'search'"
            v-if="App.user.UserAccesses.includes('searchMessages')"
          >
            <q-item-section avatar>
              <q-icon name="mdi-magnify" />
            </q-item-section>
            <q-item-section>Recherche alarmes</q-item-section>
          </q-item>
          <q-item
            clickable
            v-ripple
            :to="{ name: 'charts' }"
            :active="$route.name == 'charts'"
            v-if="App.user.UserAccesses.includes('charts')"
          >
            <q-item-section avatar>
              <q-icon name="mdi-chart-bell-curve-cumulative" />
            </q-item-section>
            <q-item-section>Graphiques</q-item-section>
          </q-item>
          <q-expansion-item
            expand-separator
            icon="mdi-bell-outline"
            label="Alarmes"
            v-model="drawers[0]"
            v-if="
              App.user.UserAccesses.includes('importMessages') ||
              App.user.UserAccesses.includes('excludedAlarms')
            "
          >
            <q-item
              clickable
              v-ripple
              :to="{ name: 'import' }"
              :active="$route.name == 'import'"
              v-if="App.user.UserAccesses.includes('importMessages')"
            >
              <q-item-section avatar>
                <q-icon name="mdi-file-import-outline" />
              </q-item-section>
              <q-item-section>Importer des messages</q-item-section>
            </q-item>
            <q-item
              clickable
              v-ripple
              :to="{ name: 'excluded-alarms' }"
              :active="$route.name == 'excluded-alarms'"
              v-if="App.user.UserAccesses.includes('excludedAlarms')"
            >
              <q-item-section avatar>
                <q-icon name="mdi-bell-cancel-outline" />
              </q-item-section>
              <q-item-section>Alarmes exclues</q-item-section>
            </q-item>
          </q-expansion-item>
          <q-expansion-item
            expand-separator
            icon="mdi-toolbox-outline"
            label="Utilitaires"
            v-model="drawers[1]"
            v-if="App.user.UserAccesses.includes('suspiciousPlaces')"
          >
            <q-item
              clickable
              v-ripple
              :to="{ name: 'suspicious_places' }"
              :active="$route.name == 'suspicious_places'"
              v-if="App.user.UserAccesses.includes('suspiciousPlaces')"
            >
              <q-item-section avatar>
                <q-icon name="mdi-map-marker-alert-outline" />
              </q-item-section>
              <q-item-section>Lieux suspects</q-item-section>
            </q-item>
          </q-expansion-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <router-view v-if="!App.notConfigured && App.user.autorised && loaded" />
      <q-card v-if="!App.notConfigured && !App.user.autorised && loaded">
        <q-card-section>
          <div class="text-h6">Accès refusé</div>
          <div>Vous n'avez pas les droits pour accéder à cette application</div>
          <div>
            Si vous venez d'installer l'application, l'activation prends
            quelques temps.
          </div>
        </q-card-section>
      </q-card>
    </q-page-container>

    <q-dialog v-model="App.notConfigured" persistent v-if="loaded">
      <q-card>
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
            @click="App.loadConfig(configFile)"
            :disable="!configFile"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { ref, watch, onMounted } from "vue";
import pack from "../../package.json";
import { useAppStore } from "stores/app";
import { useQuasar, QSpinnerFacebook } from "quasar";

const App = useAppStore();
const $q = useQuasar();
const rightDrawerOpen = ref(true);
const miniState = ref(true);
const drawers = ref([]);
const configFile = ref(null);
const loaded = ref(false);

const closeDrawers = () => {
  drawers.value = [];
};

watch(miniState, (value) => {
  if (value) closeDrawers();
});

onMounted(async () => {
  showLoading();
  await App.init();
  $q.loading.hide();
  loaded.value = true;
});

const showLoading = () => {
  $q.loading.show({
    spinner: QSpinnerFacebook,
    spinnerColor: "primary",
    spinnerSize: 160,
    backgroundColor: "dark",
    message: "Chargement...",
    messageColor: "white",
  });
};
</script>

<style>
body {
  background-color: #f5f5f5;
  font-family: Helvetica-Text, Helvetica, Arial, sans-serif;
}
</style>
