<template>
  <div class="alarm-group-view">
    <q-card v-for="group in alarmGroups" :key="group.groupId" class="q-mb-md">
      <q-card-section class="bg-info text-white">
        <div class="row items-center">
          <div class="col">
            <div class="text-h6">
              Groupe {{ group.groupId }}
              <q-badge color="white" text-color="info" class="q-ml-sm">
                {{ group.alarms.length }} alarmes
              </q-badge>
            </div>
            <div class="text-caption">
              Durée totale: {{ formatDuration(group.totalDuration) }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              flat
              round
              dense
              icon="unfold_more"
              @click="group.expanded = !group.expanded"
            >
              <q-tooltip>{{
                group.expanded ? "Réduire" : "Étendre"
              }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </q-card-section>

      <q-slide-transition>
        <div v-show="group.expanded">
          <q-separator />
          <q-card-section>
            <q-list separator>
              <q-item
                v-for="alarm in group.alarms"
                :key="alarm.dbId"
                class="q-pa-sm"
              >
                <q-item-section avatar>
                  <q-icon
                    :name="
                      alarm.x_treated
                        ? 'check_circle'
                        : 'radio_button_unchecked'
                    "
                    :color="alarm.x_treated ? 'positive' : 'grey-5'"
                    size="sm"
                  />
                </q-item-section>

                <q-item-section>
                  <q-item-label>
                    <strong>{{ alarm.alarmArea }}</strong> -
                    {{ alarm.alarmText }}
                  </q-item-label>
                  <q-item-label caption>
                    {{ formatDate(alarm.timeOfOccurence) }} |
                    {{ alarm.dataSource }} |
                    {{ alarm.alarmCode }}
                  </q-item-label>
                  <q-item-label
                    caption
                    v-if="alarm.x_comment"
                    class="q-mt-xs text-grey-8"
                  >
                    <q-icon name="comment" size="xs" /> {{ alarm.x_comment }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <div class="column items-end q-gutter-xs">
                    <q-badge :color="getSeverityColor(alarm.severity)">
                      {{ alarm.severity }}
                    </q-badge>
                    <q-badge color="grey-6">
                      {{ formatDuration(alarm.duration) }}
                    </q-badge>
                    <q-badge
                      :color="alarm.x_state === 'planned' ? 'orange' : 'red'"
                    >
                      {{
                        alarm.x_state === "planned"
                          ? "Planifié"
                          : "Non planifié"
                      }}
                    </q-badge>
                  </div>
                </q-item-section>

                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="more_vert"
                    color="grey-7"
                  >
                    <q-menu>
                      <q-list style="min-width: 150px">
                        <q-item
                          clickable
                          v-close-popup
                          @click="$emit('edit-comment', alarm)"
                        >
                          <q-item-section avatar>
                            <q-icon name="comment" />
                          </q-item-section>
                          <q-item-section
                            >Modifier le commentaire</q-item-section
                          >
                        </q-item>
                        <q-item
                          clickable
                          v-close-popup
                          @click="$emit('ungroup', alarm.dbId)"
                        >
                          <q-item-section avatar>
                            <q-icon name="link_off" />
                          </q-item-section>
                          <q-item-section>Dégrouper</q-item-section>
                        </q-item>
                        <q-separator />
                        <q-item
                          clickable
                          v-close-popup
                          @click="$emit('view-details', alarm)"
                        >
                          <q-item-section avatar>
                            <q-icon name="info" />
                          </q-item-section>
                          <q-item-section>Voir les détails</q-item-section>
                        </q-item>
                      </q-list>
                    </q-menu>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </div>
      </q-slide-transition>
    </q-card>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import dayjs from "dayjs";

const props = defineProps({
  alarms: {
    type: Array,
    required: true,
  },
});

defineEmits(["edit-comment", "ungroup", "view-details"]);

// Calculate real duration considering overlapping alarms
const calculateRealDuration = (alarms) => {
  if (alarms.length === 0) return 0;

  // Create time periods for each alarm
  const periods = alarms
    .filter((alarm) => alarm.timeOfOccurence && alarm.timeOfAcknowledge)
    .map((alarm) => ({
      start: dayjs(alarm.timeOfOccurence).valueOf(),
      end: dayjs(alarm.timeOfAcknowledge).valueOf(),
    }))
    .sort((a, b) => a.start - b.start);

  if (periods.length === 0) return 0;

  // Merge overlapping periods
  const merged = [];
  let current = { ...periods[0] };

  for (let i = 1; i < periods.length; i++) {
    if (periods[i].start <= current.end) {
      // Overlapping period, extend the current one
      current.end = Math.max(current.end, periods[i].end);
    } else {
      // No overlap, save current and start a new one
      merged.push(current);
      current = { ...periods[i] };
    }
  }
  merged.push(current);

  // Calculate total duration in seconds
  const totalMs = merged.reduce(
    (sum, period) => sum + (period.end - period.start),
    0
  );
  return Math.round(totalMs / 1000);
};

// Group alarms by x_group
const alarmGroups = computed(() => {
  const grouped = {};

  props.alarms.forEach((alarm) => {
    if (alarm.x_group) {
      if (!grouped[alarm.x_group]) {
        grouped[alarm.x_group] = {
          groupId: alarm.x_group,
          alarms: [],
          totalDuration: 0,
          expanded: true,
        };
      }
      grouped[alarm.x_group].alarms.push(alarm);
    }
  });

  // Calculate real duration for each group
  Object.values(grouped).forEach((group) => {
    group.totalDuration = calculateRealDuration(group.alarms);
  });

  // Convert to array and sort by group ID
  return Object.values(grouped).sort((a, b) => a.groupId - b.groupId);
});

const formatDate = (dateString) => {
  return dayjs(dateString).format("YYYY-MM-DD HH:mm:ss");
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

const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case "error":
      return "red";
    case "warning":
      return "orange";
    case "info":
      return "blue";
    default:
      return "grey";
  }
};
</script>

<style scoped>
.alarm-group-view {
  width: 100%;
}
</style>
