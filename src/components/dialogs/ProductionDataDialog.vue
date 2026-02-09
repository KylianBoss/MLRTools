<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">Nouvelle ligne de production</div>
      </q-card-section>

      <q-card-section class="q-pt-none q-gutter-md">
        <q-input
          filled
          v-model="newRow.date"
          label="Date"
          type="date"
          :rules="[(val) => !!val || 'Date requise']"
        />

        <q-input
          filled
          v-model="newRow.start"
          label="Heure de début"
          type="time"
          :rules="[(val) => !!val || 'Heure de début requise']"
        />

        <q-input
          filled
          v-model="newRow.end"
          label="Heure de fin"
          type="time"
          :rules="[(val) => !!val || 'Heure de fin requise']"
        />

        <q-input
          filled
          v-model.number="newRow.boxTreated"
          label="Boxes traitées"
          type="number"
          min="0"
          :rules="[(val) => val >= 0 || 'Valeur positive requise']"
        />

        <q-checkbox v-model="newRow.dayOff" label="Jour non travaillé" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" color="primary" @click="onDialogCancel" />
        <q-btn
          flat
          label="Créer"
          color="primary"
          @click="onOk"
          :loading="loading"
          :disable="!isValid"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref, computed } from "vue";
import dayjs from "dayjs";

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const loading = ref(false);

const newRow = ref({
  date: dayjs().format("YYYY-MM-DD"),
  start: "06:00",
  end: "14:00",
  boxTreated: 0,
  dayOff: false,
});

const isValid = computed(() => {
  return (
    newRow.value.date &&
    newRow.value.start &&
    newRow.value.end &&
    newRow.value.boxTreated >= 0
  );
});

const onOk = () => {
  // Construire l'objet avec les dates complètes
  const rowData = {
    date: dayjs(newRow.value.date).toDate(),
    start: dayjs(`${newRow.value.date} ${newRow.value.start}`).toDate(),
    end: dayjs(`${newRow.value.date} ${newRow.value.end}`).toDate(),
    boxTreated: newRow.value.boxTreated,
    dayOff: newRow.value.dayOff,
  };

  onDialogOK(rowData);
};
</script>
