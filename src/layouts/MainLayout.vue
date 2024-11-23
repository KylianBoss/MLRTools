<template>
  <q-layout view="hHh Lpr lff">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> Migros Logistique Romande </q-toolbar-title>
        <q-space />
        <!-- VERSION -->
        <span class="text-caption">{{ pack.version }}</span>
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
    >
      <q-scroll-area class="fit">
        <q-list>
          <q-item
            clickable
            v-ripple
            :to="{ name: 'home' }"
            :active="$route.name == 'home'"
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
          >
            <q-item
              clickable
              v-ripple
              :to="{ name: 'import' }"
              :active="$route.name == 'import'"
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
          >
            <q-item
              clickable
              v-ripple
              :to="{ name: 'suspicious_places' }"
              :active="$route.name == 'suspicious_places'"
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
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, watch } from "vue";
import pack from "../../package.json";

const rightDrawerOpen = ref(true);
const miniState = ref(true);
const drawers = ref([]);

const closeDrawers = () => {
  drawers.value = [];
};

watch(miniState, (value) => {
  if (value) closeDrawers();
});
</script>

<style>
body {
  background-color: #f5f5f5;
  font-family: Helvetica-Text, Helvetica, Arial, sans-serif;
}
</style>
