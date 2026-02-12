<template>
  <q-page padding>
    <div class="q-mb-md">
      <div class="text-h4 q-mb-sm">Journal d'interventions</div>
      <div class="text-subtitle2 text-grey-7">
        Enregistrer les interventions d'aujourd'hui ({{ todayDate }}) -
        planifiées ou non
      </div>
    </div>

    <!-- Add Intervention Form -->
    <q-card class="q-mb-md" v-if="App.userHasAccess('canAccessJournal')">
      <q-card-section>
        <div class="text-h6 q-mb-md">Enregistrer une intervention</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input
              v-model="form.alarmCode"
              label="Code d'alarme"
              outlined
              dense
              hint="Ex: X003, Shuttle 67, etc."
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.startTime"
              label="Heure de début"
              outlined
              dense
              type="time"
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="form.endTime"
              label="Heure de fin"
              outlined
              dense
              type="time"
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.description"
              label="Description"
              outlined
              dense
              hint="Ex: chute d'une pile de caisse, maintenance du stingray"
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.comment"
              label="Commentaire"
              outlined
              dense
              type="textarea"
              rows="3"
            />
          </div>
          <div class="col-12 col-md-6">
            <q-toggle
              v-model="form.isPlanned"
              label="Intervention planifiée (maintenance)"
              color="primary"
              hint="Décocher pour panne ou incident"
            />
          </div>
          <div class="col-12 col-md-6 text-right">
            <q-btn
              color="primary"
              label="Ajouter l'intervention"
              icon="add"
              @click="addIntervention"
              :disable="!form.alarmCode && !form.description"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Interventions List -->
    <q-card>
      <q-card-section>
        <div class="text-h6 q-mb-md">
          Interventions d'aujourd'hui
          <q-badge color="primary" :label="interventions.length" />
        </div>

        <q-list v-if="interventions.length > 0" separator>
          <q-item
            v-for="intervention in interventions"
            :key="intervention.id"
            clickable
            class="q-pa-md"
          >
            <q-item-section>
              <q-item-label class="text-h6">
                <q-badge
                  v-if="intervention.alarmCode"
                  color="primary"
                  :label="intervention.alarmCode"
                  class="q-mr-sm"
                />
                {{ intervention.description || "Sans description" }}
              </q-item-label>
              <q-item-label caption class="q-mt-sm">
                <q-icon name="schedule" size="xs" class="q-mr-xs" />
                <span v-if="intervention.startTime">
                  {{ intervention.startTime }} -
                  {{ intervention.endTime || "?" }}
                </span>
                <span v-else>Horaire non défini</span>
                <q-separator vertical class="q-mx-sm" />
                <q-icon name="person" size="xs" class="q-mr-xs" />
                {{ intervention.creatorFullname || intervention.createdBy }}
                <q-separator vertical class="q-mx-sm" />
                <q-icon name="access_time" size="xs" class="q-mr-xs" />
                {{ formatDate(intervention.createdAt) }}
              </q-item-label>
              <q-item-label v-if="intervention.comment" class="q-mt-sm">
                <div class="text-grey-8">{{ intervention.comment }}</div>
              </q-item-label>
              <q-item-label class="q-mt-sm">
                <q-badge
                  :color="intervention.isPlanned ? 'positive' : 'warning'"
                  :label="
                    intervention.isPlanned
                      ? 'Planifiée (maintenance)'
                      : 'Non planifiée (panne)'
                  "
                />
                <q-badge
                  v-if="intervention.status !== 'pending'"
                  :color="
                    intervention.status === 'validated' ? 'green' : 'grey'
                  "
                  :label="
                    intervention.status === 'validated' ? 'Validé' : 'Ignoré'
                  "
                  class="q-ml-sm"
                />
              </q-item-label>
            </q-item-section>

            <q-item-section side v-if="canModify(intervention)">
              <div class="row q-gutter-sm">
                <q-btn
                  flat
                  dense
                  round
                  icon="edit"
                  color="primary"
                  @click="editIntervention(intervention)"
                  :disable="intervention.status !== 'pending'"
                >
                  <q-tooltip>Modifier</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  @click="deleteIntervention(intervention.id)"
                  :disable="intervention.status !== 'pending'"
                >
                  <q-tooltip>Supprimer</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center text-grey-7 q-pa-lg">
          <q-icon name="event_busy" size="64px" />
          <div class="q-mt-md">Aucune intervention prévue pour aujourd'hui</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Edit Dialog -->
    <q-dialog v-model="editDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Modifier l'intervention</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="editForm.alarmCode"
            label="Code d'alarme"
            outlined
            dense
            class="q-mb-md"
          />
          <div class="row q-col-gutter-sm q-mb-md">
            <div class="col-6">
              <q-input
                v-model="editForm.startTime"
                label="Heure de début"
                outlined
                dense
                type="time"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="editForm.endTime"
                label="Heure de fin"
                outlined
                dense
                type="time"
              />
            </div>
          </div>
          <q-input
            v-model="editForm.description"
            label="Description"
            outlined
            dense
            class="q-mb-md"
          />
          <q-input
            v-model="editForm.comment"
            label="Commentaire"
            outlined
            dense
            type="textarea"
            rows="3"
            class="q-mb-md"
          />
          <q-toggle
            v-model="editForm.isPlanned"
            label="Intervention planifiée (maintenance)"
            color="primary"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" v-close-popup />
          <q-btn label="Enregistrer" color="primary" @click="saveEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import { api } from "boot/axios";
