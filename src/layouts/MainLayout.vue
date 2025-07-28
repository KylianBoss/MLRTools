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
        <q-btn
          flat
          dense
          icon="mdi-alert"
          v-if="App.isAdmin"
          @click="rightDrawerOpen = !rightDrawerOpen"
          class="q-ml-sm"
        >
          <q-badge color="red" floating v-if="errors.length > 0">
            {{ errors.length }}
          </q-badge>
        </q-btn>
      </q-toolbar>
      <update-checker v-if="loaded" />
    </q-header>

    <!-- MENU -->
    <q-drawer
      v-model="leftDrawerOpen"
      :breakpoint="500"
      bordered
      side="left"
      mini-to-overlay
      @mouseenter="miniState = false"
      @mouseleave="miniState = true"
      :mini="miniState"
      dense
      v-if="!App.notConfigured && App.user.autorised && loaded && !App.isBot"
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
              to="general-charts"
              autorisation="charts"
              icon="mdi-chart-bell-curve-cumulative"
              label="Graphiques généraux"
            />
            <drawer-item
              to="faillures-charts"
              autorisation="charts"
              icon="mdi-chart-bell-curve"
              label="Graphiques des pannes"
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
          <!-- MAINTENANCE -->
          <q-expansion-item
            expand-separator
            icon="mdi-wrench"
            label="Maintenance"
            v-model="drawers[4]"
            v-if="App.isTechnician || App.isAdmin"
          >
            <drawer-item
              to="maintenances-scheduled"
              autorisation="*"
              icon="mdi-timetable"
              label="Maintenances plannifiées"
            />
            <drawer-item
              to="maintenance-plans"
              autorisation="*"
              icon="mdi-format-list-checks"
              label="Plans de maintenance"
            />
            <drawer-item
              to="maintenance-steps"
              autorisation="*"
              icon="mdi-content-paste"
              label="Étapes de maintenance"
            />
            <drawer-item
              to="maintenance-logs"
              autorisation="*"
              icon="mdi-file-document-outline"
              label="Logs de maintenance"
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

    <!-- ERRORS -->
    <q-drawer
      v-model="rightDrawerOpen"
      :breakpoint="500"
      bordered
      side="right"
      dense
      overlay
    >
      <q-scroll-area class="fit q-pa-sm">
        <q-list>
          <q-item-label class="text-h6 q-mb-md">Erreurs</q-item-label>
          <q-item v-for="(error, index) in errors" :key="index" class="-mb-sm">
            <q-item-section avatar>
              <q-icon
                v-if="error.type === 'error'"
                name="mdi-alert"
                color="red"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ error.message }}</q-item-label>
            </q-item-section>
            <q-separator v-if="index < errors.length - 1" class="q-mt-sm" />
          </q-item>
          <q-item v-if="errors.length === 0">
            <q-item-section>
              <q-item-label class="text-center">Aucune erreur</q-item-label>
            </q-item-section>
          </q-item>
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
import { ref, watch, onMounted } from "vue";
import pack from "../../package.json";
import { useAppStore } from "stores/app";
import UpdateChecker from "components/UpdateChecker.vue";
import { useDataLogStore } from "src/stores/datalog";
import DrawerItem from "components/navigation/DrawerItem.vue";
import { api } from "boot/axios";

const App = useAppStore();
const leftDrawerOpen = ref(true);
const rightDrawerOpen = ref(false);
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

const errors = ref([]);

watch(miniState, (value) => {
  if (value) closeDrawers();
});

const getBotsStatus = async () => {
  try {
    const response = await api.get("/bot/status");
    if (response.data && response.data.length === 0) {
      errors.value.push({
        message: "Aucun bot programmé",
        type: "error",
      });
    } else if (response.data && response.data.length > 0) {
      let isOneBotActive = false;
      response.data.forEach((bot) => {
        if (!!bot.isActive) {
          isOneBotActive = true;
        }
      });
      if (!isOneBotActive) {
        errors.value.push({
          message: "Aucun bot actif",
          type: "error",
        });
      }
    } else {
      errors.value = [];
    }
  } catch (error) {
    console.error("Error fetching bot status:", error);
  }
};

onMounted(async () => {
  await App.init();
  await dataLogStore.initialize();
  loaded.value = true;
  if (App.isAdmin) {
    getBotsStatus();
    setInterval(getBotsStatus, 60000); // every minute
  }
});
</script>

<style>
body {
  background-color: #f5f5f5;
  font-family: Helvetica-Text, Helvetica, Arial, sans-serif;
}
</style>
