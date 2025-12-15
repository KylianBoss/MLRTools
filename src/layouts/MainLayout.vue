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
          <q-badge color="red" floating v-if="notifications.length > 0">
            {{ notifications.length }}
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
            <drawer-item
              to="custom-charts"
              autorisation="custom-charts"
              icon="mdi-chart-line"
              label="Graphiques personnalisés"
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

    <!-- NOTIFICATIONS -->
    <q-drawer
      v-model="rightDrawerOpen"
      width="500"
      bordered
      side="right"
      dense
      overlay
    >
      <q-scroll-area class="fit q-py-sm">
        <q-list>
          <q-item-label class="text-h6 q-mb-md q-px-sm">
            Notifications
          </q-item-label>
          <q-item
            v-for="(notif, index) in notifications"
            :key="index"
            class="q-pa-none q-ma-none q-mb-xs"
            :class="{ 'bg-grey-2': !notif.read }"
          >
            <q-item-section avatar class="q-px-xs col-auto text-left">
              <q-icon
                :name="getNotificationData(notif).icon"
                :color="getNotificationData(notif).color"
              />
            </q-item-section>
            <q-item-section class="text-left">
              <q-item-label>{{ notif.message }}</q-item-label>
              <q-item-label caption>
                {{ new Date(notif.createdAt).toLocaleString() }}
              </q-item-label>
            </q-item-section>
            <q-item-section side class="col-auto text-right">
              <q-btn
                flat
                dense
                icon="mdi-eye-off-outline"
                @click="readNotification(notif)"
                v-if="!notif.read"
              />
              <q-btn
                flat
                dense
                icon="mdi-delete-outline"
                @click="deleteNotification(notif)"
                v-else
              />
            </q-item-section>
            <q-separator
              v-if="index < notifications.length - 1"
              class="q-mt-sm"
            />
          </q-item>
          <q-item v-if="notifications.length === 0">
            <q-item-section>
              <q-item-label class="text-center">
                Aucune notification
              </q-item-label>
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
const notifications = ref([]);

const closeDrawers = () => {
  drawers.value = [];
};

watch(miniState, (value) => {
  if (value) closeDrawers();
});

const getBotsStatus = async () => {
  try {
    const response = await api.get("/bot/status");
    if (response.data && response.data.length === 0) {
      notifications.value.push({
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
        notifications.value.push({
          message: "Aucun bot actif",
          type: "error",
        });
      }
    }
  } catch (error) {
    console.error("Error fetching bot status:", error);
  }
};

const getNotifications = async () => {
  try {
    const response = await api.get(`/notifications/${App.user.id}`);
    notifications.value = response.data || [];
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }
};

const getNotificationData = (notification) => {
  switch (notification.type) {
    case "error":
      return {
        icon: "mdi-alert",
        color: "red",
      };
    case "info":
      return {
        icon: "mdi-information-outline",
        color: "blue",
      };
    case "warning":
      return {
        icon: "mdi-alert-outline",
        color: "orange",
      };
    case "success":
      return {
        icon: "mdi-check-circle-outline",
        color: "green",
      };
    default:
      return {
        icon: "mdi-bell-outline",
        color: "primary",
      };
  }
};

const readNotification = async (notification) => {
  try {
    await api.post(`/notifications/read/${notification.id}`);
    notification.read = true;
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

const deleteNotification = async (notification) => {
  try {
    await api.delete(`/notifications/${notification.id}`);
    notifications.value = notifications.value.filter(
      (notif) => notif.id !== notification.id
    );
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
};

onMounted(async () => {
  await App.init();
  await dataLogStore.initialize();
  loaded.value = true;
  if (App.isAdmin) {
    getBotsStatus();
    getNotifications();
    setInterval(getBotsStatus, 60000); // every minute
    setInterval(getNotifications, 60000); // every minute
  }
  if (App.isBot) {
    window.electron.minimizeApp();
  }
});
</script>

<style>
body {
  background-color: #f5f5f5;
  font-family: Helvetica-Text, Helvetica, Arial, sans-serif;
}
</style>
