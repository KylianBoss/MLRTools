<template>
  <q-page padding v-if="maintenancePlan">
    <q-btn
      icon="mdi-arrow-left"
      label="Retour"
      flat
      dense
      :to="{ name: 'maintenance-plans' }"
    />
    <div class="text-h4">Plans de maintenance</div>
    <div class="row">
      <div class="col">
        {{ maintenancePlan.location }} - {{ maintenancePlan.description }}
      </div>
    </div>
    <div class="row q-pt-md">
      <div class="col">
        <q-card>
          <q-card-section>
            <div class="row">
              <div class="col">
                <q-input
                  v-model="maintenancePlan.location"
                  readonly
                  filled
                  dense
                  class="q-mb-md"
                  label="Emplacement"
                >
                  <template v-slot:before>
                    <q-icon name="mdi-map-marker" />
                  </template>
                </q-input>
              </div>
            </div>
            <div class="row">
              <div class="col">
                <q-input
                  v-model="maintenancePlan.description"
                  readonly
                  filled
                  dense
                  class="q-mb-md"
                  label="Description"
                >
                  <template v-slot:before>
                    <q-icon name="mdi-information" />
                  </template>
                </q-input>
              </div>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-subtitle2">Étapes de maintenance</div>
            <q-list dense separator>
              <vue-draggable
                v-model="maintenancePlan.steps"
                ref="stepsList"
                @end="onEndDrag"
                direction="vertical"
                dragClass="bg-grey-2"
                animation="ease"
              >
                <q-item
                  v-for="(step, index) in maintenancePlan.steps"
                  :key="index"
                >
                  <q-item-section avatar style="cursor: move">
                    <q-icon name="mdi-drag" color="grey" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ step.description }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row">
                      <div class="col">
                        <!-- DUPLICATE -->
                        <q-btn
                          color="dark"
                          icon="mdi-content-copy"
                          round
                          flat
                          dense
                          @click="copy(index)"
                        />
                        <!-- EDIT -->
                        <q-btn
                          color="primary"
                          icon="mdi-pencil"
                          round
                          flat
                          dense
                          @click="editStep(index)"
                        />
                        <!-- DELETE -->
                        <q-btn
                          color="negative"
                          icon="mdi-delete"
                          round
                          flat
                          dense
                          @click="deleteStep(index)"
                        />
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </vue-draggable>
              <q-item>
                <q-item-section>
                  <q-btn
                    color="primary"
                    icon="mdi-plus"
                    label="Ajouter une étape"
                    flat
                    dense
                    @click="addStep"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
  <q-dialog v-model="stepDialog" persistent>
    <q-card style="min-width: 80vw">
      <q-card-section>
        <div class="text-h6">
          {{ stepData.id ? "Modifier l'étape" : "Ajouter une étape" }}
        </div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="stepData.description"
          label="Description"
          filled
          dense
          autogrow
          autofocus
          class="q-mb-md"
        />
        <q-input
          v-model="stepData.defect"
          label="Défaut"
          filled
          dense
          autogrow
          class="q-mb-md"
        />
        <q-input
          v-model="stepData.fixing"
          label="Réparation"
          filled
          dense
          autogrow
          class="q-mb-md"
        />
        <q-select
          v-model="stepData.answerType"
          :options="['boolean', 'value']"
          label="Type de réponse"
          filled
          dense
          class="q-mb-md"
        />
        <q-select
          v-if="stepData.answerType === 'boolean'"
          v-model="stepData.goodAnswer"
          :options="[
            { label: 'Oui', value: 'yes' },
            { label: 'Non', value: 'no' },
          ]"
          map-options
          emit-value
          label="Réponse pour que l'étape soit compté bonne"
          filled
          dense
          class="q-mb-md"
        />
        <q-input
          v-if="stepData.answerType === 'value'"
          type="number"
          v-model="stepData.goodAnswer"
          label="Réponse pour que l'étape soit compté bonne"
          filled
          dense
        />
        <q-input
          v-model="stepData.notesPlaceholder"
          label="Placeholder pour les notes"
          filled
          dense
          class="q-mb-md"
        />
        <div class="text-center">
          <q-img
            v-if="stepData.image"
            :src="stepData.image"
            class="q-mb-md"
            style="max-width: 50%"
            contain
            spinner-color="dark"
          >
            <template v-slot:placeholder>
              <q-spinner color="grey" />
            </template>
          </q-img>
        </div>
        <q-file
          v-model="stepData.linkedImage"
          label="Image liée à l'étape"
          filled
          dense
          class="q-mb-md"
          accept="image/*"
          @added="stepData.linkedImage = $event[0]"
          @removed="stepData.linkedImage = null"
        >
          <template v-slot:append>
            <q-icon name="mdi-image" />
          </template>
        </q-file>
        <q-btn
          color="primary"
          label="Sélectionner une image existante"
          flat
          dense
          @click="imageListDialog = true"
        />
      </q-card-section>
      <q-card-actions>
        <q-btn label="Annuler" @click="stepDialog = false" flat />
        <q-space />
        <q-btn
          color="primary"
          :label="stepData.id ? 'Enregistrer' : 'Ajouter'"
          @click="saveStep"
          :disable="
            !stepData.description ||
            !stepData.defect ||
            !stepData.fixing ||
            !stepData.answerType ||
            !stepData.goodAnswer
          "
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="imageListDialog" persistent>
    <q-card style="min-width: 80vw">
      <q-card-section>
        <div class="text-h6">Sélectionner une image</div>
      </q-card-section>
      <q-card-section>
        <q-list dense>
          <q-item
            v-for="image in imageList"
            :key="getImage(image)"
            clickable
            @click="selectImageFromList(image)"
          >
            <q-item-section avatar>
              <q-img :src="image.data" style="width: 300px; height: 400px" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-actions>
        <q-btn label="Fermer" @click="imageListDialog = false" flat />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useRoute } from "vue-router";
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useAppStore } from "stores/app";
import { VueDraggable } from "vue-draggable-plus";

