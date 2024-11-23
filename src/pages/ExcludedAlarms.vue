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
                @click="includeAlarm(props.row.alarmId)"
              >
                <q-item-section>Inclure cette alarme</q-item-section>
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

const includeAlarm = async (alarmId) => {
  await dataLogStore.includeAlarm(alarmId);
  excludedAlarms.value = excludedAlarms.value.filter(
    (alarm) => alarm.alarmId !== alarmId
  );
  dataLogStore.initialize();
};

onMounted(async () => {
  await dataLogStore.initialize();
  for (const alarmId of dataLogStore.excludedAlarms) {
    dataLogStore.getAlarm(alarmId).then((alarm) => {
      excludedAlarms.value.push(alarm);
    });
  }
});
</script>
