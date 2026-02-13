<template>
  <q-dialog v-model="show" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <q-avatar icon="smart_toy" color="primary" text-color="white" />
        <span class="q-ml-sm text-h6">Assistant IA</span>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Status Connection -->
        <div class="row items-center q-mb-md q-pa-sm rounded-borders" :class="statusClass">
          <q-icon :name="statusIcon" size="sm" class="q-mr-sm" />
          <span class="text-weight-medium">{{ statusText }}</span>
          <q-space />
          <q-btn
            v-if="needsDownload && !isDownloading"
            flat
            dense
            size="sm"
            label="Télécharger le modèle"
            color="primary"
            @click="downloadModel"
          />
          <q-btn
            v-else
            flat
            dense
            size="sm"
            label="Tester"
            @click="checkConnection"
            :loading="checkingConnection"
          />
        </div>

        <!-- Question Input -->
        <q-input
          v-model="question"
          outlined
          type="textarea"
          rows="3"
          label="Posez votre question"
          hint="Ex: Combien d'erreurs aujourd'hui sur la dépal 3 ?"
          :disable="!aiConnected || loading || isDownloading"
          @keyup.ctrl.enter="askQuestion"
        >
          <template v-slot:append>
            <q-btn
              round
              dense
              flat
              icon="send"
              @click="askQuestion"
              :disable="!question.trim() || !aiConnected || loading"
            />
          </template>
        </q-input>

        <!-- Suggestions -->
        <div v-if="!answer" class="q-mt-sm">
          <div class="text-caption text-grey-7 q-mb-xs">Suggestions :</div>
          <div class="row q-gutter-xs">
            <q-chip
              v-for="suggestion in suggestions"
              :key="suggestion"
              clickable
              @click="question = suggestion"
              size="sm"
              color="blue-1"
              text-color="primary"
            >
              {{ suggestion }}
            </q-chip>
          </div>
        </div>

        <!-- Answer -->
        <q-card v-if="answer" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle2 text-primary q-mb-sm">
              <q-icon name="psychology" size="sm" class="q-mr-xs" />
              Réponse de l'IA
            </div>
            <div class="text-body2" style="white-space: pre-wrap">{{ answer }}</div>
            
            <!-- Stats (si disponibles) -->
            <div v-if="stats" class="q-mt-md q-pt-md" style="border-top: 1px solid #e0e0e0">
              <div class="text-caption text-grey-7 q-mb-sm">Données analysées :</div>
              <div class="row q-gutter-sm">
                <q-badge color="blue" :label="`${stats.total} alarmes`" />
                <q-badge 
                  v-if="stats.period"
                  outline 
                  color="grey"
                  :label="`${formatDate(stats.period.start)} - ${formatDate(stats.period.end)}`"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Error -->
        <q-banner v-if="error" class="bg-negative text-white q-mt-md" rounded>
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          {{ error }}
          <template v-slot:action v-if="error.includes('corrompu')">
            <q-btn
              flat
              color="white"
              label="Re-télécharger"
              @click="deleteAndRedownload"
              :loading="isDownloading"
            />
          </template>
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          v-if="answer"
          flat
          label="Nouvelle question"
          @click="resetQuestion"
          color="primary"
        />
        <q-btn flat label="Fermer" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from 'boot/axios';
import { useQuasar } from 'quasar';
import { useAppStore } from 'stores/app';
import dayjs from 'dayjs';

const $q = useQuasar();
const App = useAppStore();

// Props
const show = defineModel({ type: Boolean, default: false });

// Data
const question = ref('');
const answer = ref('');
const stats = ref(null);
const error = ref('');
const loading = ref(false);
const aiConnected = ref(false);
const checkingConnection = ref(false);
const aiModels = ref([]);
const needsDownload = ref(false);
const isDownloading = ref(false);
const downloadProgress = ref(0);

const suggestions = [
  "Combien d'erreurs aujourd'hui ?",
  "Quelle zone a le plus de problèmes ?",
  "Alarmes les plus fréquentes cette semaine ?",
  "Résumé des problèmes d'hier",
];

// Computed
const statusClass = computed(() => {
  if (checkingConnection.value) return 'bg-grey-3';
  return aiConnected.value ? 'bg-positive-1' : 'bg-negative-1';
});

const statusIcon = computed(() => {
  if (checkingConnection.value) return 'hourglass_empty';
  return aiConnected.value ? 'check_circle' : 'error';
});

const statusText = computed(() => {
  if (checkingConnection.value) return 'Vérification...';
  if (isDownloading.value) return `Téléchargement du modèle: ${downloadProgress.value}%`;
  if (needsDownload.value) return 'Modèle non téléchargé - Cliquer sur "Télécharger le modèle"';
  if (aiConnected.value) {
    return 'Modèle LLM prêt';
  }
  return 'Modèle non initialisé';
});

const formatDate = (dateStr) => {
  return dayjs(dateStr).format('DD/MM HH:mm');
};

