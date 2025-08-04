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
        style="height: 400px"
        fit="contain"
        spinner-color="dark"
      >
        <template v-slot:placeholder>
          <q-spinner color="grey" />
        </template>
      </q-img>
    </q-card-section>
    <q-card-section>
      <div class="text-h5">
        <q-icon :name="activityTypeIcon" class="q-mr-sm" />{{
          activityTypeText
        }}
      </div>
      <div class="row text-center bg-grey-2 text-bold">
        <div
          class="col-4 q-py-md"
          style="border-right: 1px #ccc solid; border-bottom: 1px #ccc solid"
        >
          Description
        </div>
        <div
          v-if="step.activityType !== 'inspection'"
          class="col-6 q-py-md"
          style="border-right: 1px #ccc solid; border-bottom: 1px #ccc solid"
        >
          Constat d'écart par rapport à l'état de consigne
        </div>
        <div
          v-if="step.activityType == 'inspection'"
          class="col-6 q-py-md"
          style="border-right: 1px #ccc solid; border-bottom: 1px #ccc solid"
        >
          Procédure
        </div>
        <div class="col-2 q-py-md" style="border-bottom: 1px #ccc solid">
          Réponse
        </div>
      </div>
      <div class="row">
        <div
          class="col-4 q-pa-sm"
          v-html="nl2br(step.description)"
          style="border-right: 1px #ccc solid"
        ></div>
        <div
          class="col-6 q-pa-sm"
          v-if="step.activityType !== 'inspection'"
          v-html="nl2br(step.defect)"
          style="border-right: 1px #ccc solid"
        ></div>
        <div
          class="col-6 q-pa-sm"
          v-if="step.activityType == 'inspection'"
          v-html="nl2br(step.process)"
          style="border-right: 1px #ccc solid"
        ></div>
        <div
          class="col-2 q-pa-sm"
          style="border-right: 1px #ccc solid"
          v-if="step.answerType === 'boolean'"
        >
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
        </div>
        <div
          class="col-2 q-pa-sm"
          style="border-right: 1px #ccc solid"
          v-else-if="step.answerType === 'value'"
        >
          <q-input
            v-if="step.activityType !== 'inspection'"
            v-model="answer"
            label="Valeur"
            class="q-mr-sm text-bold"
            dense
          >
            <template v-slot:append v-if="goodAnswerData.unit">
              <span class="text-bold">{{ goodAnswerData.unit }}</span>
            </template>
          </q-input>
          <div class="row" v-if="step.activityType == 'inspection'">
            <div class="col">
              <q-input
                v-model="beforeValue"
                label="Avant"
                class="q-mr-sm text-bold"
                dense
              >
                <template v-slot:append v-if="goodAnswerData.unit">
                  <span class="text-bold">{{ goodAnswerData.unit }}</span>
                </template>
              </q-input>
            </div>
          </div>
          <div class="row">
            <div class="col">
              <q-input
                v-model="afterValue"
                label="Après"
                class="q-mr-sm text-bold"
                dense
              >
                <template v-slot:append v-if="goodAnswerData.unit">
                  <span class="text-bold">{{ goodAnswerData.unit }}</span>
                </template>
              </q-input>
            </div>
          </div>
        </div>
        <div
          class="col-2 q-pa-sm"
          style="border-right: 1px #ccc solid"
          v-else-if="step.answerType === 'replace'"
        >
          <q-checkbox
            v-model="done"
            color="primary"
            label="Fait"
            class="q-mr-sm text-bold"
            v-if="step.doneButton"
          />
          <div>Une pièce à été remplacée ?</div>
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
        </div>
      </div>
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
            :disable="!canGoNext"
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
import nl2br from "nl2br";

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
const done = ref(false);
const beforeValue = ref(null);
const afterValue = ref(null);
const notes = ref("");
const fullStep = computed(() => {
  return {
    ...props.step,
    notes: notes.value,
    answer: answer.value,
    beforeValue: beforeValue.value,
    afterValue: afterValue.value,
    passed: isGoodAnswer.value,
    done: done.value,
  };
});
const goodAnswerData = computed(() => {
  if (props.step.answerType !== "value") return null;
  const parts = props.step.goodAnswer.split(",");
  const data = {};
  parts.forEach((part) => {
    const [key, value] = part.split(":");
    data[key.trim()] = value.trim();
  });
  return data;
});
const isGoodAnswer = computed(() => {
  if (props.step.answerType === "boolean") {
    return answer.value === props.step.goodAnswer;
  } else if (props.step.answerType === "value") {
    return (
      parseFloat(afterValue.value) > parseFloat(goodAnswerData.value.min) &&
      parseFloat(afterValue.value) < parseFloat(goodAnswerData.value.max)
    );
  } else if (props.step.answerType === "replace") {
    return done.value;
  }
  return false;
});
const canGoNext = computed(() => {
  return (
    (props.step.activityType == "preventive" &&
      answer.value &&
      ((props.step.doneButton && done.value) || !props.step.doneButton)) ||
    (props.step.activityType == "inspection" &&
      beforeValue.value &&
      afterValue.value &&
      ((props.step.doneButton && done.value) || !props.step.doneButton)) ||
    (props.step.activityType == "inspection" &&
      props.step.answerType == "replace" &&
      !!done.value &&
      answer.value)
  );
});
const activityTypeText = computed(() => {
  switch (props.step.activityType) {
    case "preventive":
      return "Préventive";
    case "corrective":
      return "Corrective";
    case "inspection":
      return "Inspection";
    default:
      return "Inconnue";
  }
});
const activityTypeIcon = computed(() => {
  switch (props.step.activityType) {
    case "preventive":
      return "mdi-wrench";
    case "corrective":
      return "mdi-hammer-wrench";
    case "inspection":
      return "mdi-eye";
    default:
      return "mdi-help-circle";
  }
});
const image = ref(null);

const next = () => {
  if (
    answer.value ||
    (beforeValue.value && afterValue.value) ||
    (props.step.doneButton && done.value)
  ) {
    emit("next", {
      ...fullStep.value,
      timestamp: new Date().toISOString(),
    });
    answer.value = null; // Reset answer for next step
    notes.value = ""; // Reset notes for next step
    beforeValue.value = null; // Reset before value for next step
    afterValue.value = null; // Reset after value for next step
    done.value = false; // Reset done state for next step
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
      beforeValue.value = newData.beforeValue || null;
      afterValue.value = newData.afterValue || null;
      done.value = newData.done || false;
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
