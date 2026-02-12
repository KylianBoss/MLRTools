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
      :table-row-class-fn="rowClass"
    >
      <template v-slot:body="props">
        <q-tr :props="props" :class="{ 'disabled-row': !props.row.autorised }">
          <q-td>
            {{ props.row.username }}
          </q-td>
          <q-td>
            {{ props.row.fullname }}
          </q-td>
          <q-td key="autorised" :props="props" class="text-center">
            <q-toggle
              v-model="props.row.autorised"
              color="primary"
              @update:model-value="App.updateUser(props.row)"
              :disable="props.row.isBot"
            />
          </q-td>
          <q-td key="UserAccesses" :props="props" class="text-center">
            <q-select
              behavior="dialog"
              v-model="props.row.UserAccesses"
              :options="access"
              multiple
              emit-value
              map-options
              @update:model-value="App.updateUser(props.row)"
              style="max-width: 200px; overflow: hidden"
              dense
            >
              <template v-slot:selected>
                {{ props.row.UserAccesses.length }} accès
              </template>
              <template
                v-slot:option="{
                  index,
                  itemProps,
                  opt,
                  selected,
                  toggleOption,
                }"
              >
                <div
                  v-if="
                    (index === 0 ||
                      access[index - 1].section !== opt.section) &&
                    (!opt.disabled || selected)
                  "
                >
                  <q-item-label
                    class="text-bold q-mt-md q-mb-sm text-uppercase q-pl-xs"
                  >
                    {{ opt.section }}
                  </q-item-label>
                  <q-separator />
                </div>
                <q-item v-bind="itemProps" v-if="!opt.disabled || selected">
                  <q-item-section>
                    <q-item-label>{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      :model-value="selected"
                      @update:model-value="toggleOption(opt)"
                      :disable="opt.disabled && !selected"
                    />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-td>
          <q-td key="isBot" :props="props" class="text-center">
            <q-toggle
              v-model="props.row.isBot"
              color="primary"
              @update:model-value="App.updateUser(props.row)"
              :disable="!props.row.autorised"
            />
          </q-td>
          <q-td>
            {{ props.row.email }}
          </q-td>
          <q-td key="recieveDailyReport" :props="props" class="text-center">
            <q-toggle
              v-model="props.row.recieveDailyReport"
              color="primary"
              @update:model-value="App.updateUser(props.row)"
              :disable="
                !props.row.email || !props.row.autorised || props.row.isBot
              "
            />
          </q-td>
          <q-td key="isTechnician" :props="props" class="text-center">
            <q-toggle
              v-model="props.row.isTechnician"
              color="primary"
              @update:model-value="App.updateUser(props.row)"
              :disable="!props.row.autorised || props.row.isBot"
            />
          </q-td>
        </q-tr>
      </template>
      <!-- <template v-slot:body-cell-autorised="props">
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
            dense
          >
            <template v-slot:selected>
              {{ props.row.UserAccesses.length }} accès
            </template>
            <template
              v-slot:option="{ index, itemProps, opt, selected, toggleOption }"
            >
              <div
                v-if="
                  (index === 0 || access[index - 1].section !== opt.section) &&
                  (!opt.disabled || selected)
                "
              >
                <q-item-label
                  class="text-bold q-mt-md q-mb-sm text-uppercase q-pl-xs"
                >
                  {{ opt.section }}
                </q-item-label>
                <q-separator />
              </div>
              <q-item v-bind="itemProps" v-if="!opt.disabled || selected">
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    :model-value="selected"
                    @update:model-value="toggleOption(opt)"
                    :disable="opt.disabled && !selected"
                  />
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </td>
      </template>
      <template v-slot:body-cell-isBot="props">
        <td class="text-center">
          <q-toggle
            v-model="props.row.isBot"
            color="primary"
            @update:model-value="App.updateUser(props.row)"
          />
        </td>
      </template>
      <template v-slot:body-cell-recieveDailyReport="props">
        <td class="text-center">
          <q-toggle
            v-model="props.row.recieveDailyReport"
            color="primary"
            @update:model-value="App.updateUser(props.row)"
          />
        </td>
      </template>
      <template v-slot:body-cell-isTechnician="props">
        <td class="text-center">
          <q-toggle
            v-model="props.row.isTechnician"
            color="primary"
            @update:model-value="App.updateUser(props.row)"
          />
        </td>
      </template> -->
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
  {
    name: "isBot",
    label: "BOT",
    align: "center",
    field: "isBot",
    sortable: true,
  },
  {
    name: "email",
    label: "EMAIL",
    align: "left",
    field: "email",
    sortable: false,
  },
  {
    name: "recieveDailyReport",
    label: "DAILY REPORT",
    align: "center",
    field: "recieveDailyReport",
    sortable: true,
  },
  {
    name: "isTechnician",
    label: "TECHNICIAN",
    align: "center",
    field: "isTechnician",
    sortable: true,
  },
];
const access = [
  // Navigation accesses
  { section: "navigation", label: "KPI", value: "kpi" },
  { section: "navigation", label: "Search Messages", value: "searchMessages" },
  { section: "navigation", label: "Graphiques", value: "charts" },
  { section: "navigation", label: "Alarmes", value: "alarms" },
  { section: "navigation", label: "TGW", value: "tgw", disabled: true },
  { section: "navigation", label: "Outils", value: "tools" },
  { section: "navigation", label: "Données", value: "data" },
  { section: "navigation", label: "Maintenance", value: "maintenance" },
  { section: "navigation", label: "Admin", value: "admin" },
  // Charts accesses
  {
    section: "graphiques",
    label: "Visualisation des graphiques",
    value: "canAccessCharts",
  },
  {
    section: "graphiques",
    label: "Graphiques personnalisés",
    value: "canAccessCustomCharts",
  },
  {
    section: "graphiques",
    label: "Peut créer un graphique personnalisé",
    value: "canCreateCustomCharts",
  },
  {
    section: "graphiques",
    label: "Peut supprimer un graphique personnalisé",
    value: "canDeleteCustomCharts",
  },
  {
    section: "graphiques",
    label: "Peut modifier un graphique personnalisé",
    value: "canUpdateCustomCharts",
  },
  // Alarms accesses
  {
    section: "alarmes",
    label: "Importer des messages",
    value: "canImportMessages",
  },
  {
    section: "alarmes",
    label: "Excluded Alarms",
    value: "canAccessExcludedAlarms",
    disabled: true,
  },
  {
    section: "alarmes",
    label: "Liste des alarmes",
    value: "canAccessAlarmList",
  },
  {
    section: "alarmes",
    label: "Peut classer les alarmes",
    value: "canClassifyAlarms",
  },
  // TGW accesses
  {
    section: "tgw",
    label: "TGW rapport alarmes",
    value: "canAccessTgwReportAlarms",
    disabled: true,
  },
  {
    section: "tgw",
    label: "TGW rapport zones",
    value: "canAccessTgwReportZones",
    disabled: true,
  },
  // Tools accesses
  {
    section: "outils",
    label: "Suspicious Places",
    value: "canAccessSuspiciousPlaces",
    disabled: true,
  },
  // Data accesses
  {
    section: "données",
    label: "Données de production",
    value: "canAccessProductionData",
  },
  {
    section: "données",
    label: "Peut modifier les données de production",
    value: "canUpdateProductionData",
  },
  // Maintenance accesses
  {
    section: "maintenance",
    label: "Maintenance Plans",
    value: "canAccessMaintenancePlan",
    disabled: true,
  },
  {
    section: "maintenance",
    label: "Maintenance Reports",
    value: "canAccessMaintenanceReport",
    disabled: true,
  },
  {
    section: "maintenance",
    label: "Peut démarrer maintenance",
    value: "canStartMaintenance",
    disabled: true,
  },
  // DDS
  {
    section: "DDS",
    label: "Accès au tableau DDS",
    value: "canAccessDdsBoard",
  },
  {
    section: "DDS",
    label: "Peut modifier le tableau DDS",
    value: "canUpdateDdsBoard",
  },
  {
    section: "DDS",
    label: "Peut accéder à l'analyse quotidienne",
    value: "canAccessDailyAnalysis",
  },
  {
    section: "DDS",
    label: "Peut grouper des alarmes",
    value: "canGroupAlarms",
  },
  {
    section: "DDS",
    label: "Peut dégrouper des alarmes",
    value: "canUngroupAlarms",
  },
  {
    section: "DDS",
    label: "Peut ajouter un commentaire",
    value: "canAddComment",
  },
  {
    section: "DDS",
    label: "Peut modifier un commentaire",
    value: "canUpdateComment",
  },
  {
    section: "DDS",
    label: "Peut marquer comme traité",
    value: "canMarkAsTreated",
  },
  {
    section: "DDS",
    label: "Peut marquer comme planifié",
    value: "canMarkAsPlanned",
  },
  {
    section: "Interventions",
    label: "Accès au journal d'interventions",
    value: "canAccessJournal",
  },
  {
    section: "Interventions",
    label: "Peut valider des interventions",
    value: "canValidateInterventions",
  },
  // Admin accesses
  { section: "Admin", label: "DB", value: "canAccessAdminDB" },
  { section: "Admin", label: "Users", value: "canAccessAdminUser" },
  { section: "Admin", label: "Bots", value: "canAccessAdminBots" },
  { section: "Admin", label: "Settings", value: "canAccessAdminSettings" },
];

const rowClass = (row) => {
  return !row.autorised ? "bg-grey" : "";
};

onMounted(() => {
  App.getUsers();
});
</script>

<style scoped>
.disabled-row {
  opacity: 0.5;
  background-color: #f5f5f5;
}

.disabled-row td {
  color: #999;
}
</style>