const App = useAppStore();
const route = useRoute();
const maintenancePlan = ref(null);
const steps = ref([]);
const stepDialog = ref(false);
const stepData = ref({
  id: null,
  description: "",
  defect: "",
  fixing: "",
  answerType: "",
  goodAnswer: "",
  linkedImage: null,
  notesPlaceholder: "",
});
const imageList = ref([]);
const imageListDialog = ref(false);

const fetchMaintenancePlan = async () => {
  try {
    const response = await api.get(`/maintenance/plans/${route.params.planId}`);
    maintenancePlan.value = response.data;
    steps.value = response.data.steps || [];
  } catch (error) {
    console.error("Error fetching maintenance plan:", error);
  }
};

const onEndDrag = async (event) => {
  const { oldIndex, newIndex } = event;

  if (oldIndex !== newIndex) {
    let index = 0;
    const newStepData = [];
    for (const step of maintenancePlan.value.steps) {
      step.order = index;
      newStepData.push({
        maintenancePlanId: maintenancePlan.value.id,
        stepId: step.id,
        order: index,
      });
      index++;
    }

    await api.post("/maintenance/plans/steps-reorder", { newStepData });
  }
};

const addStep = () => {
  stepData.value = {
    id: null,
    description: "",
    defect: "",
    fixing: "",
    answerType: "boolean",
    goodAnswer: "",
    linkedImage: null,
    notesPlaceholder: "",
  };
  stepDialog.value = true;
};

const editStep = async (index) => {
  const step = maintenancePlan.value.steps[index];
  stepData.value = {
    id: step.id,
    description: step.description,
    defect: step.defect,
    fixing: step.fixing,
    answerType: step.answerType,
    goodAnswer: step.goodAnswer,
    linkedImage: step.linkedImage || null,
    image: null,
    notesPlaceholder: step.notesPlaceholder || "",
  };
  if (step.linkedImage) {
    try {
      const imageResponse = await api.get(`/images/${step.linkedImage}`);
      stepData.value.image = imageResponse.data;
    } catch (error) {
      console.error("Error fetching step image:", error);
    }
  } else {
    stepData.value.image = null; // Reset image if no linked image
  }
  api
    .get("/images/list")
    .then((response) => {
      imageList.value = response.data;
    })
    .catch((error) => {
      console.error("Error fetching image list:", error);
    });
  stepDialog.value = true;
};

const deleteStep = async (index) => {
  const step = maintenancePlan.value.steps[index];
  try {
    await api.delete(`/maintenance/plans/steps/${step.id}`);
    maintenancePlan.value.steps.splice(index, 1);
    let newIndex = 0;
    const newStepData = [];
    for (const step of maintenancePlan.value.steps) {
      step.order = newIndex;
      newStepData.push({
        maintenancePlanId: maintenancePlan.value.id,
        stepId: step.id,
        order: newIndex,
      });
      newIndex++;
    }
    await api.post("/maintenance/plans/steps-reorder", { newStepData });
  } catch (error) {
    console.error("Error deleting step:", error);
  }
};

const copy = (index) => {
  const step = { ...maintenancePlan.value.steps[index] };
  stepData.value = {
    id: null,
    description: step.description,
    defect: step.defect,
    fixing: step.fixing,
    answerType: step.answerType,
    goodAnswer: step.goodAnswer,
    linkedImage: step.linkedImage || null,
    notesPlaceholder: step.notesPlaceholder || "",
  };
  stepDialog.value = true;
};

const saveStep = async () => {
  try {
    if (stepData.value.linkedImage instanceof File) {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        api
          .post("/images/upload", {
            image: e.target.result,
          })
          .then(async (response) => {
            stepData.value.linkedImage = response.data.id;

            if (stepData.value.id) {
              await api.put(
                `/maintenance/plans/steps/${stepData.value.id}`,
                stepData.value
              );
            } else {
              await api.post("/maintenance/plans/steps", {
                ...stepData.value,
                maintenancePlanId: maintenancePlan.value.id,
                order: maintenancePlan.value.steps.length,
              });
            }
          })
          .catch((error) => {
            console.error("Error uploading image:", error);
          });
      };
      fileReader.readAsDataURL(stepData.value.linkedImage);
    } else {
      if (stepData.value.id) {
        await api.put(
          `/maintenance/plans/steps/${stepData.value.id}`,
          stepData.value
        );
      } else {
        await api.post("/maintenance/plans/steps", {
          ...stepData.value,
          maintenancePlanId: maintenancePlan.value.id,
          order: maintenancePlan.value.steps.length,
        });
      }
    }
    stepDialog.value = false;
    fetchMaintenancePlan();
  } catch (error) {
    console.error("Error saving step:", error);
  }
};

const getImage = (img) => {
  api
    .get(`/images/${img.id}`)
    .then((response) => {
      img.data = response.data;
    })
    .catch((error) => {
      console.error("Error fetching image:", error);
      return null;
    });
};

const selectImageFromList = (image) => {
  stepData.value.linkedImage = image.id;
  stepData.value.image = image.data;
  imageListDialog.value = false;
};

onMounted(() => {
  if (route.params.planId) {
    fetchMaintenancePlan();
  } else {
    console.warn("No plan ID provided in route parameters.");
  }
});
</script>

<style></style>
