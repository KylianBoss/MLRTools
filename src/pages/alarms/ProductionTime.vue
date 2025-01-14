<template>
  <q-page padding>
    <div class="text-h4">Production Time</div>
    <!-- <pre>1: {{ dataLogStore.productionTimes }}</pre> -->
    <!-- <pre>2: {{ missingProductionTimes }}</pre> -->
    <div
      class="row full-width q-my-xs"
      v-for="missing in missingProductionTimes"
      :key="missing.date"
    >
      <div class="col">
        <q-card>
          <q-card-section>
            <div class="row q-gutter-lg">
              <div class="col">
                <q-input
                  v-model="missing.date"
                  label="Date"
                  type="date"
                  mask="##.##.####"
                  readonly
                  dense
                />
              </div>
              <div class="col">
                <q-input
                  v-model="missing.start"
                  label="Début"
                  type="time"
                  mask="##:##"
                  dense
                  :disable="missing.dayOff"
                />
              </div>
              <div class="col">
                <q-input
                  v-model="missing.end"
                  label="Fin"
                  type="time"
                  mask="##:##"
                  dense
                  :disable="missing.dayOff"
                />
              </div>
              <div class="col">
                <q-checkbox
                  v-model="missing.dayOff"
                  label="Jour non travaillé"
                  @update:model-value="handleChange(missing, $event)"
                />
              </div>
            </div>
            <div class="row q-mt-xs">
              <div class="col"></div>
              <div class="col col-6">
                <q-btn
                  label="Save"
                  color="primary"
                  class="full-width"
                  dense
                  @click="
                    dataLogStore
                      .setProductionTime(missing)
                      .then(() => calculate())
                  "
                  :disable="!(missing.dayOff || (missing.start && missing.end))"
                />
              </div>
              <div class="col"></div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useDataLogStore } from "stores/datalog";
import dayjs from "dayjs";

const dataLogStore = useDataLogStore();
const missingProductionTimes = ref([]);

const handleChange = (missing, event) => {
  if (event) {
    missing.start = "00:00";
    missing.end = "00:00";
  } else {
    missing.start = null;
    missing.end = null;
  }
};

const calculate = () => {
  missingProductionTimes.value = [];
  // Add dates from the last in the dataLogStore.dates to today
  const toToday = dayjs().diff(
    dayjs(dataLogStore.dates[dataLogStore.dates.length - 1]),
    "day"
  );
  const dates =
    toToday > 0
      ? [
          ...dataLogStore.dates,
          ...Array(toToday)
            .fill(null)
            .map((_, i) =>
              dayjs(dataLogStore.dates[dataLogStore.dates.length - 1])
                .add(i + 1, "day")
                .format("YYYY-MM-DD")
            ),
        ]
      : dataLogStore.dates;
  dates.map((date) => {
    if (
      dataLogStore.productionTimes.filter((pt) =>
        dayjs(pt.date).isSame(dayjs(date))
      ).length === 0
    ) {
      missingProductionTimes.value.push({
        date,
        start: null,
        end: null,
        dayOff: false,
      });
    }
  });
  missingProductionTimes.value.sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });
};

onMounted(async () => {
  dataLogStore.initialize().then(() => {
    calculate();
  });
});
</script>

<style></style>
