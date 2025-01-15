<template>
  <q-page padding>
    <div class="text-h4">Users</div>
    <q-table
      :rows="App.users"
      :columns="columns"
      row-key="id"
      :loading="App.loading"
      virtual-scroll
      :rows-per-page-options="[10, 20, 50]"
    >
      <template v-slot:body-cell-autorised="props">
        <td class="text-center">
          <q-toggle
            v-model="props.row.autorised"
            color="primary"
            @update:model-value="App.updateUser(props.row)"
          />
        </td>
      </template>
      <template v-slot:body-cell-UserAccesses="props">
        <td class="text-center">
          <q-select
            behavior="dialog"
            v-model="props.row.UserAccesses"
            :options="access"
            multiple
            emit-value
            map-options
            @update:model-value="App.updateUser(props.row)"
            style="max-width: 200px; overflow: hidden"
          >
            <template
              v-slot:option="{ itemProps, opt, selected, toggleOption }"
            >
              <q-item v-bind="itemProps">
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    :model-value="selected"
                    @update:model-value="toggleOption(opt)"
                  />
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useAppStore } from "stores/app";

const App = useAppStore();
const columns = [
  {
    name: "id",
    label: "USERNAME",
    align: "left",
    field: "username",
    sortable: true,
  },
  {
    name: "name",
    label: "NAME",
    align: "left",
    field: "fullname",
    sortable: true,
  },
  {
    name: "autorised",
    label: "AUTORISED",
    align: "center",
    field: "autorised",
    sortable: true,
  },
  {
    name: "UserAccesses",
    label: "ACCESS",
    align: "center",
    field: "UserAccesses",
  },
];
// type: DataTypes.ENUM(
//   "kpi",
//   "searchMessages",
//   "charts",
//   "importMessages",
//   "excludedAlarms",
//   "tgwReportAlarms",
//   "suspiciousPlaces",
//   "admin",
//   "admin-db",
//   "admin-users"
// ),
const access = [
  { label: "KPI", value: "kpi" },
  { label: "Search Messages", value: "searchMessages" },
  { label: "Charts", value: "charts" },
  { label: "Import Messages", value: "importMessages" },
  { label: "Excluded Alarms", value: "excludedAlarms" },
  { label: "TGW rapport zones", value: "tgwReportZones" },
  { label: "Suspicious Places", value: "suspiciousPlaces" },
  { label: "Admin", value: "admin" },
  { label: "Admin DB", value: "admin-db" },
  { label: "Admin Users", value: "admin-users" },
  { label: "Temps de production", value: "productionTime" },
];

onMounted(() => {
  App.getUsers();
});
</script>

<style></style>
