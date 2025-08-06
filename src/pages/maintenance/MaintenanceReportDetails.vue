<template>
  <q-page padding>
    <q-btn
      icon="mdi-arrow-left"
      label="Retour"
      flat
      dense
      :to="{ name: 'maintenance-reports' }"
    />
    <div class="text-h4">Rapport de maintenance</div>
    <div class="row q-pt-md">
      <div class="col">
        <q-card flat bordered class="q-pa-md" id="maintenance-report-card">
          <q-card-section>
            <div class="text-h6">Détails :</div>
            <q-separator />
            <div class="row">
              <div class="col col-3">Plan de maintenance :</div>
              <div class="col">{{ maintenanceReport?.plan?.description }}</div>
            </div>
            <div class="row">
              <div class="col col-3">Emplacement :</div>
              <div class="col">{{ maintenanceReport?.plan?.location }}</div>
            </div>
            <div class="row">
              <div class="col col-3">Type de maintenance :</div>
              <div class="col">{{ maintenanceReport?.plan?.type }}</div>
            </div>
            <div class="row">
              <div class="col col-3">Effectué par :</div>
              <div class="col">
                {{ maintenanceReport?.performedBy?.fullname || "N/A" }}
              </div>
            </div>
            <div class="row">
              <div class="col col-3">Début :</div>
              <div class="col">
                {{
                  dayjs(maintenanceReport?.startTime).format("DD/MM/YYYY HH:mm")
                }}
              </div>
            </div>
            <div class="row">
              <div class="col col-3">Fin :</div>
              <div class="col">
                {{
                  dayjs(maintenanceReport?.endTime).format("DD/MM/YYYY HH:mm")
                }}
              </div>
            </div>
            <div class="row">
              <div class="col col-3">Durée :</div>
              <div class="col">
                {{
                  dayjs(maintenanceReport?.endTime).diff(
                    dayjs(maintenanceReport?.startTime),
                    "minute"
                  ) + " minutes"
                }}
              </div>
            </div>
            <div class="row">
              <div class="col col-3">Tâches :</div>
              <div class="col">
                <q-icon name="mdi-check" color="green" size="sm" />
                {{ maintenanceReport?.report?.filter((s) => s.passed).length }}
                <q-icon name="mdi-close" color="red" size="sm" />
                {{ maintenanceReport?.report?.filter((s) => !s.passed).length }}
                <q-icon name="mdi-screwdriver" color="primary" size="sm" />
                {{
                  maintenanceReport?.report?.filter(
                    (s) => s.answerType === "replace" && s.answer === "yes"
                  ).length
                }}
              </div>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-h6">Rapport :</div>
            <q-separator />
            <q-list separator>
              <q-item
                v-for="(step, index) in maintenanceReport?.report"
                :key="index"
                :class="{
                  'bg-red-1': !step.passed,
                  'page-break': [5, 15, 25, 35, 45].includes(index),
                }"
                clickable
              >
                <q-item-section avatar>
                  <q-avatar color="primary" text-color="white" size="sm">
                    {{ index + 1 }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <div class="text-subtitle1">{{ step.description }}</div>
                  <!-- <div class="text-caption">{{ step.defect }}</div> -->
                  <div class="text-caption q-pl-sm">
                    Notes :
                    <span class="text-bold">
                      {{ step.notes || "Aucune note" }}
                    </span>
                  </div>
                  <div
                    class="text-caption q-pl-sm"
                    v-if="step.answerType === 'value'"
                  >
                    Valeurs : avant
                    <span class="text-bold">
                      {{ step.beforeValue }}
                      {{ goodAnswerData(step).unit }}
                    </span>
                    => après
                    <step class="text-bold">
                      {{ step.afterValue }}
                      {{ goodAnswerData(step).unit }}
                    </step>
                  </div>
                  <div
                    class="text-caption q-pl-sm"
                    v-if="step.answerType === 'value'"
                  >
                    Limites : min
                    <span class="text-bold">
                      {{ goodAnswerData(step).min }}
                      {{ goodAnswerData(step).unit }}
                    </span>
                    | max
                    <step class="text-bold">
                      {{ goodAnswerData(step).max }}
                      {{ goodAnswerData(step).unit }}
                    </step>
                  </div>
                  <div
                    class="text-caption q-pl-sm"
                    v-if="step.answerType === 'replace'"
                  >
                    Remplacement de pièce :
                    <span class="text-bold">
                      {{ step.answer === "yes" ? "Oui" : "Non" }}
                    </span>
                  </div>
                </q-item-section>
                <q-item-section side>
                  <div>
                    <q-icon
                      name="mdi-screwdriver"
                      color="primary"
                      v-if="
                        step.answerType === 'replace' && step.answer === 'yes'
                      "
                      size="sm"
                      title="Remplacement de pièce effectué"
                    />
                    <q-icon
                      name="mdi-check"
                      color="green"
                      v-if="step.passed"
                      size="sm"
                    />
                    <q-icon name="mdi-close" color="red" v-else size="sm" />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
        <q-btn
          class="q-mt-md"
          color="primary"
          label="Imprimer le rapport"
          icon="mdi-printer"
          @click="printReport"
          flat
          dense
        />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAppStore } from "stores/app";
import { api } from "boot/axios";
import { useRoute } from "vue-router";
import dayjs from "dayjs";
import html2pdf from "html2pdf.js";

const App = useAppStore();
const route = useRoute();
const maintenanceReportId = ref(route.params.reportId);
const maintenanceReport = ref(null);

const goodAnswerData = (step) => {
  if (step.answerType !== "value") return null;
  const parts = step.goodAnswer.split(",");
  const data = {};
  parts.forEach((part) => {
    const [key, value] = part.split(":");
    data[key.trim()] = value.trim();
  });
  return data;
};

const printReport = () => {
  const element = document.getElementById("maintenance-report-card");
  const opt = {
    margin: 0,
    filename: `rapport-maintenance-${
      maintenanceReport.value.plan.description
    }-${maintenanceReport.value.plan.location}-${dayjs(
      maintenanceReport.value.startTime
    ).format("YYYY-MM-DD")}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    pagebreak: { after: ".page-break" },
  };
  html2pdf()
    .from(element)
    .set(opt)
    .save()
    .catch((error) => {
      console.error("Error generating PDF:", error);
    });
};

onMounted(async () => {
  try {
    const response = await api.get(
      `/maintenance/reports/${maintenanceReportId.value}`
    );
    maintenanceReport.value = response.data;
  } catch (error) {
    console.error("Error fetching maintenance report:", error);
  }
});
</script>

<style></style>
