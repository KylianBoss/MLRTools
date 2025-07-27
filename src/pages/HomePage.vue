<template>
  <q-page>
    <div v-if="App.isBot">
      <q-card class="q-ma-md bg-blue-1">
        <q-card-section>
          <div class="row items-start q-gutter-md">
            <div class="q-pa-sm rounded-borders">
              <q-icon name="mdi-alert" size="md" color="blue-6" />
            </div>
            <div class="col">
              <h5 class="q-mt-none q-mb-sm">Bienvenue sur MLR Tools</h5>
              <p class="text-dark q-mb-md">
                Cette instance de l'application tourne en mode automatique pour la récupération des données.<br />
                Vous n'avez aucune interaction possible depuis cette instance et ce compte.
              </p>
            </div>
          </div>
        </q-card-section>
        <q-card-section v-if="App.cronJobsInitialized">
          <div class="row items-start q-gutter-md">
            <div class="q-pa-sm rounded-borders">
              <q-icon name="mdi-check" size="md" color="green-6" />
            </div>
            <div class="col">
              <h5 class="q-mt-none q-mb-sm">Cron Jobs Initialisés</h5>
              <p class="text-dark q-mb-md">
                Les tâches planifiées pour la récupération des données sont en cours d'exécution.
              </p>

              <ul>
                <li v-for="job in cronJobs" :key="job.name">
                  <strong>{{ job.jobName }}</strong>
                  <q-chip
                    :color="job.actualState === 'running' ? 'green' : job.actualState === 'error' ? 'red' : 'grey'"
                    text-color="white"
                    class="q-mb-sm"
                  >
                    {{ job.actualState }}
                  </q-chip>
                  <q-btn
                    v-if="job.actualState !== 'running'"
                    color="primary"
                    icon="mdi-play"
                    @click="startCron(job.action)"
                    class="q-mr-sm q-py-none"
                    dense
                    round
                    flat
                  />
                  <br />
                  Dernière execution: {{ job.lastRun ? new Date(job.lastRun).toLocaleString() : 'N/A' }}<br />
                  Dernier log: {{ job.lastLog ? job.lastLog : 'Aucun log disponible' }}<br />
                </li>
              </ul>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
    <div v-else>
      <q-card class="q-ma-md bg-blue-1">
        <q-card-section>
          <div class="row items-start q-gutter-md">
            <div class="q-pa-sm rounded-borders">
              <q-icon name="info" size="md" color="blue-6" />
            </div>
            <div class="col">
              <h5 class="q-mt-none q-mb-sm">Bienvenue sur MLR Tools</h5>
              <p class="text-dark q-mb-md">
                Cette application vous permet de suivre et d'analyser les données
                de production.<br />
                Utilisez le menu latéral pour accéder aux
                différentes fonctionnalités.
              </p>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-ma-md bg-yellow-1">
        <q-card-section>
          <div class="row items-start q-gutter-md">
            <div class="q-pa-sm rounded-borders">
              <q-icon name="warning" size="md" color="yellow-6" />
            </div>
            <div class="col">
              <h5 class="q-mt-none q-mb-sm">Plus de prise en compte de certaines alarmes</h5>
              <p class="text-dark q-mb-md">
                Les alarmes suivantes ne sont plus prises en compte dans le calcul et ne sont plus enregistrées dans la base de données :
                <ul>
                  <li>Warning | M6009.0306 | Shuttle X - Level X ~ Élévateur de shuttles en WarmUp</li>
                  <li>Warning | M6130.0201 | TLXX - Impossible de démarrer le WarmUp</li>
                  <li>Warning | M6130.0202 | TLXX - WarmUp actif</li>
                  <li>Warning | M6130.0203 | TLXX - Données cinématiques de WarmUp activées</li>
                </ul>
              </p>
            </div>
          </div>
        </q-card-section>
        <q-card-section>
          <div class="row">
            <div class="col text-right text-grey-8 text-italic">
              Dernière mise à jour 03.03.2025
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { useAppStore } from 'stores/app';
import { api } from 'boot/axios';
import { ref, onMounted } from 'vue';
import { EventSource } from 'eventsource';

const App = useAppStore();

const cronJobs = ref([]);

// Fetch status from an SSE endpoint
const fetchCronStatus = async () => {
  const eventSource = new EventSource('http://localhost:3000/cron/status');
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'cronJobStatus' ) {
      const index = cronJobs.value.findIndex(job => job.action === data.job.action);
      if (index !== -1) {
        cronJobs.value[index] = {
          ...cronJobs.value[index],
          jobName: data.job.jobName,
          actualState: data.job.actualState,
          lastRun: data.job.lastRun ? new Date(data.job.lastRun) : null,
          lastLog: data.job.lastLog || 'Aucun log disponible'
        };
      }
    }
  };
  eventSource.onerror = (error) => {
    console.error('Error fetching cron status:', error);
    eventSource.close();
  };
};

// Start a cron job
const startCron = async (action) => {
  try {
    const response = await api.post('/cron/start', { action });
    const job = response.data;
    const index = cronJobs.value.findIndex(j => j.action === job.action);
    if (index !== -1) {
      cronJobs.value[index] = {
        ...cronJobs.value[index],
        jobName: job.jobName,
        actualState: job.actualState,
        lastRun: job.lastRun ? new Date(job.lastRun) : null,
        lastLog: job.lastLog || 'Aucun log disponible'
      };
    }
  } catch (error) {
    console.error('Error starting cron job:', error);
  }
};


onMounted(async () => {
  try {
    if (App.isBot) {
      const response = await api.get('/cron');
      cronJobs.value = response.data;
      fetchCronStatus();
      await api.post('/bot/active', { userId: App.userId });
      setInterval(async () => {
        await api.post('/bot/active', { userId: App.userId });
      }, 60000); // every minute
    }
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
  }
});
</script>

<style></style>
