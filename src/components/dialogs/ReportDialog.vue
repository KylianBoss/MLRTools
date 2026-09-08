<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 70%; max-width: 900px">
      <q-card-section>
        <div v-if="report.id" class="text-h6">Modifier le rapport</div>
        <div v-else class="text-h6">Créer un nouveau rapport</div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="report.name"
          label="Nom du rapport"
          outlined
          dense
          class="full-width"
        />
        <q-input
          v-model="report.description"
          label="Description (optionnel)"
          outlined
          dense
          type="textarea"
          autogrow
          class="full-width q-mt-sm"
        />
      </q-card-section>

      <q-card-section class="row q-col-gutter-md">
        <div class="col-6">
          <div class="text-subtitle2 q-mb-sm">Blocs disponibles</div>
          <q-list
            bordered
            separator
            style="height: 320px; overflow-y: auto"
          >
            <q-item v-if="availableFilteredBlocks.length === 0">
              <q-item-section class="text-grey-6 text-center">
                Tous les blocs disponibles sont déjà dans le rapport.
              </q-item-section>
            </q-item>
            <q-item
              v-for="block in availableFilteredBlocks"
              :key="`${block.blockType}:${block.refId}`"
              clickable
              @click="addBlock(block)"
            >
              <q-item-section>{{ block.label }}</q-item-section>
              <q-item-section side>
                <q-btn icon="mdi-plus" flat dense round color="primary" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <div class="col-6">
          <div class="text-subtitle2 q-mb-sm">
            Blocs sélectionnés (ordre du rapport)
          </div>
          <q-list
            bordered
            separator
            style="height: 320px; overflow-y: auto"
          >
            <q-item v-if="selectedBlocks.length === 0">
              <q-item-section class="text-grey-6 text-center">
                Aucun bloc sélectionné.
              </q-item-section>
            </q-item>
            <q-item v-for="(block, index) in selectedBlocks" :key="`${block.blockType}:${block.refId}`">
              <q-item-section>{{ block.label }}</q-item-section>
              <q-item-section side>
                <div class="row no-wrap">
                  <q-btn
                    icon="mdi-arrow-up"
                    flat
                    dense
                    round
                    :disable="index === 0"
                    @click="moveBlock(index, -1)"
                  />
                  <q-btn
                    icon="mdi-arrow-down"
                    flat
                    dense
                    round
                    :disable="index === selectedBlocks.length - 1"
                    @click="moveBlock(index, 1)"
                  />
                  <q-btn
                    icon="mdi-close"
                    flat
                    dense
                    round
                    color="negative"
                    @click="removeBlock(index)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" color="primary" @click="onDialogHide" />
        <q-btn
          flat
          label="OK"
          color="primary"
          :disable="!report.name || report.name.trim().length === 0"
          @click="onOk"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useDialogPluginComponent } from "quasar";
import { ref, computed, onMounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  reportData: {
    type: Object,
    required: false,
  },
});

const report = ref({
  id: null,
  name: "",
  description: "",
  ...props.reportData,
});

// Blocs déjà sélectionnés, avec leur label résolu depuis le catalogue une
// fois celui-ci chargé (voir onMounted).
const selectedBlocks = ref(
  (props.reportData?.blocks || []).map((b) => ({
    blockType: b.blockType,
    refId: b.refId,
    label: b.label || `${b.blockType}${b.refId ? `: ${b.refId}` : ""}`,
  }))
);

const availableBlocks = ref([]);

// [D6] Anti-doublon : un bloc déjà sélectionné disparaît du catalogue
// disponible, empêchant tout ajout en double.
const availableFilteredBlocks = computed(() => {
  const selectedKeys = new Set(
    selectedBlocks.value.map((b) => `${b.blockType}:${b.refId}`)
  );
  return availableBlocks.value.filter(
    (b) => !selectedKeys.has(`${b.blockType}:${b.refId}`)
  );
});

const addBlock = (block) => {
  selectedBlocks.value.push({ ...block });
};

const removeBlock = (index) => {
  selectedBlocks.value.splice(index, 1);
};

const moveBlock = (index, direction) => {
  const target = index + direction;
  if (target < 0 || target >= selectedBlocks.value.length) return;
  const blocks = selectedBlocks.value;
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
};

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const onOk = () => {
  onDialogOK({
    ...report.value,
    blocks: selectedBlocks.value.map((b, i) => ({
      blockType: b.blockType,
      refId: b.refId,
      order: i,
    })),
  });
};

onMounted(async () => {
  const response = await api.get("/reports/available-blocks");
  availableBlocks.value = response.data;

  // Résoudre les labels des blocs déjà sélectionnés (édition d'un rapport
  // existant) à partir du catalogue chargé.
  selectedBlocks.value = selectedBlocks.value.map((b) => {
    const match = availableBlocks.value.find(
      (a) => a.blockType === b.blockType && a.refId === b.refId
    );
    return match ? { ...b, label: match.label } : b;
  });
});
</script>

<style></style>
