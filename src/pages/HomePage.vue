<template>
  <q-page>
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
  </q-page>
</template>

<script setup></script>

<style></style>
