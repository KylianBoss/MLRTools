<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 500px">
      <q-card-section class="text-h6">
        Confirmer la maintenance de {{ maintenance?.location }}
      </q-card-section>
      <q-card-section>
        <div class="row">
          <div class="col">
            <q-input
              v-model="maintenance.startTime"
              type="datetime-local"
              label="Heure de début"
              outlined
              dense
              :max="maintenance.endTime"
            />
          </div>
          <div class="col">
            <q-input
              v-model="maintenance.endTime"
              type="datetime-local"
              label="Heure de fin"
              outlined
              dense
              :min="maintenance.startTime"
            />
          </div>
        </div>
      </q-card-section>
      <q-card-actions>
        <q-btn color="primary" @click="confirm" label="Confirmer" />
        <q-btn color="secondary" @click="cancel" label="Annuler" flat />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref } from "vue";
import dayjs from "dayjs";

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const props = defineProps({
  maintenanceData: {
    type: Object,
    required: true,
  },
});
const maintenance = ref({
  location: props.maintenanceData.location,
  startTime: dayjs(props.maintenanceData.startTime).isValid()
    ? dayjs(props.maintenanceData.startTime).format("YYYY-MM-DDTHH:mm")
    : null,
  endTime: dayjs().format("YYYY-MM-DDTHH:mm"),
});

const confirm = () => {
  if (!maintenance.value.startTime || !maintenance.value.endTime) {
    return;
  }
  onDialogOK(maintenance.value);
};

const cancel = () => {
  onDialogHide();
};
</script>

<style></style>
