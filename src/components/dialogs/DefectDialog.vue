<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 80vw">
      <q-card-section>
        <div class="text-h6">
          {{ defect.id ? "Mise à jour d'un défaut" : "Création d'un défaut" }}
        </div>
      </q-card-section>
      <q-card-section v-if="loaded && !defect.id">
        <div class="text-h6">Emplacement</div>
        <q-select
          v-model="dataSource"
          :options="dataSourcesOptions"
          option-label="label"
          option-value="value"
          label="Premier niveau"
          filled
          emit-value
          map-options
          :rules="[(val) => !!val || 'Le premier niveau est requis']"
        />
        <q-select
          v-model="defect.location"
          :options="modulePossibilities"
          option-label="label"
          option-value="value"
          label="Second niveau"
          filled
          emit-value
          map-options
          :rules="[(val) => !!val || 'Le second niveau est requis']"
          :disable="!dataSource"
          use-input
          @filter="filterFn"
        />
        <pre>{{ defect.location }}</pre>
      </q-card-section>
      <q-card-actions align="right" v-if="loaded">
        <q-btn
          color="secondary"
          label="Annuler"
          @click="onDialogHide"
          flat
        />
        <q-space />
        <q-btn
          flat
          label="Charger"
          color="primary"
          @click="onOk"
          :disable="!canCreate"
        />
      </q-card-actions>
      <q-card-section v-if="!loaded" class="text-center">
        <q-spinner-dots color="primary" size="xl" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref, computed, onMounted, watch } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  defectData: {
    type: Object,
    required: false,
    default: () => ({}),
  },
});

const defect = ref({
  id: null,
  location: "",
  activity: "",
  priority: "low",
  done: false,
  estimatedInterventionTime: 0,
  description: "",
  status: "open",
  ...props.defectData,
});
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const priorityOptions = [
  { label: "Basse", value: "low" },
  { label: "Moyenne", value: "medium" },
  { label: "Haute", value: "high" },
];
const activityOptions = [
  {
    label: "Mécanique",
    value: "mecanical",
  },
  {
    label: "Électrique",
    value: "electrical",
  },
  {
    label: "Programmation",
    value: "software",
  },
  {
    label: "Autre",
    value: "other",
  },
];
const canCreate = computed(() => {
  return (
    defect.value.location &&
    defect.value.activity &&
    defect.value.priority &&
    defect.value.description
  );
});
const locations = ref([]);
const dataSourcesOptions = ref([]);
const dataSource = ref();
const modulePossibilities = ref([]);
watch(dataSource, () => {
  if (!dataSource.value) {
    modulePossibilities.value = [];
    return;
  }
  defect.value.location = null;
  modulePossibilities.value = locations.value
    .filter((l) => l.dataSource === dataSource.value)
    .map((l) => ({
      label: `${l.dataSource}.${l.module}${
        Number(l.complement) > 0 ? `.${l.complement}` : ''
      } - ${l.element}`,
      value: l.id,
    }));
});
const loaded = ref(false);

const onOk = () => {
  onDialogOK(defect.value);
};

const filterFn = (val, update) => {
  if (val === "") {
    update(() => {
      modulePossibilities.value = locations.value
        .filter((l) => l.dataSource === dataSource.value)
        .map((l) => ({
          label: `${l.dataSource}.${l.module}${
            Number(l.complement) > 0 ? `.${l.complement}` : ''
          } - ${l.element}`,
          value: l.id,
        }));
    });
  }
  update(() => {
    const needle = val.toLowerCase();
    modulePossibilities.value = locations.value
      .filter((l) => l.dataSource === dataSource.value)
      .map((l) => ({
        label: `${l.dataSource}.${l.module}${
          Number(l.complement) > 0 ? `.${l.complement}` : ''
        } - ${l.element}`,
        value: l.id,
      }))
      .filter((l) => l.label.toLowerCase().indexOf(needle) > -1);
  });
};

onMounted(() => {
  api.get("/locations").then((response) => {
    locations.value = response.data;
    dataSourcesOptions.value = response.data
      .map((l) => l.dataSource)
      .filter((ds, index, self) => self.indexOf(ds) === index)
      .map((ds) => ({
        label: ds,
        value: ds,
      }));
    loaded.value = true;
  });
});
</script>

<style></style>
