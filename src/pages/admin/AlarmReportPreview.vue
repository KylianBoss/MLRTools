<template>
  <q-page class="q-pa-md">
    <q-card class="q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-auto">
          <div class="text-h6">Aperçu du rapport quotidien des alarmes</div>
          <div class="text-caption text-grey-7">
            Mêmes calculs que le mail envoyé par le cron "Send Alarm Report",
            sans envoi.
          </div>
        </div>
        <q-space />
        <div class="col-auto">
          <q-input
            v-model="selectedDate"
            label="Date"
            type="date"
            filled
            dense
            style="min-width: 180px"
            @update:model-value="loadPreview"
          />
        </div>
        <div class="col-auto">
          <q-btn
            icon="mdi-refresh"
            color="primary"
            round
            flat
            :loading="loading"
            @click="loadPreview"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-inner-loading :showing="loading">
      <q-spinner-dots size="50px" color="primary" />
    </q-inner-loading>

    <div v-if="!loading && error" class="text-negative q-pa-md">
      Erreur lors du chargement de l'aperçu : {{ error }}
    </div>

    <div v-else-if="!loading && report && report.empty" class="text-grey-7 q-pa-md">
      Aucune alarme trouvée pour le {{ report.date }}.
    </div>

    <div v-else-if="!loading && report" class="report-preview">
      <div class="report-header">
        <div class="report-header-title">Rapport quotidien des alarmes</div>
        <div class="report-header-date">{{ report.date }}</div>
      </div>

      <div class="report-body">
        <div class="row q-col-gutter-sm q-mb-lg">
          <div class="col">
            <div class="stat-box">
              <div class="stat-value">{{ report.totalPrimary }}</div>
              <div class="stat-label">Alarmes primaires</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-box">
              <div class="stat-value">{{ report.totalUnclassified }}</div>
              <div class="stat-label">Alarmes non classées</div>
            </div>
          </div>
          <div class="col">
            <div class="stat-box">
              <div class="stat-value">{{ report.totalAssigned }}</div>
              <div class="stat-label">Alarmes assignées</div>
            </div>
          </div>
        </div>

        <div class="q-mb-lg">
          <div class="row items-center justify-between text-caption text-grey-7 q-mb-xs">
            <span>Pourcentage d'alarmes assignées</span>
            <span class="text-weight-bold" :style="{ color: percentageColor }">
              {{ percentageLabel }}
            </span>
          </div>
          <div class="percentage-bar-track">
            <div
              class="percentage-bar-fill"
              :style="{
                width: `${report.assignedPercentage ?? 0}%`,
                background: percentageColor,
              }"
            />
          </div>
        </div>

        <div class="text-subtitle2 q-mb-sm">Détail par personne</div>
        <q-markup-table flat bordered dense>
          <thead>
            <tr>
              <th class="text-left">Personne</th>
              <th class="text-center">Alarmes</th>
              <th class="text-center">Temps moyen de prise</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="report.userStats.length === 0">
              <td colspan="3" class="text-center text-grey-7">
                Aucune alarme assignée
              </td>
            </tr>
            <tr v-for="u in report.userStats" :key="u.username">
              <td>{{ u.username }}</td>
              <td class="text-center">{{ u.count }}</td>
              <td class="text-center">
                {{ formatDuration(u.avgResponseMinutes) }}
                <q-badge
                  v-if="u.hasMissingAssignmentTime"
                  color="grey-5"
                  text-color="white"
                  class="q-ml-xs"
                  label="partiel"
                />
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import dayjs from "dayjs";
import { api } from "boot/axios";

const selectedDate = ref(dayjs().subtract(1, "day").format("YYYY-MM-DD"));
const report = ref(null);
const loading = ref(false);
const error = ref(null);

const percentageColor = computed(() => {
  const pct = report.value?.assignedPercentage;
  if (pct === null || pct === undefined) return "#9ca3af";
  if (pct < 33) return "#dc2626";
  if (pct < 66) return "#d97706";
  return "#16a34a";
});

const percentageLabel = computed(() => {
  const pct = report.value?.assignedPercentage;
  return pct === null || pct === undefined ? "N/A" : `${pct}%`;
});

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "N/A";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const loadPreview = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await api.get("alarms/alarm-report-preview", {
      params: { date: selectedDate.value },
    });
    report.value = response.data;
  } catch (e) {
    error.value = e.response?.data?.error || e.message;
  } finally {
    loading.value = false;
  }
};

onMounted(loadPreview);
</script>

<style scoped>
.report-preview {
  max-width: 600px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
:root[data-theme="dark"] .report-preview,
.body--dark .report-preview {
  background: #1e1e1e;
  border-color: #3a3a3a;
}
.report-header {
  background: #1e3a5f;
  padding: 24px 32px;
}
.report-header-title {
  color: #fff;
  font-size: 20px;
  font-weight: bold;
}
.report-header-date {
  color: #93c5fd;
  font-size: 14px;
  margin-top: 4px;
}
.report-body {
  padding: 24px 32px;
}
.stat-box {
  padding: 12px;
  background: #f3f4f6;
  border-radius: 6px;
  text-align: center;
}
.body--dark .stat-box {
  background: #2a2a2a;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #1e3a5f;
}
.body--dark .stat-value {
  color: #93c5fd;
}
.stat-label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}
.percentage-bar-track {
  background: #e5e7eb;
  border-radius: 999px;
  height: 10px;
  overflow: hidden;
}
.body--dark .percentage-bar-track {
  background: #3a3a3a;
}
.percentage-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}
</style>
