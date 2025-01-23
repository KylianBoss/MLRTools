<template>
  <q-page padding>
    <q-table
      :rows="excludedAlarms"
      row-key="alarmId"
      wrap-cells
      flat
      bordered
      :filter="filter"
      :loading="excludedAlarms.length === 0"
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
                @click="includeAlarmId(props.row)"
              >
                <q-item-section>Inclure cette alarme (ID)</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="includeAlarmCode(props.row)"
                v-if="props.row.alarmCode"
              >
                <q-item-section>Inclure cette alarme (CODE)</q-item-section>
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

const dataLogStore = useDataLogStore();
const filter = ref("");
const excludedAlarms = ref([]);

const includeAlarmId = async (alarm) => {
  await dataLogStore.includeAlarm(alarm.alarmId);
  excludedAlarms.value = excludedAlarms.value.filter(
    (a) => a.alarmId !== alarm.alarmId
  );
};

const includeAlarmCode = async (alarm) => {
  await dataLogStore.includeAlarm(alarm.alarmCode);
  excludedAlarms.value = excludedAlarms.value.filter(
    (a) => a.alarmCode !== alarm.alarmCode
  );
};

onMounted(async () => {
  await dataLogStore.initialize();
  for (const alarmId of dataLogStore.excludedAlarmIds) {
    dataLogStore.getAlarm(alarmId).then((alarm) => {
      excludedAlarms.value.push(alarm);
    });
  }
  for (const alarmCode of dataLogStore.excludedAlarmCodes) {
    dataLogStore.getAlarm(alarmCode).then((alarm) => {
      excludedAlarms.value.push(alarm);
    });
  }
});
</script>
