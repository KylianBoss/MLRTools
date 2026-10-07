<template>
  <div
    class="photo-thumbnail cursor-pointer"
    @click="showFullSize = true"
  >
    <q-img
      v-if="blobUrl"
      :src="blobUrl"
      spinner-color="primary"
      fit="cover"
      style="width: 48px; height: 48px; border-radius: 4px"
    />
    <q-spinner
      v-else-if="loading"
      color="primary"
      size="24px"
    />
    <q-icon
      v-else
      name="broken_image"
      color="grey-5"
      size="24px"
    />
  </div>

  <q-dialog v-model="showFullSize">
    <q-card>
      <q-img
        v-if="blobUrl"
        :src="blobUrl"
        style="max-width: 90vw; max-height: 90vh"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { api } from "boot/axios";

const props = defineProps({
  caseCrashId: {
    type: [Number, String],
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
});

const blobUrl = ref(null);
const loading = ref(true);
const showFullSize = ref(false);

onMounted(async () => {
  try {
    const response = await api.get(
      `/case-crashes/${props.caseCrashId}/photos/${props.filename}`,
      { responseType: "blob" }
    );
    blobUrl.value = URL.createObjectURL(response.data);
  } catch (error) {
    console.error("Error loading case crash photo:", error);
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value);
  }
});
</script>
