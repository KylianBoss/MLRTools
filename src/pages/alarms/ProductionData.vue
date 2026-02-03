<template>
  <q-page padding>
    <div class="text-h4">Données de production</div>
    <q-table
      :rows="productionData"
      :columns="columns"
      v-model:pagination="pagination"
      :rows-per-page-options="[7, 14, 21, 28, 50, 100]"
      row-key="date"
      wrap-cells
      flat
      bordered
      :loading="loading"
      @request="onRequest"
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
          <q-td
            key="start"
            :props="props"
            :class="
              App.userHasAccess('canUpdateProductionData')
                ? 'cursor-pointer'
                : 'cursor-not-allowed'
            "
          >
            {{ dayjs(props.row.start).format("HH:mm") }}
            <q-popup-edit
              v-model="props.row.start"
              v-slot="scope"
              v-if="App.userHasAccess('canUpdateProductionData')"
            >
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
          <q-td
            key="end"
            :props="props"
            :class="
              App.userHasAccess('canUpdateProductionData')
                ? 'cursor-pointer'
                : 'cursor-not-allowed'
            "
          >
            {{ dayjs(props.row.end).format("HH:mm") }}
            <q-popup-edit
              v-model="props.row.end"
              v-slot="scope"
              v-if="App.userHasAccess('canUpdateProductionData')"
            >
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
              :disable="
                App.userHasAccess('canUpdateProductionData') ? false : true
              "
            />
          </q-td>
          <q-td
            :class="
              App.userHasAccess('canUpdateProductionData')
                ? 'cursor-pointer'
                : 'cursor-not-allowed'
            "
          >
            {{ Number(props.row.boxTreated).toLocaleString() }}
            <q-popup-edit
              v-model="props.row.boxTreated"
              v-slot="scope"
              v-if="App.userHasAccess('canUpdateProductionData')"
            >
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
          <q-td>
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
            <small>
              <i>
                ({{
                  dayjs(props.row.end)
                    .diff(dayjs(props.row.start), "hour", true)
                    .toFixed(2)
                }}h)
              </i>
            </small>
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
                (!props.row.isMissing &&
                  !dayjs(props.row.end).diff(dayjs(props.row.start), 'hour') &&
                  !props.row.dayOff) ||
                dayjs(props.row.end).isBefore(dayjs(props.row.start))
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
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useDataLogStore } from "stores/datalog";
import dayjs from "dayjs";
import { useAppStore } from "src/stores/app";

const dataLogStore = useDataLogStore();
const App = useAppStore();
const productionData = ref([]);
const loading = ref(false);

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
    field: (row) =>
      row.boxTreated > 0
        ? Math.round(
            row.boxTreated / dayjs(row.end).diff(dayjs(row.start), "hour", true)
          )
        : 0,
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

const pagination = ref({
  sortBy: "date",
  descending: true,
  page: 1,
  rowsPerPage: 14,
  rowsNumber: 0,
});

const updateRow = async (row, field, value) => {
  row[field] = value;
  await dataLogStore.setProductionData(row);
  // Recharger les données après modification
  await fetchProductionData({
    pagination: pagination.value,
  });
};

const fetchProductionData = async (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;
  loading.value = true;

  try {
    const response = await api.get("/production/data", {
      params: {
        page,
        limit: rowsPerPage,
        sortBy: sortBy || "date",
        order: descending ? "DESC" : "ASC",
      },
    });

    productionData.value = response.data.data.map((row) => ({
      date: row.date,
      start: dayjs(row.start).format("YYYY-MM-DD HH:mm"),
      end: dayjs(row.end).format("YYYY-MM-DD HH:mm"),
      dayOff: Boolean(row.dayOff),
      boxTreated: row.boxTreated,
      isMissing: false,
    }));

    pagination.value.page = response.data.page;
    pagination.value.rowsPerPage = response.data.limit;
    pagination.value.rowsNumber = response.data.total;
    pagination.value.sortBy = sortBy;
    pagination.value.descending = descending;
  } catch (error) {
    console.error("Error fetching production data:", error);
  } finally {
    loading.value = false;
  }
};

const onRequest = (props) => {
  fetchProductionData(props);
};

onMounted(() => {
  fetchProductionData({ pagination: pagination.value });
});
</script>

<style></style>
