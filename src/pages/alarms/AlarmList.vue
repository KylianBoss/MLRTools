<template>
  <q-page padding>
    <div class="text-h4">Liste des alarmes</div>
    <div>
      <q-banner
        class="bg-blue text-white q-my-sm"
        dense
        v-if="
          !dataLogStore.alarms ||
          dataLogStore.alarms.filter((a) => !a.type).length > 0
        "
      >
        Il y a {{ dataLogStore.alarms.filter((a) => !a.type).length }} alarmes
        non classées dans la liste.
        <template v-slot:action>
          <q-btn
            flat
            color="white"
            label="Rafraîchir"
            @click="dataLogStore.initialize()"
          />
        </template>
      </q-banner>
    </div>
    <q-table
      :rows="
        dataLogStore.alarms.map((alarm) => {
          return {
            dataSource: alarm.dataSource.toUpperCase(),
            alarmArea: alarm.alarmArea.toUpperCase(),
            alarmCode: alarm.alarmCode.toUpperCase(),
            alarmText: alarm.alarmText,
            alarmId: alarm.alarmId,
            type: alarm.type,
          };
        })
      "
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
        >
          <template v-slot:append>
            <q-btn
              flat
              color="primary"
              icon="close"
              round
              @click="filter = ''"
              v-if="filter"
            />
          </template>

          <template v-slot:prepend>
            <q-icon name="search" />
          </template>

          <template v-slot:hint>
            Rechercher par ID d'alarme, source de données, zone d'alarme ou code
            d'alarme
          </template>
        </q-input>
      </template>
      <template v-slot:body="props">
        <tr :props="props">
          <td>{{ props.row.dataSource.toUpperCase() }}</td>
          <td>{{ props.row.alarmArea.toUpperCase() }}</td>
          <td>{{ props.row.alarmCode.toUpperCase() }}</td>
          <td>{{ props.row.alarmText }}</td>
          <td>{{ props.row.alarmId }}</td>
          <td>
            <q-badge
              :color="props.row.type === 'primary' ? 'red' : 'blue'"
              class="q-ma-xs"
              v-if="props.row.type"
            >
              {{ props.row.type === "primary" ? "Arrêt" : "Autre" }}
            </q-badge>
            <q-badge color="warning" class="q-ma-xs" v-else>
              Non définit
            </q-badge>
          </td>
          <q-menu
            touch-position
            context-menu
            v-if="App.user.UserAccesses.includes('importMessages')"
          >
            <q-list dense style="min-width: 100px">
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setPrimary(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "primary"</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setSecondary(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "secondary"</q-item-section>
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
import { useQuasar } from "quasar";
import { useAppStore } from "src/stores/app";
import { useRoute } from "vue-router";

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const filter = ref("");
const App = useAppStore();
const $route = useRoute();

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
  });
};

onMounted(async () => {
  dataLogStore.initialize();
  if ($route.query.alarmId) {
    filter.value = $route.query.alarmId;
  }
});
</script>