// Methods
const checkConnection = async () => {
  checkingConnection.value = true;
  error.value = '';
  
  try {
    const response = await api.get('/ai/status');
    const status = response.data;
    
    aiConnected.value = status.isInitialized;
    needsDownload.value = !status.modelExists;
    isDownloading.value = status.isDownloading;
    downloadProgress.value = status.downloadProgress || 0;
    
    if (!status.modelExists) {
      error.value = 'Le modèle IA doit être téléchargé (Admin uniquement)';
    } else if (!status.isInitialized) {
      // Try to initialize
      try {
        const initResponse = await api.post('/ai/initialize');
        if (initResponse.data.success) {
          aiConnected.value = true;
        } else {
          error.value = `Échec d'initialisation: ${initResponse.data.error}`;
          aiConnected.value = false;
        }
      } catch (initError) {
        console.error('AI initialization failed:', initError);
        error.value = 'Le modèle pourrait être corrompu. Essayez de le re-télécharger.';
        aiConnected.value = false;
      }
    }
  } catch (err) {
    aiConnected.value = false;
    if (err.response?.status === 403) {
      error.value = 'Accès réservé aux administrateurs';
    } else {
      error.value = 'Erreur lors de la vérification : ' + err.message;
    }
  } finally {
    checkingConnection.value = false;
  }
};

const downloadModel = async () => {
  if (isDownloading.value) return;
  
  try {
    error.value = '';
    isDownloading.value = true;
    downloadProgress.value = 0;
    
    // Notification persistante avec progression
    const notif = $q.notify({
      group: false,
      type: 'ongoing',
      message: 'Téléchargement du modèle IA',
      caption: 'Initialisation...',
      icon: 'cloud_download',
      spinner: true,
      timeout: 0,
      position: 'bottom-right',
      actions: [
        {
          label: 'Masquer',
          color: 'white',
          handler: () => {}
        }
      ]
    });
    
    // SSE pour la progression (passer username en query)
    const username = App.user?.username || '';
    const eventSource = new EventSource(`http://localhost:3000/ai/download-model?username=${encodeURIComponent(username)}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.error) {
        error.value = data.error;
        eventSource.close();
        isDownloading.value = false;
        
        notif({
          type: 'negative',
          message: 'Échec du téléchargement',
          caption: data.error,
          icon: 'error',
          timeout: 5000
        });
        return;
      }
      
      if (data.progress) {
        downloadProgress.value = data.progress;
        
        // Mettre à jour la notification
        notif({
          type: 'ongoing',
          message: 'Téléchargement du modèle IA',
          caption: `${data.progress}% - ${data.downloadedMB || 0} MB / ${data.totalMB || '4700'} MB`,
          icon: 'cloud_download',
          spinner: true,
          timeout: 0
        });
      }
      
      if (data.done) {
        eventSource.close();
        isDownloading.value = false;
        downloadProgress.value = 100;
        needsDownload.value = false;
        
        notif({
          type: 'positive',
          message: 'Modèle téléchargé avec succès !',
          caption: 'Initialisation en cours...',
          icon: 'check_circle',
          timeout: 3000
        });
        
        // Initialiser après téléchargement
        setTimeout(() => {
          checkConnection();
        }, 2000);
      }
    };
    
    eventSource.onerror = () => {
      eventSource.close();
      isDownloading.value = false;
      error.value = 'Erreur lors du téléchargement';
      
      notif({
        type: 'negative',
        message: 'Erreur de connexion',
        caption: 'Le téléchargement a été interrompu',
        icon: 'error',
        timeout: 5000
      });
    };
    
  } catch (err) {
    isDownloading.value = false;
    error.value = 'Erreur : ' + err.message;
    
    $q.notify({
      type: 'negative',
      message: 'Erreur',
      caption: err.message,
      timeout: 5000,
      position: 'bottom-right'
    });
  }
};

const deleteAndRedownload = async () => {
  try {
    // Confirm deletion
    $q.dialog({
      title: 'Re-télécharger le modèle',
      message: 'Le modèle actuel sera supprimé et re-téléchargé (~4.7 GB). Continuer ?',
      cancel: true,
      persistent: true
    }).onOk(async () => {
      try {
        // Delete current model
        await api.delete('/ai/delete-model');
        
        $q.notify({
          type: 'info',
          message: 'Modèle supprimé',
          caption: 'Début du téléchargement...',
          timeout: 2000
        });
        
        // Clear error and start download
        error.value = '';
        needsDownload.value = true;
        aiConnected.value = false;
        
        // Start download
        await downloadModel();
      } catch (err) {
        $q.notify({
          type: 'negative',
          message: 'Erreur',
          caption: err.message,
          timeout: 5000
        });
      }
    });
  } catch (err) {
    console.error('Delete and redownload error:', err);
  }
};

const askQuestion = async () => {
  if (!question.value.trim() || !aiConnected.value) return;
  
  loading.value = true;
  error.value = '';
  answer.value = '';
  stats.value = null;
  
  try {
    const response = await api.post('/ai/ask', {
      question: question.value,
      dateRange: {
        start: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        end: dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
      }
    });
    
    if (response.data.success) {
      answer.value = response.data.answer;
      stats.value = response.data.stats;
    } else {
      error.value = response.data.error || 'Erreur inconnue';
    }
  } catch (err) {
    error.value = 'Erreur lors de la requête : ' + err.message;
  } finally {
    loading.value = false;
  }
};

const resetQuestion = () => {
  question.value = '';
  answer.value = '';
  stats.value = null;
  error.value = '';
};

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
