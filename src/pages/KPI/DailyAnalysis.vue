<template>
  <q-page padding>
    <div class="q-mb-md row items-center q-gutter-md">
      <div>
        <div class="text-h4 q-mb-sm">Analyse des alarmes quotidiennes</div>
        <div class="text-subtitle2 text-grey-7">
          Analyser et classifier les alarmes primaires du {{ selectedDate }}
        </div>
      </div>
      <q-input
        v-model="selectedDate"
        mask="##.##.####"
        dense
        outlined
        label="Date"
        style="width: 140px"
      >
        <template v-slot:append>
          <q-icon name="event" class="cursor-pointer">
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-date
                v-model="selectedDate"
                mask="DD.MM.YYYY"
                :options="(d) => d <= dayjs().format('YYYY/MM/DD')"
              >
                <div class="row items-center justify-end">
                  <q-btn v-close-popup label="Fermer" color="primary" flat />
                </div>
              </q-date>
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Statistics Cards -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Total alarmes</div>
            <div class="text-h5">{{ alarms.length }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Traitées</div>
            <div class="text-h5 text-positive">{{ treatedCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">Groupées</div>
            <div class="text-h5 text-info">{{ groupedCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-sm-6 col-md-3">
        <q-card>
          <q-card-section>
            <div class="text-caption text-grey-7">En attente</div>
            <div class="text-h5 text-warning">{{ pendingCount }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-auto">
        <q-input
          v-model="searchText"
          outlined
          dense
          placeholder="Rechercher..."
          clearable
          style="min-width: 250px"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-btn
          color="primary"
          label="Grouper la sélection"
          icon="link"
          :disable="
            selectedAlarms.length < 2 || !App.userHasAccess('canGroupAlarms')
          "
          @click="groupSelectedAlarms"
        />
      </div>
      <div class="col-auto">
        <q-btn
          color="secondary"
          label="Traitement auto"
          icon="auto_awesome"
          :disable="!App.userHasAccess('canGroupAlarms')"
          @click="openAutoGroupDialog"
        />
      </div>
      <div class="col-auto" v-if="App.userHasAccess('canManageAutoGroupRules')">
        <q-btn
          flat
          color="secondary"
          icon="rule"
          @click="rulesDialog = true"
        >
          <q-tooltip>Gérer les règles de traitement automatique</q-tooltip>
        </q-btn>
      </div>
      <div class="col-auto">
        <q-btn
          color="positive"
          label="Marquer comme traité"
          icon="check"
          :disable="
            selectedAlarms.length === 0 ||
            !App.userHasAccess('canMarkAsTreated')
          "
          @click="markAsTreated"
        />
      </div>
      <div class="col-auto">
        <q-btn
          flat
          color="grey-7"
          label="Actualiser"
          icon="refresh"
          @click="loadAlarms"
        />
      </div>
      <div class="col-auto" v-if="isYesterday">
        <q-btn
          :color="dailyDone ? 'positive' : 'orange'"
          :label="dailyDone ? 'Journée traitée' : 'Marquer journée traitée'"
          :icon="dailyDone ? 'check_circle' : 'done_all'"
          :outline="dailyDone"
          :disable="dailyDone"
          @click="markDailyDone"
          :loading="dailyDoneLoading"
        >
          <q-tooltip v-if="dailyDone">
            L'analyse du {{ selectedDate }} a déjà été marquée comme traitée — le cron automatique ne s'exécutera pas.
          </q-tooltip>
          <q-tooltip v-else>
            Marquer l'analyse du {{ selectedDate }} comme traitée manuellement — le cron automatique de ce matin sera ignoré.
          </q-tooltip>
        </q-btn>
      </div>
      <div class="col"></div>
      <div class="col-auto">
        <q-btn-toggle
          v-model="viewMode"
          toggle-color="primary"
          :options="[
            { label: 'Tableau', value: 'table', icon: 'table_chart' },
            { label: 'Groupes', value: 'groups', icon: 'workspaces' },
          ]"
        />
      </div>
      <div class="col-auto">
        <q-toggle
          v-model="showGrouped"
          label="Afficher groupées"
          color="info"
          v-if="viewMode === 'table'"
        />
      </div>
      <div class="col-auto">
        <q-toggle
          v-model="showTreated"
          label="Afficher traitées"
          color="positive"
          v-if="viewMode === 'table'"
        />
      </div>
    </div>

    <!-- Group View -->
    <AlarmGroupView
      v-if="viewMode === 'groups'"
      :alarms="alarms"
      @edit-comment="editComment"
      @ungroup="ungroupAlarm"
      @view-details="viewDetails"
    />

    <!-- Alarms Table -->
    <q-table
      v-if="viewMode === 'table'"
      :rows="filteredAlarms"
      :columns="columns"
      row-key="dbId"
      selection="multiple"
      v-model:selected="selectedAlarms"
      :loading="loading"
      flat
      bordered
      :rows-per-page-options="[10, 25, 50, 100]"
      v-model:pagination="pagination"
      virtual-scroll
    >
      <!-- Group Badge -->
      <template v-slot:body-cell-x_group="props">
        <q-td :props="props">
          <q-badge v-if="props.row.x_group" color="info">
            Groupe {{ props.row.x_group }}
          </q-badge>
          <q-btn
            v-if="props.row.x_group"
            flat
            dense
            round
            size="xs"
            icon="link_off"
            color="grey"
            @click="ungroupAlarm(props.row.dbId)"
          >
            <q-tooltip>Dégrouper</q-tooltip>
          </q-btn>
        </q-td>
      </template>

      <!-- Time of Occurrence -->
      <template v-slot:body-cell-timeOfOccurence="props">
        <q-td :props="props">
          {{ formatDate(props.row.timeOfOccurence) }}
        </q-td>
      </template>

      <!-- Time of Acknowledge -->
      <template v-slot:body-cell-timeOfAcknowledge="props">
        <q-td :props="props">
          {{ formatDate(props.row.timeOfAcknowledge) }}
        </q-td>
      </template>

      <!-- Duration -->
      <template v-slot:body-cell-duration="props">
        <q-td :props="props">
          {{ formatDuration(props.row.duration) }}
        </q-td>
      </template>

      <!-- State Toggle -->
      <template v-slot:body-cell-x_state="props">
        <q-td :props="props">
          <q-toggle
            :model-value="props.row.x_state === 'planned'"
            @update:model-value="
              (val) =>
                updateState(props.row.dbId, val ? 'planned' : 'unplanned')
            "
            :color="props.row.x_state === 'planned' ? 'orange' : 'red'"
            checked-icon="event"
            unchecked-icon="warning"
          >
            <q-tooltip>
              {{
                props.row.x_state === "planned" ? "Planifié" : "Non planifié"
              }}
            </q-tooltip>
          </q-toggle>
        </q-td>
      </template>

      <!-- Treated Status -->
      <template v-slot:body-cell-x_treated="props">
        <q-td :props="props">
          <q-icon
            v-if="props.row.x_treated"
            name="check_circle"
            color="positive"
            size="sm"
          />
          <q-icon
            v-else
            name="radio_button_unchecked"
            color="grey-5"
            size="sm"
          />
        </q-td>
      </template>

      <!-- Comment -->
      <template v-slot:body-cell-x_comment="props">
        <q-td :props="props">
          <div class="row items-center no-wrap">
            <div class="col ellipsis" style="max-width: 200px">
              {{ props.row.x_comment || "-" }}
            </div>
            <div class="col-auto">
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="edit"
                color="grey-7"
                @click="editComment(props.row)"
                :disable="!App.userHasAccess('canUpdateComment')"
              >
                <q-tooltip>Modifier le commentaire</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-td>
      </template>

      <!-- Actions -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat dense round size="sm" icon="more_vert" color="grey-7">
            <q-menu>
              <q-list style="min-width: 200px">
                <q-item
                  clickable
                  v-close-popup
                  @click="editComment(props.row)"
                  :disable="!App.userHasAccess('canUpdateComment')"
                >
                  <q-item-section avatar>
                    <q-icon name="comment" />
                  </q-item-section>
                  <q-item-section>Modifier le commentaire</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="markSingleAsTreated(props.row.dbId)"
                  :disable="!App.userHasAccess('canMarkAsTreated')"
                >
                  <q-item-section avatar>
                    <q-icon name="check" />
                  </q-item-section>
                  <q-item-section>Marquer comme traité</q-item-section>
                </q-item>
                <q-separator />
                <q-item-label header>Classification</q-item-label>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'primary')"
                  :disable="!App.userHasAccess('canClassifyAlarms')"
                >
                  <q-item-section avatar>
                    <q-icon name="error" color="red" />
                  </q-item-section>
                  <q-item-section>Arrêt (Primary)</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'secondary')"
                >
                  <q-item-section avatar>
                    <q-icon name="info" color="blue" />
                  </q-item-section>
                  <q-item-section>Info (Secondary)</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'human')"
                >
                  <q-item-section avatar>
                    <q-icon name="person" color="primary" />
                  </q-item-section>
                  <q-item-section>Humain</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="classifyAlarm(props.row.alarmId, 'other')"
                >
                  <q-item-section avatar>
                    <q-icon name="label" color="grey" />
                  </q-item-section>
                  <q-item-section>Autre</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="viewDetails(props.row)">
                  <q-item-section avatar>
                    <q-icon name="info" />
                  </q-item-section>
                  <q-item-section>Voir les détails</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Comment Dialog -->
    <q-dialog v-model="commentDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Modifier le commentaire</div>
          <div class="text-caption text-grey-7">
            {{ currentAlarm?.alarmText }}
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="commentText"
            type="textarea"
            label="Commentaire"
            rows="4"
            outlined
            autofocus
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" v-close-popup />
          <q-btn label="Enregistrer" color="primary" @click="saveComment" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Details Dialog -->
    <q-dialog v-model="detailsDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Détails de l'alarme</div>
        </q-card-section>

        <q-card-section v-if="currentAlarm">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label caption>ID Base de données</q-item-label>
                <q-item-label>{{ currentAlarm.dbId }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>ID Alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmId }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Heure de début</q-item-label>
                <q-item-label>{{
                  formatDate(currentAlarm.timeOfOccurence)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Heure de fin</q-item-label>
                <q-item-label>{{
                  formatDate(currentAlarm.timeOfAcknowledge)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Durée</q-item-label>
                <q-item-label>{{
                  formatDuration(currentAlarm.duration)
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Source de données</q-item-label>
                <q-item-label>{{ currentAlarm.dataSource }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Zone d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmArea }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Code d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmCode }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Texte d'alarme</q-item-label>
                <q-item-label>{{ currentAlarm.alarmText }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Sévérité</q-item-label>
                <q-item-label>{{ currentAlarm.severity }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>État</q-item-label>
                <q-item-label>
                  <q-badge
                    :color="
                      currentAlarm.x_state === 'planned' ? 'orange' : 'red'
                    "
                  >
                    {{
                      currentAlarm.x_state === "planned"
                        ? "Planifié"
                        : "Non planifié"
                    }}
                  </q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Utilisateur assigné</q-item-label>
                <q-item-label>{{
                  currentAlarm.assignedUser || "Non assigné"
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="currentAlarm.x_group">
              <q-item-section>
                <q-item-label caption>Groupe</q-item-label>
                <q-item-label>
                  <q-badge color="info"
                    >Groupe {{ currentAlarm.x_group }}</q-badge
                  >
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="currentAlarm.x_comment">
              <q-item-section>
                <q-item-label caption>Commentaire</q-item-label>
                <q-item-label>{{ currentAlarm.x_comment }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Intervention Validation Dialog -->
    <q-dialog
      v-model="validationDialog"
      persistent
      transition-show="scale"
      transition-hide="scale"
    >
      <q-card style="min-width: 700px; max-width: 900px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            Validation des interventions
            <q-badge color="primary" :label="pendingInterventions.length" />
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="currentIntervention">
          <div class="q-mb-md">
            <div class="text-subtitle1 text-weight-bold">
              <q-badge
                v-if="currentIntervention.alarmCode"
                color="primary"
                :label="currentIntervention.alarmCode"
                class="q-mr-sm"
              />
              {{ currentIntervention.description }}
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              <q-icon name="schedule" size="xs" />
              {{ currentIntervention.startTime }} -
              {{ currentIntervention.endTime }}
            </div>
            <div
              v-if="currentIntervention.comment"
              class="q-mt-sm q-pa-sm bg-blue-1 rounded-borders"
            >
              {{ currentIntervention.comment }}
            </div>
          </div>

          <!-- Search Button -->
          <div class="q-mb-md">
            <q-btn
              color="primary"
              label="Rechercher les alarmes correspondantes"
              icon="search"
              @click="findMatchingAlarms"
              :loading="searchingAlarms"
            />
          </div>

          <!-- Matching Alarms List -->
          <div v-if="matchingAlarms.length > 0">
            <div class="text-subtitle2 q-mb-sm">
              Alarmes trouvées ({{ matchingAlarms.length }})
            </div>
            <q-list bordered separator>
              <q-item
                v-for="alarm in matchingAlarms"
                :key="alarm.dbId"
                clickable
                @click="toggleAlarmSelection(alarm)"
              >
                <q-item-section side>
                  <q-checkbox
                    :model-value="selectedMatchingAlarms.includes(alarm.dbId)"
                    @update:model-value="toggleAlarmSelection(alarm)"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ alarm.alarmCode }} - {{ alarm.alarmText }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ formatDate(alarm.timeOfOccurence) }} | Zone:
                    {{ alarm.dataSource }} - {{ alarm.alarmArea }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Validation Comment -->
            <div class="q-mt-md">
              <q-input
                v-model="validationComment"
                label="Commentaire de validation"
                outlined
                type="textarea"
                rows="3"
                hint="Ce commentaire sera ajouté aux alarmes groupées"
              />
            </div>

            <!-- Planned Toggle -->
            <div class="q-mt-md">
              <q-toggle
                v-model="validationIsPlanned"
                label="Intervention planifiée (maintenance)"
                color="primary"
              />
            </div>
          </div>

          <div v-else-if="searchPerformed" class="text-center q-pa-md">
            <q-icon name="search_off" size="48px" color="grey-5" />
            <div class="text-grey-7 q-mt-sm">Aucune alarme trouvée</div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            label="Ignorer"
            color="grey-7"
            @click="ignoreIntervention"
            :loading="validationLoading"
          />
          <q-btn
            flat
            label="Passer"
            color="orange"
            @click="skipIntervention"
            v-if="pendingInterventions.length > 1"
            :loading="validationLoading"
          />
          <q-btn
            label="Valider"
            color="positive"
            icon="check"
            @click="validateIntervention"
            :loading="validationLoading"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <!-- Auto Treatment Dialog -->
    <q-dialog
      v-model="autoGroupDialog"
      persistent
      transition-show="scale"
      transition-hide="scale"
    >
      <q-card style="min-width: 700px; max-width: 900px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            Traitement automatique
            <q-badge color="primary" class="q-ml-sm">
              {{ currentAutoGroupIndex + 1 }} /
              {{ autoGroupProposals.length }}
            </q-badge>
            <q-badge
              v-if="currentAutoGroup"
              :color="currentAutoGroup.type === 'treat' ? 'positive' : currentAutoGroup.fromRule ? 'deep-purple' : 'blue-grey'"
              class="q-ml-xs"
            >
              {{ currentAutoGroup.type === "treat" ? "Règle — Traiter" : currentAutoGroup.fromRule ? "Règle — Grouper" : "Temporel" }}
            </q-badge>
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <!-- Chargement "Valider tout" -->
        <q-card-section v-if="autoGroupValidatingAll" class="column items-center q-py-xl">
          <q-spinner-dots color="deep-purple" size="60px" />
          <div class="text-subtitle1 q-mt-md text-grey-7">Traitement en cours...</div>
        </q-card-section>

        <!-- Proposition de type "traiter" -->
        <q-card-section v-else-if="currentAutoGroup && currentAutoGroup.type === 'treat'">
          <div class="q-mb-md">
            <div class="text-subtitle1 text-weight-bold">
              <q-icon name="check_circle" color="positive" class="q-mr-xs" />
              {{ currentAutoGroup.ruleName }}
            </div>
            <div class="text-caption text-grey-7">
              {{ currentAutoGroup.alarms.length }} alarme(s) à marquer comme traitée(s)
            </div>
          </div>

          <q-list bordered separator>
            <q-item
              v-for="alarm in currentAutoGroup.alarms"
              :key="alarm.dbId"
              clickable
              @click="toggleAutoGroupAlarm(alarm.dbId)"
            >
              <q-item-section side>
                <q-checkbox
                  :model-value="selectedAutoGroupAlarms.includes(alarm.dbId)"
                  @update:model-value="toggleAutoGroupAlarm(alarm.dbId)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ alarm.alarmCode }} - {{ alarm.alarmText }}
                </q-item-label>
                <q-item-label caption>
                  <q-icon name="schedule" size="xs" />
                  {{ formatDate(alarm.timeOfOccurence) }} →
                  {{ formatDate(alarm.timeOfAcknowledge) }}
                  | Durée: {{ formatDuration(alarm.duration) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="q-mt-md">
            <q-input
              v-model="autoGroupComment"
              label="Commentaire (optionnel)"
              outlined
              type="textarea"
              rows="2"
            />
          </div>
        </q-card-section>

        <!-- Proposition de type "grouper" -->
        <q-card-section v-else-if="currentAutoGroup && currentAutoGroup.type === 'group'">
          <div class="q-mb-md">
            <div class="text-subtitle1 text-weight-bold">
              <q-icon
                :name="currentAutoGroup.fromRule ? 'rule' : 'schedule'"
                :color="currentAutoGroup.fromRule ? 'deep-purple' : 'blue-grey'"
                class="q-mr-xs"
              />
              {{ currentAutoGroup.location }}
            </div>
            <div class="text-caption text-grey-7">
              {{ currentAutoGroup.alarms.length }} alarmes —
              {{ currentAutoGroup.fromRule ? "déclenchées par une règle" : "détectées par proximité temporelle (5 min)" }}
            </div>
          </div>

          <q-list bordered separator>
            <q-item
              v-for="alarm in currentAutoGroup.alarms"
              :key="alarm.dbId"
              clickable
              @click="toggleAutoGroupAlarm(alarm.dbId)"
            >
              <q-item-section side>
                <q-checkbox
                  :model-value="selectedAutoGroupAlarms.includes(alarm.dbId)"
                  @update:model-value="toggleAutoGroupAlarm(alarm.dbId)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ alarm.alarmCode }} - {{ alarm.alarmText }}
                </q-item-label>
                <q-item-label caption>
                  <q-icon name="schedule" size="xs" />
                  {{ formatDate(alarm.timeOfOccurence) }} →
                  {{ formatDate(alarm.timeOfAcknowledge) }}
                  | Durée: {{ formatDuration(alarm.duration) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="q-mt-md">
            <q-input
              v-model="autoGroupComment"
              label="Commentaire"
              outlined
              type="textarea"
              rows="2"
              hint="Ce commentaire sera ajouté à toutes les alarmes du groupe"
            />
          </div>

          <div class="q-mt-md">
            <q-toggle
              v-model="autoGroupIsPlanned"
              label="Planifié (maintenance)"
              color="primary"
            />
          </div>
        </q-card-section>

        <q-card-actions v-if="!autoGroupValidatingAll" align="right">
          <q-btn
            flat
            label="Passer"
            color="orange"
            @click="skipAutoGroup"
            :loading="autoGroupLoading"
            v-if="currentAutoGroupIndex < autoGroupProposals.length - 1"
          />
          <q-btn
            flat
            label="Valider tout"
            color="deep-purple"
            icon="done_all"
            @click="validateAllAutoGroups"
            :loading="autoGroupLoading"
            v-if="autoGroupProposals.length > 1"
          />
          <q-btn
            v-if="currentAutoGroup && currentAutoGroup.type === 'treat'"
            label="Valider"
            color="positive"
            icon="check"
            @click="validateAutoGroup"
            :loading="autoGroupLoading"
            :disable="selectedAutoGroupAlarms.length === 0"
          />
          <q-btn
            v-else
            label="Valider"
            color="positive"
            icon="check"
            @click="validateAutoGroup"
            :loading="autoGroupLoading"
            :disable="selectedAutoGroupAlarms.length < 2"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Rules Dialog -->
    <q-dialog v-model="rulesDialog" persistent transition-show="scale" transition-hide="scale">
      <q-card style="min-width: 800px; max-width: 1000px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Règles de traitement automatique</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="autoGroupRules"
            :columns="rulesColumns"
            row-key="id"
            flat
            dense
            :pagination="{ rowsPerPage: 10 }"
          >
            <template v-slot:top-right>
              <q-btn
                color="primary"
                icon="add"
                label="Ajouter"
                size="sm"
                @click="openRuleForm()"
              />
            </template>

            <template v-slot:body-cell-alarmCodePattern="props">
              <q-td :props="props">
                <q-badge v-if="props.row.alarmCodePattern" color="orange-8">
                  {{ props.row.alarmCodePattern }}
                </q-badge>
                <span v-else class="text-grey-5">—</span>
              </q-td>
            </template>

            <template v-slot:body-cell-dataSourceFilter="props">
              <q-td :props="props">
                <q-badge v-if="props.row.dataSourceFilter" color="teal">
                  {{ props.row.dataSourceFilter }}
                </q-badge>
                <span v-else class="text-grey-5">—</span>
              </q-td>
            </template>

            <template v-slot:body-cell-action="props">
              <q-td :props="props">
                <q-badge :color="props.row.action === 'treat' ? 'positive' : 'primary'">
                  {{ props.row.action === "treat" ? "Traiter" : "Grouper" }}
                </q-badge>
              </q-td>
            </template>

            <template v-slot:body-cell-groupBy="props">
              <q-td :props="props">
                <span v-if="props.row.action !== 'treat'">
                  <q-badge :color="props.row.groupBy === 'zone' ? 'deep-purple' : 'blue-grey'">
                    {{ props.row.groupBy === "zone" ? "Zone" : "Emplacement" }}
                  </q-badge>
                </span>
                <span v-else class="text-grey-5">—</span>
              </q-td>
            </template>

            <template v-slot:body-cell-zone="props">
              <q-td :props="props">
                <span v-if="props.row.zone">
                  {{ props.row.zone.join(", ") }}
                </span>
                <span v-else class="text-grey-5">—</span>
              </q-td>
            </template>

            <template v-slot:body-cell-enabled="props">
              <q-td :props="props">
                <q-toggle
                  :model-value="props.row.enabled"
                  @update:model-value="toggleRuleEnabled(props.row)"
                  color="positive"
                  dense
                />
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn flat round dense icon="edit" size="sm" color="grey-7" @click="openRuleForm(props.row)">
                  <q-tooltip>Modifier</q-tooltip>
                </q-btn>
                <q-btn flat round dense icon="content_copy" size="sm" color="grey-7" @click="copyRule(props.row)">
                  <q-tooltip>Dupliquer</q-tooltip>
                </q-btn>
                <q-btn flat round dense icon="delete" size="sm" color="negative" @click="deleteRule(props.row)">
                  <q-tooltip>Supprimer</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Rule Form Dialog -->
    <q-dialog v-model="ruleFormDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ editingRule?.id ? "Modifier la règle" : "Nouvelle règle" }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-model="ruleForm.name" label="Nom" outlined dense />
          <q-input v-model="ruleForm.keyword" label="Mot-clé dans alarmText (optionnel)" outlined dense hint="Insensible à la casse" />
          <q-input v-model="ruleForm.alarmCodePattern" label="Regex alarmArea (optionnel)" outlined dense hint="ex: 14[0-9][0-9], 2000|14[0-9][0-9] — \d est converti automatiquement en [0-9]" :rules="[v => !v || isValidRegex(v) || 'Regex invalide']" />
          <q-input v-model="ruleForm.dataSourceFilter" label="Source de données (optionnel)" outlined dense hint="ex: X001 — laisser vide pour toutes les sources" />
          <q-select
            v-model="ruleForm.action"
            :options="[{ label: 'Grouper les alarmes', value: 'group' }, { label: 'Marquer comme traité', value: 'treat' }]"
            label="Action"
            outlined
            dense
            emit-value
            map-options
          />
          <q-input v-model="ruleForm.comment" label="Commentaire appliqué" outlined dense :hint="ruleForm.action === 'treat' ? 'Optionnel' : 'Obligatoire'" />
          <template v-if="ruleForm.action === 'group'">
            <q-select
              v-model="ruleForm.groupBy"
              :options="[{ label: 'Emplacement (dataSource + alarmArea)', value: 'location' }, { label: 'Zone (liste de dataSources)', value: 'zone' }]"
              label="Groupement par"
              outlined
              dense
              emit-value
              map-options
            />
            <q-input
              v-if="ruleForm.groupBy === 'zone'"
              v-model="ruleFormZoneText"
              label="dataSources (séparées par des virgules)"
              outlined
              dense
              hint="Ex: F004, F005, F006"
            />
          </template>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Annuler" color="grey-7" v-close-popup />
          <q-btn flat label="Tester" icon="science" color="primary" @click="testRuleRegex" :loading="testRegexLoading" :disable="!ruleForm.alarmCodePattern && !ruleForm.keyword && !ruleForm.dataSourceFilter" />
          <q-btn label="Enregistrer" color="primary" @click="saveRule" :loading="ruleFormLoading" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Test Regex Dialog -->
    <q-dialog v-model="testRegexDialog">
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            Résultats du test
            <q-badge color="primary" class="q-ml-sm">{{ testRegexResults.length }}</q-badge>
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-sm">
            Alarmes de la table Alarms correspondant aux critères actuels
          </div>
          <div v-if="testRegexResults.length === 0" class="text-center q-pa-lg">
            <q-icon name="search_off" size="48px" color="grey-5" />
            <div class="text-grey-7 q-mt-sm">Aucune alarme trouvée</div>
          </div>
          <q-list v-else bordered separator dense style="max-height: 400px; overflow-y: auto">
            <q-item v-for="alarm in testRegexResults" :key="alarm.alarmId">
              <q-item-section>
                <q-item-label>
                  <q-badge color="orange-8" class="q-mr-sm">{{ alarm.alarmCode }}</q-badge>
                  {{ alarm.alarmText }}
                </q-item-label>
                <q-item-label caption>
                  {{ alarm.dataSource }} — {{ alarm.alarmArea }}
                  <q-badge v-if="alarm.type" :color="alarm.type === 'primary' ? 'red' : 'blue-grey'" class="q-ml-sm" dense>{{ alarm.type }}</q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Fermer" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { api } from "boot/axios";
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useQuasar } from "quasar";
import dayjs from "dayjs";
import AlarmGroupView from "src/components/alarms/AlarmGroupView.vue";
import { useAppStore } from "stores/app";

const $q = useQuasar();
const App = useAppStore();

const alarms = ref([]);
const selectedAlarms = ref([]);
const loading = ref(false);
const validationLoading = ref(false);
const showGrouped = ref(true);
const showTreated = ref(true);
const viewMode = ref("table");
const commentDialog = ref(false);
const detailsDialog = ref(false);
const currentAlarm = ref(null);
const commentText = ref("");
const searchText = ref("");
const pagination = ref({ page: 1, rowsPerPage: 50 });
const validationDialog = ref(false);
const pendingInterventions = ref([]);
const currentIntervention = ref(null);
const matchingAlarms = ref([]);
const selectedMatchingAlarms = ref([]);
const validationComment = ref("");
const validationIsPlanned = ref(false);
const searchingAlarms = ref(false);
const searchPerformed = ref(false);

// Auto-groupement
const autoGroupDialog = ref(false);
const autoGroupProposals = ref([]);
const currentAutoGroupIndex = ref(0);
const selectedAutoGroupAlarms = ref([]);
const autoGroupComment = ref("");
const autoGroupIsPlanned = ref(false);
const autoGroupLoading = ref(false);
const autoGroupValidatingAll = ref(false);

const selectedDate = ref(dayjs().subtract(1, "day").format("DD.MM.YYYY"));
const selectedDateISO = computed(() =>
  dayjs(selectedDate.value, "DD.MM.YYYY").format("YYYY-MM-DD")
);

const isYesterday = computed(() =>
  selectedDateISO.value === dayjs().subtract(1, "day").format("YYYY-MM-DD")
);

const dailyDone = ref(false);
const dailyDoneLoading = ref(false);

const loadDailyDoneStatus = async () => {
  try {
    const response = await api.get("/alarms/daily-done-status");
    dailyDone.value = response.data.done;
  } catch (error) {
    console.error("Error loading daily done status:", error);
  }
};

const markDailyDone = async () => {
  try {
    dailyDoneLoading.value = true;
    await api.patch("/alarms/mark-daily-done");
    dailyDone.value = true;
    $q.notify({
      type: "positive",
      message: `Journée du ${selectedDate.value} marquée comme traitée`,
      caption: "Le cron automatique de demain matin sera ignoré pour cette date.",
    });
  } catch (error) {
    console.error("Error marking daily done:", error);
    $q.notify({
      type: "negative",
      message: "Échec du marquage de la journée",
      caption: error.message,
    });
  } finally {
    dailyDoneLoading.value = false;
  }
};

const columns = [
  {
    name: "x_group",
    label: "Groupe",
    field: "x_group",
    align: "center",
    sortable: true,
  },
  {
    name: "timeOfOccurence",
    label: "Début",
    field: "timeOfOccurence",
    align: "left",
    sortable: true,
  },
  {
    name: "timeOfAcknowledge",
    label: "Fin",
    field: "timeOfAcknowledge",
    align: "left",
    sortable: true,
  },
  {
    name: "dataSource",
    label: "Source",
    field: "dataSource",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmArea",
    label: "Zone",
    field: "alarmArea",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmCode",
    label: "Code",
    field: "alarmCode",
    align: "center",
    sortable: true,
  },
  {
    name: "alarmText",
    label: "Texte de l'alarme",
    field: "alarmText",
    align: "left",
    sortable: true,
  },
  {
    name: "duration",
    label: "Durée",
    field: "duration",
    align: "right",
    sortable: true,
  },
  {
    name: "severity",
    label: "Sévérité",
    field: "severity",
    align: "center",
    sortable: true,
  },
  {
    name: "x_state",
    label: "État",
    field: "x_state",
    align: "center",
    sortable: true,
  },
  {
    name: "x_treated",
    label: "Traité",
    field: "x_treated",
    align: "center",
    sortable: true,
  },
  {
    name: "x_comment",
    label: "Commentaire",
    field: "x_comment",
    align: "left",
  },
  {
    name: "actions",
    label: "Actions",
    field: "actions",
    align: "center",
  },
];

const filteredAlarms = computed(() => {
  let filtered = alarms.value;

  // Filter by showGrouped
  if (!showGrouped.value) {
    filtered = filtered.filter((alarm) => !alarm.x_group);
  }

  // Filter by showTreated
  if (!showTreated.value) {
    filtered = filtered.filter((alarm) => !alarm.x_treated);
  }

  // Filter by search text
  if (searchText.value && searchText.value.trim() !== "") {
    const search = searchText.value.toLowerCase().trim();
    filtered = filtered.filter((alarm) => {
      return (
        alarm.alarmText?.toLowerCase().includes(search) ||
        alarm.alarmCode?.toLowerCase().includes(search) ||
        alarm.alarmArea?.toLowerCase().includes(search) ||
        alarm.dataSource?.toLowerCase().includes(search) ||
        alarm.severity?.toLowerCase().includes(search) ||
        alarm.x_comment?.toLowerCase().includes(search)
      );
    });
  }

  return filtered;
});

const treatedCount = computed(() => {
  return alarms.value.filter((alarm) => alarm.x_treated).length;
});

const groupedCount = computed(() => {
  return alarms.value.filter((alarm) => alarm.x_group).length;
});

const pendingCount = computed(() => {
  return alarms.value.filter((alarm) => !alarm.x_treated).length;
});

const loadAlarms = async () => {
  loading.value = true;
  try {
    const response = await api.get("/alarms/daily-analysis", {
      params: { date: selectedDateISO.value },
    });
    alarms.value = response.data;
  } catch (error) {
    console.error("Error fetching daily analysis data:", error);
    $q.notify({
      type: "negative",
      message: "Échec du chargement des alarmes",
      caption: error.message,
    });
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  return dayjs(dateString).format("DD.MM.YYYY HH:mm");
};

const formatDuration = (seconds) => {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const updateState = async (dbId, state) => {
  try {
    const response = await api.patch("/alarms/update-state", {
      dbId,
      state,
      updateGroup: true,
    });

    // Update all affected alarms in the UI
    if (response.data.affectedDbIds) {
      response.data.affectedDbIds.forEach((affectedDbId) => {
        const alarm = alarms.value.find((a) => a.dbId === affectedDbId);
        if (alarm) {
          alarm.x_state = state;
        }
      });
    }

    const count = response.data.updatedCount || 1;
    $q.notify({
      type: "positive",
      message:
        count > 1
          ? `${count} alarmes marquées comme ${
              state === "planned" ? "planifiées" : "non planifiées"
            }`
          : `Alarme marquée comme ${
              state === "planned" ? "planifiée" : "non planifiée"
            }`,
    });
  } catch (error) {
    console.error("Error updating state:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la mise à jour de l'état",
      caption: error.message,
    });
  }
};

const markAsTreated = async () => {
  try {
    const dbIds = selectedAlarms.value.map((a) => a.dbId);
    await api.patch("/alarms/mark-treated", {
      dbIds,
    });

    selectedAlarms.value.forEach((selectedAlarm) => {
      const alarm = alarms.value.find((a) => a.dbId === selectedAlarm.dbId);
      if (alarm) {
        alarm.x_treated = true;
      }
    });

    $q.notify({
      type: "positive",
      message: `${dbIds.length} alarme(s) marquée(s) comme traitée(s)`,
    });

    selectedAlarms.value = [];
  } catch (error) {
    console.error("Error marking as treated:", error);
    $q.notify({
      type: "negative",
      message: "Échec du marquage des alarmes comme traitées",
      caption: error.message,
    });
  }
};

const markSingleAsTreated = async (dbId) => {
  try {
    const alarm = alarms.value.find((a) => a.dbId === dbId);
    const groupId = alarm?.x_group;

    // Si l'alarme fait partie d'un groupe, marquer toutes les alarmes du groupe
    let dbIdsToMark = [dbId];
    if (groupId) {
      dbIdsToMark = alarms.value
        .filter((a) => a.x_group === groupId)
        .map((a) => a.dbId);
    }

    await api.patch("/alarms/mark-treated", {
      dbIds: dbIdsToMark,
    });

    // Mettre à jour l'UI
    dbIdsToMark.forEach((id) => {
      const alarmToUpdate = alarms.value.find((a) => a.dbId === id);
      if (alarmToUpdate) {
        alarmToUpdate.x_treated = true;
      }
    });

    $q.notify({
      type: "positive",
      message:
        dbIdsToMark.length > 1
          ? `${dbIdsToMark.length} alarmes du groupe marquées comme traitées`
          : "Alarme marquée comme traitée",
    });
  } catch (error) {
    console.error("Error marking as treated:", error);
    $q.notify({
      type: "negative",
      message: "Échec du marquage de l'alarme comme traitée",
      caption: error.message,
    });
  }
};

const groupSelectedAlarms = async () => {
  if (selectedAlarms.value.length < 2) {
    $q.notify({
      type: "warning",
      message: "Veuillez sélectionner au moins 2 alarmes à grouper",
    });
    return;
  }

  try {
    // Vérifier si certaines alarmes sélectionnées font déjà partie d'un groupe
    const existingGroups = new Set(
      selectedAlarms.value
        .map((a) => a.x_group)
        .filter((g) => g !== null && g !== undefined)
    );

    let targetGroupId = null;
    let dbIds = selectedAlarms.value.map((a) => a.dbId);

    if (existingGroups.size > 0) {
      // Au moins une alarme fait déjà partie d'un groupe
      // Utiliser le premier groupe trouvé comme groupe cible
      targetGroupId = Array.from(existingGroups)[0];

      // Récupérer les infos du groupe existant
      const existingGroupAlarm = alarms.value.find(
        (a) => a.x_group === targetGroupId
      );

      // Si plusieurs groupes existent, ajouter toutes les alarmes de ces groupes
      if (existingGroups.size > 1) {
        const allGroupAlarms = alarms.value.filter((a) =>
          existingGroups.has(a.x_group)
        );
        dbIds = [...new Set([...dbIds, ...allGroupAlarms.map((a) => a.dbId)])];
      }

      // Envoyer la requête avec l'ID du groupe existant
      const response = await api.post("/alarms/group-alarms", {
        dbIds,
        existingGroupId: targetGroupId,
      });

      // Mettre à jour toutes les alarmes concernées avec les propriétés du groupe
      dbIds.forEach((dbId) => {
        const alarm = alarms.value.find((a) => a.dbId === dbId);
        if (alarm) {
          alarm.x_group = response.data.groupId;
          // Copier les propriétés du groupe existant
          if (existingGroupAlarm) {
            alarm.x_comment = existingGroupAlarm.x_comment;
            alarm.x_state = existingGroupAlarm.x_state;
            alarm.x_treated = existingGroupAlarm.x_treated;
          }
        }
      });

      $q.notify({
        type: "positive",
        message:
          existingGroups.size > 1
            ? `${existingGroups.size} groupes fusionnés - ${dbIds.length} alarmes au total`
            : `Groupe étendu à ${dbIds.length} alarmes`,
        caption: `ID du groupe: ${response.data.groupId}`,
      });
    } else {
      // Aucun groupe existant, créer un nouveau groupe
      const response = await api.post("/alarms/group-alarms", {
        dbIds,
      });

      selectedAlarms.value.forEach((selectedAlarm) => {
        const alarm = alarms.value.find((a) => a.dbId === selectedAlarm.dbId);
        if (alarm) {
          alarm.x_group = response.data.groupId;
        }
      });

      $q.notify({
        type: "positive",
        message: `${dbIds.length} alarmes groupées ensemble`,
        caption: `ID du groupe: ${response.data.groupId}`,
      });

      // Ouvrir automatiquement la fenêtre de commentaire pour le nouveau groupe
      if (response.data.isNewGroup) {
        currentAlarm.value = alarms.value.find(
          (a) => a.x_group === response.data.groupId
        );
        commentText.value = currentAlarm.value?.x_comment || "";
        commentDialog.value = true;
      }
    }

    selectedAlarms.value = [];
  } catch (error) {
    console.error("Error grouping alarms:", error);
    $q.notify({
      type: "negative",
      message: "Échec du groupement des alarmes",
      caption: error.message,
    });
  }
};

const ungroupAlarm = async (dbId) => {
  try {
    await api.patch("/alarms/ungroup-alarm", {
      dbId,
    });
    const alarm = alarms.value.find((a) => a.dbId === dbId);
    if (alarm) {
      alarm.x_group = null;
    }
    $q.notify({
      type: "positive",
      message: "Alarme dégroupée",
    });
  } catch (error) {
    console.error("Error ungrouping alarm:", error);
    $q.notify({
      type: "negative",
      message: "Échec du dégroupement de l'alarme",
      caption: error.message,
    });
  }
};

const editComment = (alarm) => {
  currentAlarm.value = alarm;
  commentText.value = alarm.x_comment || "";
  commentDialog.value = true;
};

const saveComment = async () => {
  try {
    const alarm = alarms.value.find((a) => a.dbId === currentAlarm.value.dbId);
    const groupId = alarm?.x_group;

    await api.patch("/alarms/update-comment", {
      dbId: currentAlarm.value.dbId,
      comment: commentText.value,
    });

    // Si l'alarme fait partie d'un groupe, mettre à jour toutes les alarmes du groupe
    if (groupId) {
      alarms.value.forEach((a) => {
        if (a.x_group === groupId) {
          a.x_comment = commentText.value;
        }
      });

      const groupCount = alarms.value.filter(
        (a) => a.x_group === groupId
      ).length;
      $q.notify({
        type: "positive",
        message: `Commentaire mis à jour pour ${groupCount} alarme(s) du groupe`,
      });
    } else {
      // Sinon, mettre à jour seulement l'alarme sélectionnée
      if (alarm) {
        alarm.x_comment = commentText.value;
      }
      $q.notify({
        type: "positive",
        message: "Commentaire mis à jour",
      });
    }

    commentDialog.value = false;

    // Si l'alarme fait partie d'un groupe, proposer de marquer comme traitées
    if (groupId) {
      const groupAlarms = alarms.value.filter((a) => a.x_group === groupId);
      const untreatedCount = groupAlarms.filter((a) => !a.x_treated).length;

      if (untreatedCount > 0) {
        $q.dialog({
          title: "Marquer comme traitées ?",
          message: `Souhaitez-vous marquer les ${untreatedCount} alarme(s) non traitée(s) de ce groupe comme traitées ?`,
          cancel: { label: "Non", flat: true, color: "grey-7" },
          ok: { label: "Oui, marquer comme traitées", color: "positive" },
          persistent: true,
        }).onOk(async () => {
          const dbIdsToMark = groupAlarms
            .filter((a) => !a.x_treated)
            .map((a) => a.dbId);
          try {
            await api.patch("/alarms/mark-treated", { dbIds: dbIdsToMark });
            dbIdsToMark.forEach((id) => {
              const alarmToUpdate = alarms.value.find((a) => a.dbId === id);
              if (alarmToUpdate) alarmToUpdate.x_treated = true;
            });
            $q.notify({
              type: "positive",
              message: `${dbIdsToMark.length} alarme(s) du groupe marquée(s) comme traitée(s)`,
            });
          } catch (err) {
            console.error("Error marking group as treated:", err);
            $q.notify({
              type: "negative",
              message: "Échec du marquage comme traitées",
              caption: err.message,
            });
          }
        });
      }
    }

    currentAlarm.value = null;
    commentText.value = "";
  } catch (error) {
    console.error("Error updating comment:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la mise à jour du commentaire",
      caption: error.message,
    });
  }
};

const viewDetails = (alarm) => {
  currentAlarm.value = alarm;
  detailsDialog.value = true;
};

const classifyAlarm = async (alarmId, type) => {
  try {
    const endpoint = `/alarms/${type}`;
    await api.post(endpoint, { alarmId });

    $q.notify({
      type: "positive",
      message: `Alarme classifiée comme "${type}"`,
      caption: "Rechargement des alarmes...",
    });

    // Recharger les alarmes après classification
    await loadAlarms();
  } catch (error) {
    console.error("Error classifying alarm:", error);
    $q.notify({
      type: "negative",
      message: "Échec de la classification de l'alarme",
      caption: error.message,
    });
  }
};

const loadPendingInterventions = async () => {
  // Vérifier que l'utilisateur a la permission de valider
  if (!App.userHasAccess("canValidateInterventions")) {
    return;
  }

  try {
    const response = await api.get(
      `/interventions/pending/${selectedDateISO.value}`
    );
    pendingInterventions.value = response.data;

    if (pendingInterventions.value.length > 0) {
      currentIntervention.value = pendingInterventions.value[0];
      validationDialog.value = true;
    }
  } catch (error) {
    console.error("Error loading pending interventions:", error);
  }
};

const findMatchingAlarms = async () => {
  if (!currentIntervention.value) return;

  searchingAlarms.value = true;
  searchPerformed.value = false;
  try {
    const response = await api.post("/interventions/find-matching-alarms", {
      alarmCode: currentIntervention.value.alarmCode,
      startTime: currentIntervention.value.startTime,
      endTime: currentIntervention.value.endTime,
      plannedDate: selectedDateISO.value,
    });

    matchingAlarms.value = response.data;
    selectedMatchingAlarms.value = matchingAlarms.value.map((a) => a.dbId);

    // Pré-remplir le commentaire avec description et commentaire
    if (selectedMatchingAlarms.value.length > 0) {
      const parts = [];
      if (currentIntervention.value.description) {
        parts.push(currentIntervention.value.description);
      }
      if (currentIntervention.value.comment) {
        parts.push(currentIntervention.value.comment);
      }
      if (parts.length > 0) {
        validationComment.value = parts.join(" - ");
      }
    }

    // Initialiser le toggle avec la valeur de l'intervention
    validationIsPlanned.value = currentIntervention.value.isPlanned || false;

    searchPerformed.value = true;
  } catch (error) {
    console.error("Error finding matching alarms:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la recherche des alarmes",
      caption: error.message,
    });
  } finally {
    searchingAlarms.value = false;
  }
};

const toggleAlarmSelection = (alarm) => {
  const index = selectedMatchingAlarms.value.indexOf(alarm.dbId);
  if (index > -1) {
    selectedMatchingAlarms.value.splice(index, 1);
  } else {
    selectedMatchingAlarms.value.push(alarm.dbId);
  }
};

const validateIntervention = async () => {
  if (!currentIntervention.value || selectedMatchingAlarms.value.length === 0) {
    return;
  }

  try {
    validationLoading.value = true;
    await api.post(
      `/interventions/journal/${currentIntervention.value.id}/validate`,
      {
        selectedAlarmIds: selectedMatchingAlarms.value,
        comment: validationComment.value,
        isPlanned: validationIsPlanned.value,
      }
    );

    validationLoading.value = false;
    $q.notify({
      type: "positive",
      message: "Intervention validée avec succès",
      caption: `${selectedMatchingAlarms.value.length} alarme(s) groupée(s) et traitée(s)`,
    });

    // Recharger les alarmes
    await loadAlarms();

    // Passer à l'intervention suivante ou fermer
    moveToNextIntervention();
  } catch (error) {
    console.error("Error validating intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de la validation",
      caption: error.message,
    });
  }
};

const ignoreIntervention = async () => {
  if (!currentIntervention.value) return;

  try {
    await api.post(
      `/interventions/journal/${currentIntervention.value.id}/ignore`,
      {}
    );

    $q.notify({
      type: "info",
      message: "Intervention ignorée",
    });

    moveToNextIntervention();
  } catch (error) {
    console.error("Error ignoring intervention:", error);
    $q.notify({
      type: "negative",
      message: "Erreur lors de l'ignorance de l'intervention",
      caption: error.message,
    });
  }
};

const skipIntervention = () => {
  moveToNextIntervention();
};

const moveToNextIntervention = () => {
  // Retirer l'intervention courante de la liste
  const currentIndex = pendingInterventions.value.findIndex(
    (i) => i.id === currentIntervention.value.id
  );
  if (currentIndex > -1) {
    pendingInterventions.value.splice(currentIndex, 1);
  }

  // Réinitialiser l'état
  matchingAlarms.value = [];
  selectedMatchingAlarms.value = [];
  validationComment.value = "";
  searchPerformed.value = false;

  if (pendingInterventions.value.length > 0) {
    // Passer à l'intervention suivante
    currentIntervention.value = pendingInterventions.value[0];
  } else {
    // Fermer le modal
    validationDialog.value = false;
    currentIntervention.value = null;
  }
};

// --- Gestion des règles ---

const rulesDialog = ref(false);
const ruleFormDialog = ref(false);
const ruleFormLoading = ref(false);
const testRegexLoading = ref(false);
const testRegexDialog = ref(false);
const testRegexResults = ref([]);
const editingRule = ref(null);
const ruleForm = ref({ name: "", keyword: "", alarmCodePattern: "", dataSourceFilter: "", comment: "", action: "group", groupBy: "location" });
const ruleFormZoneText = ref("");

const rulesColumns = [
  { name: "name", label: "Nom", field: "name", align: "left", sortable: true },
  { name: "keyword", label: "Mot-clé", field: "keyword", align: "left" },
  { name: "alarmCodePattern", label: "Area pattern", field: "alarmCodePattern", align: "center" },
  { name: "dataSourceFilter", label: "Source", field: "dataSourceFilter", align: "center" },
  { name: "action", label: "Action", field: "action", align: "center" },
  { name: "comment", label: "Commentaire", field: "comment", align: "left" },
  { name: "groupBy", label: "Groupement", field: "groupBy", align: "center" },
  { name: "zone", label: "Zone (dataSources)", field: "zone", align: "left" },
  { name: "enabled", label: "Actif", field: "enabled", align: "center" },
  { name: "actions", label: "", field: "actions", align: "right" },
];

const copyRule = (rule) => {
  editingRule.value = null;
  ruleForm.value = {
    name: `${rule.name} (copie)`,
    keyword: rule.keyword,
    alarmCodePattern: rule.alarmCodePattern || "",
    dataSourceFilter: rule.dataSourceFilter || "",
    comment: rule.comment || "",
    action: rule.action || "group",
    groupBy: rule.groupBy || "location",
  };
  ruleFormZoneText.value = rule.zone ? rule.zone.join(", ") : "";
  ruleFormDialog.value = true;
};

const openRuleForm = (rule = null) => {
  editingRule.value = rule;
  if (rule) {
    ruleForm.value = { name: rule.name, keyword: rule.keyword, alarmCodePattern: rule.alarmCodePattern || "", dataSourceFilter: rule.dataSourceFilter || "", comment: rule.comment, action: rule.action || "group", groupBy: rule.groupBy || "location" };
    ruleFormZoneText.value = rule.zone ? rule.zone.join(", ") : "";
  } else {
    ruleForm.value = { name: "", keyword: "", alarmCodePattern: "", dataSourceFilter: "", comment: "", action: "group", groupBy: "location" };
    ruleFormZoneText.value = "";
  }
  ruleFormDialog.value = true;
};

const isValidRegex = (pattern) => {
  try { new RegExp(pattern); return true; } catch { return false; }
};

const testRuleRegex = async () => {
  if (ruleForm.value.alarmCodePattern && !isValidRegex(ruleForm.value.alarmCodePattern)) {
    $q.notify({ type: "warning", message: "Regex invalide" });
    return;
  }
  try {
    testRegexLoading.value = true;
    const response = await api.post("/alarms/auto-group-rules/test-regex", {
      alarmCodePattern: ruleForm.value.alarmCodePattern || null,
      keyword: ruleForm.value.keyword || null,
      dataSourceFilter: ruleForm.value.dataSourceFilter || null,
    });
    testRegexResults.value = response.data;
    testRegexDialog.value = true;
  } catch (e) {
    $q.notify({ type: "negative", message: "Erreur lors du test", caption: e.message });
  } finally {
    testRegexLoading.value = false;
  }
};

const saveRule = async () => {
  if (!ruleForm.value.name) {
    $q.notify({ type: "warning", message: "Le nom est requis" });
    return;
  }
  if (!ruleForm.value.keyword && !ruleForm.value.alarmCodePattern && !ruleForm.value.dataSourceFilter) {
    $q.notify({ type: "warning", message: "Au moins un critère de filtre est requis (mot-clé, regex ou source)" });
    return;
  }
  if (ruleForm.value.alarmCodePattern && !isValidRegex(ruleForm.value.alarmCodePattern)) {
    $q.notify({ type: "warning", message: "La regex alarmArea est invalide" });
    return;
  }
  try {
    ruleFormLoading.value = true;
    const zone =
      ruleForm.value.action === "group" && ruleForm.value.groupBy === "zone"
        ? ruleFormZoneText.value.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

    const payload = {
      ...ruleForm.value,
      zone,
      alarmCodePattern: ruleForm.value.alarmCodePattern
        ? ruleForm.value.alarmCodePattern.replace(/\\d/g, "[0-9]")
        : null,
    };

    if (editingRule.value?.id) {
      await api.put(`/alarms/auto-group-rules/${editingRule.value.id}`, payload);
    } else {
      await api.post("/alarms/auto-group-rules", payload);
    }

    await loadAutoGroupRules();
    ruleFormDialog.value = false;
    $q.notify({ type: "positive", message: "Règle enregistrée" });
  } catch (e) {
    $q.notify({ type: "negative", message: "Erreur lors de l'enregistrement", caption: e.message });
  } finally {
    ruleFormLoading.value = false;
  }
};

const toggleRuleEnabled = async (rule) => {
  try {
    await api.put(`/alarms/auto-group-rules/${rule.id}`, { ...rule, enabled: !rule.enabled });
    await loadAutoGroupRules();
  } catch (e) {
    $q.notify({ type: "negative", message: "Erreur", caption: e.message });
  }
};

const deleteRule = (rule) => {
  $q.dialog({
    title: "Supprimer la règle",
    message: `Supprimer la règle "${rule.name}" ?`,
    cancel: { label: "Annuler", flat: true, color: "grey-7" },
    ok: { label: "Supprimer", color: "negative" },
    persistent: true,
  }).onOk(async () => {
    try {
      await api.delete(`/alarms/auto-group-rules/${rule.id}`);
      await loadAutoGroupRules();
      $q.notify({ type: "positive", message: "Règle supprimée" });
    } catch (e) {
      $q.notify({ type: "negative", message: "Erreur", caption: e.message });
    }
  });
};

// --- Auto-groupement ---

const autoGroupRules = ref([]);

const loadAutoGroupRules = async () => {
  try {
    const response = await api.get("/alarms/auto-group-rules");
    autoGroupRules.value = response.data;
  } catch (e) {
    console.error("Erreur chargement règles auto-group:", e);
  }
};

const normalizeRegex = (pattern) => pattern.replace(/\\d/g, "[0-9]");

const matchesRule = (alarm, rule) => {
  if (rule.keyword && !alarm.alarmText.toLowerCase().includes(rule.keyword.toLowerCase())) return false;
  if (rule.alarmCodePattern) {
    try {
      if (!new RegExp(normalizeRegex(rule.alarmCodePattern), "i").test(alarm.alarmArea)) return false;
    } catch {
      return false;
    }
  }
  if (rule.dataSourceFilter && alarm.dataSource !== rule.dataSourceFilter) return false;
  return true;
};

const resolveAutoGroupComment = (cluster) => {
  for (const rule of autoGroupRules.value) {
    if (cluster.some((a) => matchesRule(a, rule))) {
      return rule.comment;
    }
  }
  return null;
};

const currentAutoGroup = computed(() => {
  return autoGroupProposals.value[currentAutoGroupIndex.value] || null;
});

const buildClusters = (alarmList) => {
  const GAP_MS = 5 * 60 * 1000;
  if (alarmList.length < 2) return [];
  const sorted = [...alarmList].sort(
    (a, b) => new Date(a.timeOfOccurence) - new Date(b.timeOfOccurence)
  );
  const clusters = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    const curr = sorted[i];
    const prevEnd = new Date(prev.timeOfAcknowledge || prev.timeOfOccurence).getTime();
    const currStart = new Date(curr.timeOfOccurence).getTime();
    if (currStart - prevEnd <= GAP_MS) {
      current.push(curr);
    } else {
      if (current.length >= 2) clusters.push([...current]);
      current = [curr];
    }
  }
  if (current.length >= 2) clusters.push(current);
  return clusters;
};

const computeAutoGroups = () => {
  const candidates = alarms.value.filter((a) => !a.x_group && !a.x_treated);

  const proposals = [];
  const usedDbIds = new Set();

  // --- Règles "treat" : alarmes individuelles à marquer comme traitées ---
  for (const rule of autoGroupRules.value) {
    if (!rule.enabled || rule.action !== "treat") continue;

    const matchingAlarms = candidates.filter(
      (a) => matchesRule(a, rule) && !usedDbIds.has(a.dbId)
    );

    if (matchingAlarms.length === 0) continue;

    matchingAlarms.forEach((a) => usedDbIds.add(a.dbId));
    proposals.push({
      type: "treat",
      ruleName: rule.name,
      alarms: matchingAlarms,
      comment: rule.comment || "",
    });
  }

  // --- Règles "group" avec groupBy: "zone" ---
  for (const rule of autoGroupRules.value) {
    if (!rule.enabled || rule.action !== "group" || rule.groupBy !== "zone" || !rule.zone) continue;

    // Toutes les alarmes des zones listées (pas encore utilisées)
    const allZoneAlarms = candidates.filter(
      (a) => rule.zone.includes(a.dataSource) && !usedDbIds.has(a.dbId)
    );

    for (const cluster of buildClusters(allZoneAlarms)) {
      // N'activer le groupe que si au moins une alarme du cluster déclenche la règle
      if (!cluster.some((a) => matchesRule(a, rule))) continue;

      cluster.forEach((a) => usedDbIds.add(a.dbId));
      proposals.push({
        type: "group",
        fromRule: true,
        location: rule.name,
        alarms: cluster,
        comment: rule.comment,
      });
    }
  }

  // --- Règles "group" location actives (avec critères) ---
  for (const rule of autoGroupRules.value) {
    if (!rule.enabled || rule.action !== "group" || rule.groupBy !== "location") continue;
    if (!rule.keyword && !rule.alarmCodePattern && !rule.dataSourceFilter) continue;

    const ruleAlarms = candidates.filter(
      (a) => !usedDbIds.has(a.dbId) && (rule.dataSourceFilter ? a.dataSource === rule.dataSourceFilter : true)
    );

    const byLocation = {};
    ruleAlarms.forEach((a) => {
      const key = `${a.dataSource}.${a.alarmArea}`;
      if (!byLocation[key]) byLocation[key] = [];
      byLocation[key].push(a);
    });

    for (const locationAlarms of Object.values(byLocation)) {
      for (const cluster of buildClusters(locationAlarms)) {
        if (!cluster.some((a) => matchesRule(a, rule))) continue;
        cluster.forEach((a) => usedDbIds.add(a.dbId));
        proposals.push({
          type: "group",
          fromRule: true,
          location: rule.name,
          alarms: cluster,
          comment: rule.comment,
        });
      }
    }
  }

  // --- Fallback : groupement temporel par emplacement ---
  const remainingCandidates = candidates.filter((a) => !usedDbIds.has(a.dbId));

  const byLocation = {};
  remainingCandidates.forEach((a) => {
    const key = `${a.dataSource}.${a.alarmArea}`;
    if (!byLocation[key]) byLocation[key] = [];
    byLocation[key].push(a);
  });

  Object.entries(byLocation).forEach(([location, locationAlarms]) => {
    for (const cluster of buildClusters(locationAlarms)) {
      proposals.push({
        type: "group",
        location,
        alarms: cluster,
        comment: resolveAutoGroupComment(cluster),
      });
    }
  });

  return proposals;
};

const openAutoGroupDialog = () => {
  const proposals = computeAutoGroups();

  if (proposals.length === 0) {
    $q.notify({
      type: "info",
      message: "Aucune proposition de traitement automatique",
      caption:
        "Aucune alarme ne correspond aux règles actives, et aucun groupe temporel détecté",
    });
    return;
  }

  autoGroupProposals.value = proposals;
  currentAutoGroupIndex.value = 0;
  selectedAutoGroupAlarms.value = proposals[0].alarms.map((a) => a.dbId);
  autoGroupComment.value = proposals[0].comment || "";
  autoGroupIsPlanned.value = false;
  autoGroupValidatingAll.value = false;
  autoGroupLoading.value = false;
  autoGroupDialog.value = true;
};

const toggleAutoGroupAlarm = (dbId) => {
  const index = selectedAutoGroupAlarms.value.indexOf(dbId);
  if (index > -1) {
    selectedAutoGroupAlarms.value.splice(index, 1);
  } else {
    selectedAutoGroupAlarms.value.push(dbId);
  }
};

const validateAutoGroup = async () => {
  const proposal = currentAutoGroup.value;
  if (!proposal) return;

  if (proposal.type === "treat") {
    if (selectedAutoGroupAlarms.value.length === 0) {
      $q.notify({ type: "warning", message: "Veuillez sélectionner au moins une alarme" });
      return;
    }
    try {
      autoGroupLoading.value = true;

      if (autoGroupComment.value.trim()) {
        for (const dbId of selectedAutoGroupAlarms.value) {
          await api.patch("/alarms/update-comment", { dbId, comment: autoGroupComment.value });
        }
      }

      await api.patch("/alarms/mark-treated", { dbIds: selectedAutoGroupAlarms.value });

      selectedAutoGroupAlarms.value.forEach((dbId) => {
        const alarm = alarms.value.find((a) => a.dbId === dbId);
        if (alarm) {
          alarm.x_treated = true;
          if (autoGroupComment.value.trim()) alarm.x_comment = autoGroupComment.value;
        }
      });

      $q.notify({ type: "positive", message: `${selectedAutoGroupAlarms.value.length} alarme(s) marquée(s) comme traitée(s)` });
      moveToNextAutoGroup();
    } catch (error) {
      console.error("Error marking as treated:", error);
      $q.notify({ type: "negative", message: "Erreur lors du marquage comme traitées", caption: error.message });
    } finally {
      autoGroupLoading.value = false;
      autoGroupValidatingAll.value = false;
    }
    return;
  }

  // type === "group"
  if (selectedAutoGroupAlarms.value.length < 2) {
    $q.notify({ type: "warning", message: "Veuillez sélectionner au moins 2 alarmes pour créer un groupe" });
    return;
  }

  try {
    autoGroupLoading.value = true;

    const response = await api.post("/alarms/group-alarms", { dbIds: selectedAutoGroupAlarms.value });
    const groupId = response.data.groupId;

    const firstAlarm = alarms.value.find((a) => a.dbId === selectedAutoGroupAlarms.value[0]);
    const effectiveComment = autoGroupComment.value.trim() || firstAlarm?.alarmText || "";

    if (effectiveComment) {
      await api.patch("/alarms/update-comment", {
        dbId: selectedAutoGroupAlarms.value[0],
        comment: effectiveComment,
      });
    }

    await api.patch("/alarms/update-state", {
      dbId: selectedAutoGroupAlarms.value[0],
      state: autoGroupIsPlanned.value ? "planned" : "unplanned",
      updateGroup: true,
    });

    await api.patch("/alarms/mark-treated", { dbIds: selectedAutoGroupAlarms.value });

    selectedAutoGroupAlarms.value.forEach((dbId) => {
      const alarm = alarms.value.find((a) => a.dbId === dbId);
      if (alarm) {
        alarm.x_group = groupId;
        alarm.x_treated = true;
        alarm.x_state = autoGroupIsPlanned.value ? "planned" : "unplanned";
        if (effectiveComment) alarm.x_comment = effectiveComment;
      }
    });

    $q.notify({ type: "positive", message: `Groupe créé avec ${selectedAutoGroupAlarms.value.length} alarmes` });
    moveToNextAutoGroup();
  } catch (error) {
    console.error("Error creating auto-group:", error);
    $q.notify({ type: "negative", message: "Erreur lors de la création du groupe", caption: error.message });
  } finally {
    autoGroupLoading.value = false;
    autoGroupValidatingAll.value = false;
  }
};

const skipAutoGroup = () => {
  moveToNextAutoGroup();
};

const validateAllAutoGroups = async () => {
  const remaining = autoGroupProposals.value.slice(currentAutoGroupIndex.value);
  let groupsCreated = 0;
  let treated = 0;
  let failed = 0;

  try {
    autoGroupLoading.value = true;
    autoGroupValidatingAll.value = true;

    for (const proposal of remaining) {
      const dbIds = proposal.alarms.map((a) => a.dbId);

      try {
        if (proposal.type === "treat") {
          if (proposal.comment) {
            for (const dbId of dbIds) {
              await api.patch("/alarms/update-comment", { dbId, comment: proposal.comment });
            }
          }
          await api.patch("/alarms/mark-treated", { dbIds });
          dbIds.forEach((dbId) => {
            const alarm = alarms.value.find((a) => a.dbId === dbId);
            if (alarm) {
              alarm.x_treated = true;
              if (proposal.comment) alarm.x_comment = proposal.comment;
            }
          });
          treated += dbIds.length;
        } else {
          // type === "group"
          if (dbIds.length < 2) continue;

          const response = await api.post("/alarms/group-alarms", { dbIds });
          const groupId = response.data.groupId;

          const firstAlarm = alarms.value.find((a) => a.dbId === dbIds[0]);
          const effectiveComment = proposal.comment || firstAlarm?.alarmText || "";

          if (effectiveComment) {
            await api.patch("/alarms/update-comment", { dbId: dbIds[0], comment: effectiveComment });
          }

          await api.patch("/alarms/update-state", { dbId: dbIds[0], state: "unplanned", updateGroup: true });
          await api.patch("/alarms/mark-treated", { dbIds });

          dbIds.forEach((dbId) => {
            const alarm = alarms.value.find((a) => a.dbId === dbId);
            if (alarm) {
              alarm.x_group = groupId;
              alarm.x_treated = true;
              alarm.x_state = "unplanned";
              if (effectiveComment) alarm.x_comment = effectiveComment;
            }
          });
          groupsCreated++;
        }
      } catch {
        failed++;
      }
      currentAutoGroupIndex.value++;
    }

    autoGroupDialog.value = false;
    autoGroupProposals.value = [];
    currentAutoGroupIndex.value = 0;

    const parts = [];
    if (groupsCreated > 0) parts.push(`${groupsCreated} groupe(s) créé(s)`);
    if (treated > 0) parts.push(`${treated} alarme(s) traitée(s)`);

    $q.notify({
      type: failed === 0 ? "positive" : "warning",
      message: parts.join(", ") + (failed > 0 ? `, ${failed} échec(s)` : ""),
    });
  } finally {
    autoGroupLoading.value = false;
  }
};

const moveToNextAutoGroup = () => {
  currentAutoGroupIndex.value++;

  if (currentAutoGroupIndex.value < autoGroupProposals.value.length) {
    // Pré-sélectionner toutes les alarmes du prochain groupe
    const nextGroup = autoGroupProposals.value[currentAutoGroupIndex.value];
    selectedAutoGroupAlarms.value = nextGroup.alarms.map((a) => a.dbId);
    autoGroupComment.value = nextGroup.comment || "";
    autoGroupIsPlanned.value = false;
  } else {
    // Tous les groupes traités
    autoGroupDialog.value = false;
    autoGroupProposals.value = [];
    currentAutoGroupIndex.value = 0;
  }
};

const handleKeyboardShortcuts = (e) => {
  // Ignorer si un dialog est ouvert ou si le focus est dans un input
  if (autoGroupDialog.value || commentDialog.value) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  if (e.ctrlKey && e.key === "g") {
    e.preventDefault();
    if (
      selectedAlarms.value.length >= 2 &&
      App.userHasAccess("canGroupAlarms")
    ) {
      groupSelectedAlarms();
    }
  }

  if (e.ctrlKey && e.key === "t") {
    e.preventDefault();
    if (
      selectedAlarms.value.length > 0 &&
      App.userHasAccess("canMarkAsTreated")
    ) {
      markAsTreated();
    }
  }
};

watch(selectedDate, async (val) => {
  if (val?.length === 10) {
    await loadAlarms();
    await loadPendingInterventions();
    if (isYesterday.value) await loadDailyDoneStatus();
    else dailyDone.value = false;
  }
});

onMounted(async () => {
  await Promise.all([loadAlarms(), loadPendingInterventions(), loadAutoGroupRules(), loadDailyDoneStatus()]);
  window.addEventListener("keydown", handleKeyboardShortcuts);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyboardShortcuts);
});
</script>

<style scoped>
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
