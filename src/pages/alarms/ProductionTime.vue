<template>
  <q-page padding>
    <div class="text-h4">Données de production</div>
    <!-- <pre>1: {{ dataLogStore.productionTimes }}</pre> -->
    <!-- <pre>2: {{ missingProductionTimes }}</pre> -->
    <q-table
      :rows="productionData"
      :columns="columns"
      :rows-per-page-options="pagination.rowsPerPage"
      row-key="date"
      wrap-cells
      flat
      bordered
      :loading="productionData.length === 0"
    >
      <template v-slot:body="props">
        <q-tr
          :props="props"
          :class="
            props.row.dayOff
              ? 'bg-grey-3'
              : props.row.isMissing
              ? 'bg-yellow-2'
              : ''
          "
        >
          <q-td>
            {{ dayjs(props.row.date).format("dd DD.MM.YYYY").toUpperCase() }}
          </q-td>
          <q-td key="start" :props="props" class="cursor-pointer">
            {{ dayjs(props.row.start).format("HH:mm") }}
            <q-popup-edit v-model="props.row.start" v-slot="scope">
              <q-input
                filled
                v-model="scope.value"
                type="datetime-local"
                mask="##.##.#### ##:##"
                :min="
                  dayjs(props.row.date)
                    .subtract(1, 'day')
                    .format('YYYY-MM-DD') + 'T00:00'
                "
                :max="
                  dayjs(props.row.date).add(1, 'day').format('YYYY-MM-DD') +
                  'T00:00'
                "
                @update:model-value="updateRow(props.row, 'start', scope.value)"
              />
              <!-- <q-input
                v-model="scope.value"
                dense
                autofocus
                counter
                @keyup.enter="scope.set"
              /> -->
            </q-popup-edit>
          </q-td>
          <q-td key="end" :props="props" class="cursor-pointer">
            {{ dayjs(props.row.end).format("HH:mm") }}
            <q-popup-edit v-model="props.row.end" v-slot="scope">
              <q-input
                filled
                v-model="scope.value"
                type="datetime-local"
                mask="##.##.#### ##:##"
                :min="
                  dayjs(props.row.date)
                    .subtract(1, 'day')
                    .format('YYYY-MM-DD') + 'T00:00'
                "
                :max="
                  dayjs(props.row.date).add(1, 'day').format('YYYY-MM-DD') +
                  'T00:00'
                "
                @update:model-value="updateRow(props.row, 'end', scope.value)"
              />
              <!-- <q-input
                v-model="scope.value"
                dense
                autofocus
                counter
                @keyup.enter="scope.set"
              /> -->
            </q-popup-edit>
          </q-td>
          <q-td class="text-center">
            <q-checkbox
              v-model="props.row.dayOff"
              @update:model-value="updateRow(props.row, 'dayOff', $event)"
            />
          </q-td>
          <q-td class="cursor-pointer">
            {{ Number(props.row.boxTreated).toLocaleString() }}
            <q-popup-edit v-model="props.row.boxTreated" v-slot="scope">
              <q-input
                filled
                v-model="scope.value"
                dense
                autofocus
                type="number"
                min="0"
                @update:model-value="
                  updateRow(props.row, 'boxTreated', Number(scope.value))
                "
              />
            </q-popup-edit>
          </q-td>
          <q-td class="cursor-pointer">
            {{
              props.row.boxTreated > 0
                ? Math.round(
                    props.row.boxTreated /
                      dayjs(props.row.end).diff(
                        dayjs(props.row.start),
                        "hour",
                        true
                      )
                  ).toLocaleString()
                : 0
            }}
          </q-td>
          <q-td class="text-right">
            <q-icon
              v-if="
                dayjs(props.row.end).diff(
                  dayjs(props.row.start),
                  'hour',
                  true
                ) > 24
              "
              name="error"
              color="negative"
              size="sm"
            />
            <q-icon
              v-if="
                !props.row.isMissing &&
                !dayjs(props.row.end).diff(dayjs(props.row.start), 'hour') &&
                !props.row.dayOff
              "
              name="warning"
              color="warning"
              size="sm"
            />
            <q-icon
              v-else
              :name="props.row.isMissing ? 'warning' : 'done'"
              :color="props.row.isMissing ? 'warning' : 'positive'"
              size="sm"
            />
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useDataLogStore } from "stores/datalog";
import dayjs from "dayjs";
import weekday from "dayjs/plugin/weekday";

dayjs.extend(weekday);

const dataLogStore = useDataLogStore();
const productionData = ref([]);
const columns = [
  {
    name: "date",
    label: "Date",
    align: "left",
    field: "date",
    value: (row) => dayjs(row.date).format("YYYY-MM-DD"),
    sortable: true,
  },
  { name: "start", label: "Début", align: "left", field: "start" },
  { name: "end", label: "Fin", align: "left", field: "end" },
  {
    name: "dayOff",
    label: "Jour non travaillé",
    align: "center",
    field: "dayOff",
    value: (row) => Boolean(row.dayOff),
    sortable: true,
  },
  {
    name: "boxTreated",
    label: "Boxes traitées",
    align: "left",
    field: "boxTreated",
    value: (row) => row.boxTreated,
    sortable: true,
  },
  {
    name: "boxesPerHour",
    label: "Boxes/h",
    align: "left",
    field: "boxesPerHour",
    value: (row) =>
      row.boxTreated > 0
        ? Math.round(
            row.boxTreated / dayjs(row.end).diff(dayjs(row.start), "hour", true)
          )
        : 0,
    sortable: true,
  },
  {
    name: "status",
    label: "Status",
    align: "right",
    field: "isMissing",
    value: (row) => row.isMissing,
    sortable: true,
  },
];
const pagination = {
  rowsPerPage: [7, 14, 21, 28, 0],
};

const updateRow = (row, field, value) => {
  row[field] = value;
  dataLogStore.setProductionData(row).then(() => calculate());
};

const calculate = () => {
  productionData.value = [];
  // Add dates from the last in the dataLogStore.dates to the next sunday
  const toSunday = Math.abs(
    dayjs(dataLogStore.dates[dataLogStore.dates.length - 1]).diff(
      dayjs().weekday(6),
      "day"
    )
  );
  const dates =
    toSunday > 0
      ? [
          ...dataLogStore.dates,
          ...Array(toSunday)
            .fill(null)
            .map((_, i) =>
              dayjs(dataLogStore.dates[dataLogStore.dates.length - 1])
                .add(i + 1, "day")
                .format("YYYY-MM-DD")
            ),
        ]
      : dataLogStore.dates;
  dates.forEach((date) => {
    if (
      dataLogStore.productionData.filter((pd) =>
        dayjs(pd.date).isSame(dayjs(date))
      ).length === 0
    ) {
      productionData.value.push({
        date,
        start: dayjs(date).format("YYYY-MM-DD 00:00"),
        end: dayjs(date).format("YYYY-MM-DD 00:00"),
        dayOff: false,
        boxTreated: 0,
        isMissing: true,
      });
    } else {
      const pt = dataLogStore.productionData.find((pt) =>
        dayjs(pt.date).isSame(dayjs(date))
      );
      productionData.value.push({
        date,
        start: dayjs(pt.start).format("YYYY-MM-DD HH:mm"),
        end: dayjs(pt.end).format("YYYY-MM-DD HH:mm"),
        dayOff: Boolean(pt.dayOff),
        boxTreated: pt.boxTreated,
        isMissing: false,
      });
    }
  });
  productionData.value = productionData.value.sort((a, b) => {
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
