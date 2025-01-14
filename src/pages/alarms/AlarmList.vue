<template>
  <q-page padding>
    <q-table
      :rows="
        dataLogStore.alarms.map((alarm) => {
          return {
            dataSource: alarm.dataSource.toUpperCase(),
            alarmArea: alarm.alarmArea.toUpperCase(),
            alarmCode: alarm.alarmCode.toUpperCase(),
            alarmText: alarm.alarmText,
            alarmId: alarm.alarmId,
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
        />
      </template>
      <template v-slot:body="props">
        <tr :props="props">
          <td>{{ props.row.dataSource.toUpperCase() }}</td>
          <td>{{ props.row.alarmArea.toUpperCase() }}</td>
          <td>{{ props.row.alarmCode.toUpperCase() }}</td>
          <td>{{ props.row.alarmText }}</td>
          <td>{{ props.row.alarmId }}</td>
          <q-menu
            touch-position
            context-menu
            v-if="App.user.UserAccesses.includes('importMessages')"
          >
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
