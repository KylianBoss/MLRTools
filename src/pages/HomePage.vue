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
import { useAppStore } from 'src/stores/app';

const App = useAppStore();
</script>

<style></style>
