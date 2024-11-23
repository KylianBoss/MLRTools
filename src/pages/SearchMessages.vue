<template>
  <q-page padding>
    <q-date
      v-model="date"
      :events="dataLogStore.dates.map((d) => dayjs(d).format('YYYY/MM/DD'))"
      class="full-width"
      minimal
      range
    />
    <q-table
      flat
      bordered
      ref="tableRef"
      :rows="rows"
      :columns="
        sum
          ? [
              ...dataLogStore.columns.filter((c) =>
                !['timeOfOccurence', 'timeOfAcknowledge', 'duration'].includes(
                  c.name
                )
              ),
              {
                name: 'count',
                label: 'Somme',
                align: 'center',
                sortable: true,
                field: (row) => row.count,
              },
            ]
          : dataLogStore.columns
      "
      row-key="id"
      v-model:pagination="pagination"
      :loading="loading"
      :filter="filter"
      binary-state-sort
      @request="onRequest"
    >
      <template v-slot:top>
        <div class="col q-pr-sm">
          <q-input
            v-model="filter.like"
            label="Rechercher"
            color="primary"
            dense
            outlined
          />
        </div>
        <div class="col">
          <q-input
            v-model="times.from"
            type="time"
            label="De :"
            dense
            outlined
          />
        </div>
        <div class="col q-pr-sm">
          <q-input v-model="times.to" type="time" label="À :" dense outlined />
        </div>
        <div class="col">
          <q-toggle
            v-model="filter.excluded"
            label="Inclure les alarmes exclues"
            dense
            color="primary"
          />
        </div>
        <div class="col">
          <q-toggle
            v-model="sum"
            label="Faire la somme des erreurs"
            dense
            color="primary"
          />
        </div>
      </template>

      <template v-slot:body="props">
        <tr
          :props="props"
          :class="
            dataLogStore.excludedAlarms.includes(props.row.alarmId)
              ? 'bg-grey'
              : null
          "
        >
          <td v-if="!sum">
            {{ dayjs(props.row.timeOfOccurence).format("DD.MM.YYYY HH:mm:ss") }}
          </td>
          <td v-if="!sum">
            {{
              dayjs(props.row.timeOfAcknowledge).format("DD.MM.YYYY HH:mm:ss")
            }}
          </td>
          <td v-if="!sum">
            {{ dayjs.duration(props.row.duration * 1000).format("HH:mm:ss") }}
          </td>
          <td>{{ props.row.dataSource.toUpperCase() }}</td>
          <td>{{ props.row.alarmArea.toUpperCase() }}</td>
          <td>{{ props.row.alarmCode.toUpperCase() }}</td>
          <td>{{ props.row.alarmText }}</td>
          <td>{{ props.row.severity.toUpperCase() }}</td>
          <td>{{ props.row.classification.toUpperCase() }}</td>
          <td>{{ props.row.alarmId }}</td>
          <td v-if="sum">{{ props.row.count }}</td>
        </tr>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useDataLogStore } from "stores/datalog";
import dayjs from "dayjs";
import { useQuasar } from "quasar";

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const date = ref(dayjs().format("YYYY/MM/DD"));
const tableRef = ref();
const rows = ref([]);
const filter = ref({
  date: {
    from: dayjs().format("YYYY-MM-DD") + " 00:00:00",
    to: dayjs().format("YYYY-MM-DD") + " 23:59:59",
  },
  excluded: false,
});
const sum = ref(false);
const times = ref({
  from: "00:00",
  to: "23:59",
});
const loading = ref(false);
const pagination = ref({
  sortBy: "timeOfOccurence",
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 10,
});

watch(date, (newDate) => {
  if (newDate === null) return;
  if (typeof newDate === "string") {
    filter.value.date = {
      from: `${dayjs(newDate).format("YYYY-MM-DD")} ${times.value.from}:00`,
      to: `${dayjs(newDate).format("YYYY-MM-DD")} ${times.value.to}:59`,
    };
  } else if (typeof newDate === "object") {
    filter.value.date = {
      from: `${dayjs(newDate.from).format("YYYY-MM-DD")} ${
        times.value.from
      }:00`,
      to: `${dayjs(newDate.to).format("YYYY-MM-DD")} ${times.value.to}:59`,
    };
  } else {
    filter.value.date = {
      from: `${dayjs(newDate).format("YYYY-MM-DD")} ${times.value.from}:00`,
      to: `${dayjs(newDate).format("YYYY-MM-DD")} ${times.value.to}:59`,
    };
  }
});

watch(
  times,
  (newTimes) => {
    console.log(newTimes);
    filter.value.date = {
      from: `${dayjs(date.value).format("YYYY-MM-DD")} ${newTimes.from}:00`,
      to: `${dayjs(date.value).format("YYYY-MM-DD")} ${newTimes.to}:59`,
    };
  },
  { deep: true }
);

watch(
  sum,
  () => {
    tableRef.value.requestServerInteraction();
  },
  { deep: true }
);

const onRequest = async (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;
  // const filter = props.filter;

  loading.value = true;

  // update rowsCount with appropriate value
  pagination.value.rowsNumber = await dataLogStore.getNumberOfRows(
    JSON.parse(JSON.stringify(filter.value)),
    sum.value
  );

  // get all rows if "All" (0) is selected
  const fetchCount =
    rowsPerPage === 0 ? pagination.value.rowsNumber : rowsPerPage;

  // calculate starting row of data
  const startRow = (page - 1) * rowsPerPage;

  // fetch data from "server"
  const returnedData = await dataLogStore.getData(
    startRow,
    fetchCount,
    JSON.parse(JSON.stringify(filter.value)),
    sortBy,
    descending,
    sum.value
  );

  // clear out existing data and add new
  rows.value.splice(0, rows.value.length, ...returnedData);

  // don't forget to update local pagination object
  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.descending = descending;

  // ...and turn of loading indicator
  loading.value = false;
};

onMounted(async () => {
  dataLogStore.initialize();
  // get initial data from server (1st page)
  tableRef.value.requestServerInteraction();
});
</script>

<style></style>
