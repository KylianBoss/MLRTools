<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 700px; max-width: 900px">
      <q-card-section class="row items-center q-pb-none">
        <q-avatar icon="psychology" color="secondary" text-color="white" />
        <span class="q-ml-sm text-h6">Recherche d'alarmes par IA</span>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Status Connection -->
        <div class="row items-center q-mb-md q-pa-sm rounded-borders" :class="statusClass">
          <q-icon :name="statusIcon" size="sm" class="q-mr-sm" />
          <span class="text-caption">{{ statusText }}</span>
        </div>

        <!-- Description de l'intervention -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-xs">Description de l'intervention :</div>
            <div class="text-body2 text-grey-8">{{ description }}</div>
            <div class="row q-gutter-sm q-mt-sm">
              <q-badge outline color="primary" :label="`Code: ${alarmCode || 'Non spécifié'}`" />
              <q-badge outline color="grey" :label="`${startTime} - ${endTime}`" />
            </div>
          </q-card-section>
        </q-card>

        <!-- Action Button -->
        <div class="text-center q-mb-md">
          <q-btn
            color="secondary"
            icon="auto_awesome"
            label="Rechercher avec l'IA"
            @click="findAlarmsWithAI"
            :loading="loading"
            :disable="!aiConnected"
            size="lg"
          />
        </div>

        <!-- Results -->
        <div v-if="results">
          <!-- AI Explanation -->
          <q-card v-if="results.aiExplanation" flat bordered class="q-mb-md bg-blue-1">
            <q-card-section>
              <div class="text-subtitle2 text-primary q-mb-xs">
                <q-icon name="lightbulb" size="sm" class="q-mr-xs" />
                Analyse de l'IA
              </div>
              <div class="text-body2" style="white-space: pre-wrap">
                {{ results.aiExplanation }}
              </div>
            </q-card-section>
          </q-card>

          <!-- Selected Alarms -->
          <div class="text-subtitle1 q-mb-sm">
            Alarmes sélectionnées par l'IA ({{ results.selectedCount }} / {{ results.totalCount }})
          </div>
          
          <div v-if="results.alarms.length === 0" class="text-center text-grey-7 q-pa-md">
            <q-icon name="info" size="lg" />
            <div>Aucune alarme correspondante trouvée</div>
          </div>

          <q-list v-else bordered separator class="rounded-borders">
            <q-item v-for="alarm in results.alarms" :key="alarm.id" clickable @click="toggleAlarm(alarm.id)">
              <q-item-section side>
                <q-checkbox :model-value="selectedAlarmIds.includes(alarm.id)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  <q-badge :color="getAlarmColor(alarm.alarmCode)" :label="alarm.alarmCode" class="q-mr-sm" />
                  {{ alarm.alarmText }}
                </q-item-label>
                <q-item-label caption>
                  {{ formatDateTime(alarm.dateTime) }} | {{ alarm.dataSource }} - {{ alarm.alarmArea }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge v-if="alarm.aiRelevance" color="secondary" :label="`${alarm.aiRelevance}%`" />
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Manual Search Toggle -->
          <div class="q-mt-md">
            <q-expansion-item
              v-model="showManualSearch"
              icon="tune"
              label="Voir toutes les alarmes disponibles"
              caption="Afficher toutes les alarmes de la période"
            >
              <q-card flat bordered class="q-mt-sm">
                <q-card-section>
                  <div class="text-caption text-grey-7 q-mb-sm">
                    {{ results.totalCount }} alarmes dans la plage horaire
                  </div>
                  <q-list separator dense>
                    <q-item
                      v-for="alarm in results.allAlarms"
                      :key="'all-' + alarm.id"
                      clickable
                      @click="toggleAlarm(alarm.id)"
                    >
                      <q-item-section side>
                        <q-checkbox :model-value="selectedAlarmIds.includes(alarm.id)" size="xs" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label caption>
                          <q-badge size="xs" :color="getAlarmColor(alarm.alarmCode)" :label="alarm.alarmCode" />
                          {{ formatDateTime(alarm.dateTime) }} | {{ alarm.dataSource }} - {{ alarm.alarmText }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </q-expansion-item>
          </div>
        </div>

        <!-- Error -->
        <q-banner v-if="error" class="bg-negative text-white q-mt-md" rounded>
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          {{ error }}
        </q-banner>
        <pre>{{ selectedAlarmIds }}</pre>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Annuler" v-close-popup />
        <q-btn
          v-if="results && results.alarms.length > 0"
          color="positive"
          label="Valider la sélection"
          icon="check"
          @click="confirmSelection"
          :disable="selectedAlarmIds.length === 0"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from 'boot/axios';
import dayjs from 'dayjs';

// Props
const props = defineProps({
  description: { type: String, required: true },
  alarmCode: { type: String, default: '' },
  plannedDate: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
});

const show = defineModel({ type: Boolean, default: false });

// Emits
const emit = defineEmits(['alarmsSelected']);

// Data
const aiConnected = ref(false);
const loading = ref(false);
const error = ref('');
const results = ref(null);
const selectedAlarmIds = ref([]);
const showManualSearch = ref(false);
const needsDownload = ref(false);
const isInitialized = ref(false);

// Computed
const statusClass = computed(() => {
  return aiConnected.value ? 'bg-positive-1' : 'bg-negative-1';
});

const statusIcon = computed(() => {
  return aiConnected.value ? 'check_circle' : 'error';
});

const statusText = computed(() => {
  if (needsDownload.value) return 'Modèle non téléchargé (Admin uniquement)';
  if (!isInitialized.value) return 'Modèle en cours d\'initialisation...';
  return aiConnected.value 
    ? 'IA connectée et prête'
    : 'IA non disponible';
});

// Methods
const checkConnection = async () => {
  try {
    const response = await api.get('/ai/status');
    const status = response.data;
    
    isInitialized.value = status.isInitialized;
    needsDownload.value = !status.modelExists;
    aiConnected.value = status.isInitialized && status.modelExists;
    
    if (!status.modelExists) {
      error.value = 'Le modèle IA n\'est pas encore téléchargé. Contactez un administrateur.';
    } else if (!status.isInitialized) {
      // Try to initialize
      try {
        const initResponse = await api.post('/ai/initialize');
        if (initResponse.data.success) {
          aiConnected.value = true;
          isInitialized.value = true;
          error.value = '';
        } else {
          // Initialization failed - possibly corrupted file
          error.value = `Échec d'initialisation: ${initResponse.data.error}`;
          aiConnected.value = false;
        }
      } catch (initError) {
        console.error('AI initialization failed:', initError);
        error.value = 'Erreur d\'initialisation du modèle. Le fichier pourrait être corrompu.';
        aiConnected.value = false;
      }
    }
  } catch (err) {
    aiConnected.value = false;
    if (err.response?.status === 403) {
      error.value = 'Fonctionnalité réservée aux administrateurs';
    } else {
      console.error('AI connection check failed:', err);
    }
  }
};

const findAlarmsWithAI = async () => {
  if (!aiConnected.value) return;
  
  loading.value = true;
  error.value = '';
  results.value = null;
  selectedAlarmIds.value = [];
  
  try {
    const response = await api.post('/ai/find-alarms', {
      description: props.description,
      plannedDate: props.plannedDate,
      startTime: props.startTime,
      endTime: props.endTime,
    });
    
    if (response.data.success) {
      results.value = {
        alarms: response.data.alarms,
        allAlarms: response.data.allAlarms,
        aiExplanation: response.data.aiExplanation,
        selectedCount: response.data.selectedCount,
        totalCount: response.data.allAlarms.length,
      };
      
      // Pre-select AI-suggested alarms
      selectedAlarmIds.value = response.data.alarms.map(a => a.id);
    } else {
      error.value = response.data.error || 'Erreur inconnue';
    }
  } catch (err) {
    error.value = 'Erreur lors de la requête : ' + err.message;
  } finally {
    loading.value = false;
  }
};

const toggleAlarm = (alarmId) => {
  const index = selectedAlarmIds.value.indexOf(alarmId);
  if (index > -1) {
    selectedAlarmIds.value.splice(index, 1);
  } else {
    selectedAlarmIds.value.push(alarmId);
  }
};

const confirmSelection = () => {
  emit('alarmsSelected', selectedAlarmIds.value);
  show.value = false;
};

const formatDateTime = (dateTime) => {
  return dayjs(dateTime).format('DD/MM HH:mm:ss');
};

const getAlarmColor = (code) => {
  if (code?.includes('ERR')) return 'negative';
  if (code?.includes('WARN')) return 'warning';
  return 'info';
};

// Watchers
watch(show, (newVal) => {
  if (newVal) {
    checkConnection();
    results.value = null;
    error.value = '';
    selectedAlarmIds.value = [];
    showManualSearch.value = false;
  }
});

// Lifecycle
onMounted(() => {
  checkConnection();
});
</script>

<style scoped>
.rounded-borders {
  border-radius: 8px;
}
</style>
