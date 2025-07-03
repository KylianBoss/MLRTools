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
      <update-checker v-if="loaded" />
    </q-header>

    <!-- MENU -->
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
          <!-- HOME -->
          <drawer-item
            to="home"
            autorisation="*"
            icon="mdi-home"
            label="Accueil"
          />
          <!-- KPI -->
          <drawer-item
            to="kpi"
            autorisation="kpi"
            icon="mdi-chart-arc"
            label="KPI"
            v-if="App.userHasAccess('kpi')"
          />
          <!-- SEARCH -->
          <q-item
            clickable
            v-ripple
            :to="{ name: 'search' }"
            :active="$route.name == 'search'"
            v-if="App.userHasAccess('searchMessages')"
          >
            <q-item-section avatar>
              <q-icon name="mdi-magnify" />
            </q-item-section>
            <q-item-section>Recherche alarmes</q-item-section>
          </q-item>
          <!-- CHARTS -->
          <q-expansion-item
            expand-separator
            icon="mdi-chart-bell-curve-cumulative"
            label="Graphiques"
            v-model="drawers[0]"
            v-if="App.userHaveAccessToOneOf(['charts'])"
          >
            <drawer-item
              to="charts"
              autorisation="charts"
              icon="mdi-chart-bell-curve-cumulative"
              label="Graphiques"
            />
          </q-expansion-item>
          <!-- ALARMS -->
          <q-expansion-item
            expand-separator
            icon="mdi-bell-outline"
            label="Alarmes"
            v-model="drawers[1]"
            v-if="
              App.userHaveAccessToOneOf([
                'importMessages',
                'alarmList',
                'excludedAlarms',
                'tgwReportZones',
              ])
            "
          >
            <drawer-item
              to="import"
              autorisation="importMessages"
              icon="mdi-file-import-outline"
              label="Importer des messages"
            />
            <drawer-item
              to="alarm-list"
              autorisation="alarmList"
              icon="mdi-format-list-bulleted-type"
              label="Liste des alarmes"
            />
            <drawer-item
              to="tgw-report-zones"
              autorisation="tgwReportZones"
              icon="mdi-order-bool-ascending-variant"
              label="TGW Rapport zones"
            />
            <drawer-item
              to="tgw-report"
              autorisation="tgwReportZones"
              icon="mdi-order-bool-ascending-variant"
              label="TGW Rapport"
            />
          </q-expansion-item>
          <!-- DATA -->
          <q-expansion-item
            expand-separator
            icon="mdi-database"
            label="Données"
            v-model="drawers[3]"
            v-if="App.userHaveAccessToOneOf(['productionData'])"
          >
            <drawer-item
              to="production-data"
              autorisation="productionData"
              icon="mdi-timetable"
              label="Données de production"
            />
          </q-expansion-item>
          <!-- TOOLS -->
          <q-expansion-item
            expand-separator
            icon="mdi-toolbox-outline"
            label="Utilitaires"
            v-model="drawers[2]"
            v-if="App.userHaveAccessToOneOf(['suspiciousPlaces'])"
          >
            <drawer-item
              to="suspicious_places"
              autorisation="suspiciousPlaces"
              icon="mdi-map-marker-alert-outline"
              label="Lieux suspects"
            />
          </q-expansion-item>
          <!-- ADMINISTRATION -->
          <q-expansion-item
            expand-separator
            icon="mdi-shield-account-outline"
            label="Administration"
            v-model="drawers[99]"
            v-if="App.userHasAccess('admin')"
          >
            <drawer-item
              to="admin-db"
              autorisation="admin-db"
              icon="mdi-database-settings-outline"
              label="Database"
            />
            <drawer-item
              to="admin-users"
              autorisation="admin-users"
              icon="mdi-account-group-outline"
              label="Users"
            />
          </q-expansion-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <!-- Information banners -->
      <div
        v-if="!App.notConfigured && App.user.autorised && loaded"
        class="q-pa-sm"
      >
        <!-- TGW Report zone -->
        <q-banner
          v-if="
            App.user.UserAccesses.includes('tgwReportZones') &&
            dataLogStore.alarms &&
            dataLogStore.alarms.length -
              dataLogStore.alarms.filter((alarm) => alarm.TGWzone).length >
              0 &&
            !banners['tgw-report-zones']
          "
          class="bg-blue text-white"
          dense
        >
          {{
            dataLogStore.alarms.length -
            dataLogStore.alarms.filter((alarm) => alarm.TGWzone).length
          }}
          alarmes non traitées dans le rapport TGW
          <template v-slot:action>
            <q-btn
              flat
              color="white"
              label="Masquer"
              @click="banners['tgw-report-zones'] = true"
            />
            <q-btn
              flat
              color="white"
              label="TGW Rapport zones"
              :to="{ name: 'tgw-report-zones' }"
            />
          </template>
        </q-banner>
      </div>
      <!-- View -->
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
  </q-layout>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import pack from "../../package.json";
import { useAppStore } from "stores/app";
import { useQuasar, QSpinnerFacebook } from "quasar";
import UpdateChecker from "components/UpdateChecker.vue";
import { useDataLogStore } from "src/stores/datalog";
import DrawerItem from "components/navigation/DrawerItem.vue";

const App = useAppStore();
const $q = useQuasar();
const rightDrawerOpen = ref(true);
const miniState = ref(true);
const drawers = ref([]);
const loaded = ref(false);
const dataLogStore = useDataLogStore();
const banners = ref({
  "tgw-report-zones": false,
});

const closeDrawers = () => {
  drawers.value = [];
};

watch(miniState, (value) => {
  if (value) closeDrawers();
});

onMounted(async () => {
  await App.init();
  await dataLogStore.initialize();
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
