<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">Enregistrer l'intervention</div>
        <div class="text-subtitle2 text-grey-7">
          Durée totale: {{ displayTime }}
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-12">
            <q-select
              v-model="selectedLocationValue"
              :options="filteredLocationOptions"
              label="Position"
              outlined
              dense
              clearable
              use-input
              new-value-mode="add-unique"
              emit-value
              map-options
              option-label="label"
              option-value="value"
              input-debounce="0"
              @filter="onLocationFilter"
              @new-value="onLocationNewValue"
              hint="Ex: X001.1120, X101.1360, etc."
            />
          </div>
        </div>
        <q-input
          v-model="form.description"
          label="Description *"
          outlined
          dense
          class="q-mb-md"
          hint="Ex: chute d'une pile de caisse, maintenance du stingray"
        />
        <div class="row q-col-gutter-sm q-mb-md">
          <div class="col-6">
            <q-input
              v-model="form.startTime"
              label="Heure de début"
              outlined
              dense
              type="time"
              readonly
              hint="Début de l'arrêt de l'installation"
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="form.endTime"
              label="Heure de fin"
              outlined
              dense
              type="time"
              readonly
              hint="Fin de l'arrêt de l'installation"
            />
          </div>
        </div>
        <q-input
          v-model="form.comment"
          label="Commentaire"
          outlined
          dense
          type="textarea"
          rows="3"
          class="q-mb-md"
        />
        <q-toggle
          v-model="form.isPlanned"
          label="Intervention planifiée (maintenance)"
          color="primary"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" color="grey-7" @click="onDialogHide" />
        <q-btn
          label="Enregistrer"
          color="primary"
          @click="onSave"
          :disable="disableSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch, nextTick } from "vue";
import { useDialogPluginComponent } from "quasar";

const props = defineProps({
  timerForm: {
    type: Object,
    required: true,
  },
  displayTime: {
    type: String,
    required: true,
  },
  locations: {
    type: Array,
    default: () => [],
  },
});

const form = ref({
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
  ...props.timerForm,
});

const buildLocationValue = (location) => {
  if (!location?.dataSource || !location?.position) {
    return "";
  }

  return `${location.dataSource}.${location.position}`;
};

const initialAlarmCode = props.timerForm?.alarmCode || "";
const initialLocation = props.locations.find((location) => {
  return buildLocationValue(location) === initialAlarmCode;
});

const selectedLocationValue = ref(
  initialLocation ? buildLocationValue(initialLocation) : ""
);
const locationInput = ref(selectedLocationValue.value || "");
const locationFilter = ref("");
const customLocationValues = ref([]);
const isAutoSelectingLocation = ref(false);

const locationOptions = computed(() => {
  const optionsByValue = new Map();

  props.locations
    .filter((location) => location.dataSource && location.position)
    .forEach((location) => {
      const value = buildLocationValue(location);
      if (!value || optionsByValue.has(value)) {
        return;
      }

      const label = location.component
        ? `${value} - ${location.component}`
        : value;
      optionsByValue.set(value, {
        value,
        label,
        component: location.component || "",
      });
    });

  customLocationValues.value.forEach((value) => {
    if (!value || optionsByValue.has(value)) {
      return;
    }

    optionsByValue.set(value, {
      value,
      label: value,
      component: "",
    });
  });

  return [...optionsByValue.values()].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
});

const filteredLocationOptions = computed(() => {
  if (!locationFilter.value) {
    return locationOptions.value;
  }

  const search = locationFilter.value.toLowerCase();
  return locationOptions.value.filter((option) =>
    option.label.toLowerCase().includes(search)
  );
});

const selectedLocation = computed(() => {
  if (!selectedLocationValue.value) {
    return null;
  }

  return (
    props.locations.find(
      (location) =>
        buildLocationValue(location).toLowerCase() ===
        selectedLocationValue.value.toLowerCase()
    ) || null
  );
});

const disableSave = computed(() => {
  return !selectedLocationValue.value;
});

watch(selectedLocationValue, () => {
  if (isAutoSelectingLocation.value) {
    return;
  }

  locationInput.value = selectedLocationValue.value || "";
});

const findLocationByInput = (value) => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return null;
  }

  return (
    props.locations.find((location) => {
      return (
        buildLocationValue(location).toLowerCase() === normalized.toLowerCase()
      );
    }) || null
  );
};

const applyLocationMatch = (location) => {
  if (!location) {
    return;
  }

  isAutoSelectingLocation.value = true;
  selectedLocationValue.value = buildLocationValue(location);
  locationInput.value = selectedLocationValue.value;
  nextTick(() => {
    isAutoSelectingLocation.value = false;
  });
};

const onLocationFilter = (value, update) => {
  locationFilter.value = value;
  locationInput.value = value;
  tryAutoSelectFromInput(value);
  update(() => {});
};

const onLocationNewValue = (value, done) => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return;
  }

  if (!customLocationValues.value.includes(normalized)) {
    customLocationValues.value.push(normalized);
  }

  selectedLocationValue.value = normalized;
  locationFilter.value = "";
  if (done) {
    done(normalized, "add-unique");
  }
};

const tryAutoSelectFromInput = (value) => {
  const match = findLocationByInput(value);
  if (match) {
    applyLocationMatch(match);
  }
};

watch(
  () => props.locations,
  (list) => {
    if (!list?.length || !locationInput.value) {
      return;
    }

    tryAutoSelectFromInput(locationInput.value);
  }
);

watch(selectedLocationValue, (value) => {
  form.value.alarmCode = value || "";
});

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const onSave = () => {
  onDialogOK({
    ...form.value,
    alarmCode: selectedLocationValue.value,
  });
};
</script>