import dayjs from "dayjs";
import { useAppStore } from "stores/app";

const $q = useQuasar();
const App = useAppStore();

const interventions = ref([]);
const loading = ref(false);
const editDialog = ref(false);

const form = ref({
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
});

const editForm = ref({
  id: null,
  alarmCode: "",
  description: "",
  startTime: "",
  endTime: "",
  comment: "",
  isPlanned: false,
});

const todayDate = computed(() => {
  return dayjs().format("YYYY-MM-DD");
});

const formatDate = (date) => {
  return dayjs(date).format("DD/MM/YYYY HH:mm");
};

const canModify = (intervention) => {
  return intervention.createdBy === App.userId;
};

const loadInterventions = async () => {
  loading.value = true;
  try {
    const response = await api.get(`/interventions/journal/${todayDate.value}`);
    interventions.value = response.data;
  } catch (error) {
    console.error("Error loading interventions:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors du chargement des interventions",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const addIntervention = async () => {
  if (!form.value.alarmCode && !form.value.description) {
    $q.notify({
      type: "warning",
      message: "Veuillez remplir au moins le code d'alarme ou la description",
    });
    return;
  }

  try {
    await api.post("/interventions/journal", {
      plannedDate: todayDate.value,
      ...form.value,
    });

    $q.notify({
      type: "positive",
      message: "Intervention ajoutée avec succès",
    });

    // Reset form
    form.value = {
      alarmCode: "",
      description: "",
      startTime: "",
      endTime: "",
      comment: "",
      isPlanned: false,
    };

    // Reload list
    await loadInterventions();
  } catch (error) {
    console.error("Error adding intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'ajout de l'intervention",
      caption: error.message,
    });
  }
};

const editIntervention = (intervention) => {
  editForm.value = {
    id: intervention.id,
    alarmCode: intervention.alarmCode || "",
    description: intervention.description || "",
    startTime: intervention.startTime || "",
    endTime: intervention.endTime || "",
    comment: intervention.comment || "",
    isPlanned: intervention.isPlanned,
  };
  editDialog.value = true;
};

const saveEdit = async () => {
  try {
    const { id, ...updateData } = editForm.value;
    await api.patch(`/interventions/journal/${id}`, updateData);

    $q.notify({
      type: "positive",
      message: "Intervention modifiée avec succès",
    });

    editDialog.value = false;
    await loadInterventions();
  } catch (error) {
    console.error("Error updating intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la modification",
      caption: error.message,
    });
  }
};

const deleteIntervention = async (id) => {
  $q.dialog({
    title: "Confirmer la suppression",
    message: "Êtes-vous sûr de vouloir supprimer cette intervention ?",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/interventions/journal/${id}`);

      $q.notify({
        type: "positive",
        message: "Intervention supprimée",
      });

      await loadInterventions();
    } catch (error) {
      console.error("Error deleting intervention:", error);
      $q.notify({
        type: "negative",
        message: "Erreur lors de la suppression",
        caption: error.message,
      });
    }
  });
};

onMounted(async () => {
  await loadInterventions();
});
</script>
