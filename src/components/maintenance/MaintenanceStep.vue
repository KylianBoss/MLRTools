<template>
  <q-card v-if="step">
    <q-card-section>
      <div class="text-subtitle2">Étape : {{ progress }} / {{ total }}</div>
    </q-card-section>
    <q-card-section v-if="step?.linkedImage">
      <q-img
        :src="step.linkedImage"
        :alt="`Image for step ${step.id}`"
        class="q-mb-md"
      />
    </q-card-section>
    <q-card-section>
      <q-markup-table flat separator="cell" wrap-cells>
        <thead>
          <tr>
            <th class="text-bold text-center">Description</th>
            <th class="text-center">
              Constat d'écart par rapport à l'état de consigne
            </th>
            <th class="text-center">Réponse</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ step.description }}</td>
            <td>{{ step.defect }}</td>
            <td v-if="step.answerType === 'boolean'">
              <q-checkbox
                :model-value="answer === 'yes'"
                @update:model-value="answer = $event ? 'yes' : 'no'"
                color="primary"
                label="Oui"
                class="q-mr-sm text-bold"
              />
              <q-checkbox
                :model-value="answer === 'no'"
                @update:model-value="answer = $event ? 'no' : 'yes'"
                color="primary"
                label="Non"
                class="q-mr-sm text-bold"
              />
            </td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>
    <q-card-section>
      <q-input
        v-model="notes"
        type="textarea"
        label="Notes"
        :placeholder="step.notesPlaceholder || 'Ajouter des notes...'"
        class="q-mb-md"
      />
    </q-card-section>
    <q-card-action>
      <div class="row q-pa-md">
        <div class="col">
          <q-btn
            color="secondary"
            @click="back"
            label="Retour"
            flat
            v-if="progress > 0"
          />
        </div>
        <div class="col text-right">
          <q-btn
            color="primary"
            @click="next"
            :disable="!answer"
            label="Suivant"
          />
        </div>
      </div>
    </q-card-action>
  </q-card>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  step: {
    type: Object,
    required: true,
  },
  progress: {
    type: Number,
    default: 1,
  },
  total: {
    type: Number,
    default: 1,
  },
  data: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["next", "back"]);
const answer = ref(null);
const notes = ref("");
const fullStep = computed(() => {
  return {
    ...props.step,
    notes: notes.value,
    answer: answer.value,
    passed: answer.value == props.step.goodAnswer,
  };
});

const next = () => {
  if (answer.value) {
    emit("next", {
      ...fullStep.value,
      timestamp: new Date().toISOString(),
    });
    answer.value = null; // Reset answer for next step
    notes.value = ""; // Reset notes for next step
  } else {
    console.warn("Please provide an answer before proceeding.");
  }
};

const back = () => {
  emit("back");
};

watch(
  () => props.data,
  (newData) => {
    if (newData) {
      notes.value = newData.notes || "";
      answer.value = newData.answer || null;
    }
  },
  { immediate: true }
);
</script>

<style></style>
