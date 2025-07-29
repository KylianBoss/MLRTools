<template>
  <q-card v-if="step">
    <q-card-section>
      <div class="text-subtitle2">Étape : {{ progress }} / {{ total }}</div>
    </q-card-section>
    <q-card-section
      v-if="props.step && props.step.linkedImage"
      class="text-center"
    >
      <q-img
        :src="image"
        class="q-mb-md"
        style="max-width: 50%"
        contain
        spinner-color="dark"
      >
        <template v-slot:placeholder>
          <q-spinner color="grey" />
        </template>
      </q-img>
    </q-card-section>
    <q-card-section>
      <q-markup-table flat separator="cell" wrap-cells>
        <thead class="text-center bg-grey-2">
          <tr>
            <th>Description</th>
            <th>Constat d'écart par rapport à l'état de consigne</th>
            <th>Réponse</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td v-html="step.description.replace('\r\n', '<br/>')"></td>
            <td v-html="step.defect.replace('\r\n', '<br/>')"></td>
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
            v-if="progress > 1"
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
import { ref, computed, watch, onMounted } from "vue";
import { api } from "boot/axios";

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
const image = ref(null);

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
watch(
  () => props.step,
  (newStep) => {
    if (newStep && newStep.linkedImage) {
      api.get(`/images/${props.step.linkedImage}`).then((response) => {
        image.value = response.data;
      });
    } else {
      image.value = null; // Reset image if no linked image
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.step && props.step.linkedImage) {
    api.get(`/images/${props.step.linkedImage}`).then((response) => {
      image.value = response.data;
    });
  }
});
</script>

<style></style>
