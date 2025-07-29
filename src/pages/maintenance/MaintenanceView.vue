<template>
  <q-page padding>
    <div class="text-h4">Maintenance</div>
    <div class="row">
      <div class="col">
        {{ maintenance?.location }} - {{ maintenance?.description }}
      </div>
    </div>
    <div class="row" v-if="!terminated">
      <div class="col">
        <maintenance-step
          :step="maintenance?.steps[activeStep]"
          @next="nextStep"
          @back="activeStep--"
          :progress="activeStep + 1"
          :total="maintenance?.steps.length"
          :data="report[activeStep] || {}"
        />
      </div>
    </div>
    <div class="row" v-else>
      <q-card class="col">
        <q-card-section>
          <div class="text-h6">Maintenance terminée</div>
          <div class="text-subtitle2">Rapport de maintenance :</div>
          <pre>{{ report }}</pre>
        </q-card-section>
        <q-card-section>
          <div class="row">
            <div class="col text-right">
              <q-btn
                color="primary"
                @click="confirm"
                label="Confirmer et retourner"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "boot/axios";
import { useAppStore } from "stores/app";
import { useRoute, useRouter } from "vue-router";
import MaintenanceStep from "components/maintenance/MaintenanceStep.vue";

const App = useAppStore();
const route = useRoute();
const router = useRouter();
const maintenance = ref(null);
const activeStep = ref(0);
const report = ref([]);
const terminated = ref(false);

const nextStep = (step) => {
  report.value[activeStep.value] = step;
  activeStep.value++;
  save();
  if (activeStep.value >= maintenance.value.steps.length) {
    terminated.value = true;
  }
};

const confirm = async () => {
  try {
    await api.post(`/maintenance/complete`, {
      id: maintenance.value.id,
      report: report.value,
    });
    router.push({ name: "maintenances-scheduled" });
  } catch (error) {
    console.error("Error confirming maintenance:", error);
  }
};

const save = async () => {
  try {
    await api.post(`/maintenance/save`, {
      id: maintenance.value.id,
      report: report.value,
    });
  } catch (error) {
    console.error("Error saving maintenance:", error);
  }
};

onMounted(async () => {
  if (route.params.maintenanceId) {
    try {
      const response = await api.get(
        `/maintenance/${route.params.maintenanceId}`
      );
      maintenance.value = response.data;
      const resume = await api.get(
        `/maintenance/resume/${route.params.maintenanceId}`
      );
      report.value = resume.data.report || [];
      activeStep.value = resume.data.report?.length || 0;
    } catch (error) {
      console.error("Error fetching maintenance data:", error);
    }
  } else {
    console.warn("No maintenance ID provided in route parameters.");
  }
});
</script>

<style></style>
