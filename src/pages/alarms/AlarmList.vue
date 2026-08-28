<template>
  <q-page padding>
    <div class="text-h4">Liste des alarmes</div>
    <div>
      <q-banner
        class="bg-blue text-white q-my-sm"
        dense
        v-if="
          !dataLogStore.alarms ||
          dataLogStore.alarms.filter((a) => !a.type).length > 0
        "
      >
        Il y a {{ dataLogStore.alarms.filter((a) => !a.type).length }} alarmes
        non classées dans la liste.
        <template v-slot:action>
          <q-btn
            flat
            color="white"
            label="Rafraîchir"
            @click="dataLogStore.initialize()"
          />
        </template>
      </q-banner>
    </div>
    <q-table
      :rows="
        dataLogStore.alarms.map((alarm) => {
          return {
            dataSource: alarm.dataSource,
            alarmArea: alarm.alarmArea,
            alarmCode: alarm.alarmCode,
            alarmText: alarm.alarmText,
            alarmId: alarm.alarmId,
            type: alarm.type,
          };
        })
      "
      row-key="alarmId"
      wrap-cells
      flat
      bordered
      :filter="filter"
    >
      <template v-slot:top>
        <q-input
          v-model="filter"
          label="Rechercher"
          color="primary"
          dense
          class="full-width"
        >
          <template v-slot:append>
            <q-btn
              flat
              color="primary"
              icon="close"
              round
              @click="filter = ''"
              v-if="filter"
            />
          </template>

          <template v-slot:prepend>
            <q-icon name="search" />
          </template>

          <template v-slot:hint>
            Rechercher par ID d'alarme, source de données, zone d'alarme ou code
            d'alarme
          </template>
        </q-input>
      </template>
      <template v-slot:body="props">
        <tr
          :props="props"
          :data-alarm-id="props.row.alarmId"
          :class="{
            'alarm-row--hovered': App.userHasAccess('canClassifyAlarms'),
          }"
          @mouseenter="onRowMouseEnter(props.row)"
          @mouseleave="onRowMouseLeave"
        >
          <td class="text-uppercase">{{ props.row.dataSource }}</td>
          <td class="text-uppercase">{{ props.row.alarmArea }}</td>
          <td class="text-uppercase">{{ props.row.alarmCode }}</td>
          <td>{{ props.row.alarmText }}</td>
          <td>{{ props.row.alarmId }}</td>
          <td class="relative-position">
            <q-badge
              color="red"
              class="q-ma-xs"
              v-if="props.row.type && props.row.type === 'primary'"
            >
              Arrêt
            </q-badge>
            <q-badge
              color="blue"
              class="q-ma-xs"
              v-else-if="props.row.type && props.row.type === 'secondary'"
            >
              Info
            </q-badge>
            <q-badge
              color="primary"
              class="q-ma-xs"
              v-else-if="props.row.type && props.row.type === 'human'"
            >
              Humain
            </q-badge>
            <q-badge
              color="grey"
              class="q-ma-xs"
              v-else-if="props.row.type && props.row.type === 'other'"
            >
              Autre
            </q-badge>
            <q-badge color="warning" class="q-ma-xs" v-else>
              Non définit
            </q-badge>
          </td>
          <q-menu
            touch-position
            context-menu
            v-if="App.userHasAccess('canClassifyAlarms')"
          >
            <q-list dense style="min-width: 100px">
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setPrimary(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "primary"</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setSecondary(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "secondary"</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setHuman(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "Humain"</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="dataLogStore.setOther(props.row.alarmId)"
                v-if="props.row.alarmId"
              >
                <q-item-section>Mettre en "Autre"</q-item-section>
              </q-item>
              <q-item
                clickable
                v-close-popup
                @click="translateAlarm(props.row.alarmId)"
              >
                <q-item-section>Ajouter une traduction</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </tr>
      </template>
    </q-table>

    <!-- Indicateur circulaire suivant le curseur pendant le raccourci -->
    <div
      v-if="shortcutProgress > 0"
      class="shortcut-cursor-indicator"
      :style="{
        left: cursorPos.x + 'px',
        top: cursorPos.y + 'px',
      }"
    >
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle
          class="shortcut-cursor-indicator__bg"
          cx="24"
          cy="24"
          r="20"
        />
        <circle
          class="shortcut-cursor-indicator__ring"
          :class="`text-${shortcutColor}`"
          cx="24"
          cy="24"
          r="20"
          :stroke-dasharray="2 * Math.PI * 20"
          :stroke-dashoffset="2 * Math.PI * 20 * (1 - shortcutProgress)"
        />
      </svg>
      <span class="shortcut-cursor-indicator__label">{{
        activeKeyLabel
      }}</span>
    </div>

    <q-banner
      v-if="App.userHasAccess('canClassifyAlarms')"
      dense
      class="bg-grey-2 text-grey-8 q-mt-sm shortcut-hint"
    >
      <q-icon name="keyboard" class="q-mr-xs" />
      Astuce : survolez une ligne et maintenez
      <strong>H</strong> (Humain), <strong>P</strong> (Primary),
      <strong>S</strong> (Secondary) ou <strong>A</strong> (Autre) pendant une
      demi-seconde pour changer son type rapidement.
    </q-banner>
  </q-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { useDataLogStore } from "stores/datalog";
import { useQuasar } from "quasar";
import { useAppStore } from "src/stores/app";
import { useRoute } from "vue-router";

const $q = useQuasar();
const dataLogStore = useDataLogStore();
const filter = ref("");
const App = useAppStore();
const $route = useRoute();

// --- Raccourcis clavier pour classer une alarme au survol ---
const SHORTCUT_HOLD_MS = 100;
const SHORTCUT_KEYS = {
  h: { action: "setHuman", label: "Humain", color: "primary" },
  p: { action: "setPrimary", label: "Primary", color: "red" },
  s: { action: "setSecondary", label: "Secondary", color: "blue" },
  a: { action: "setOther", label: "Autre", color: "grey" },
};

const shortcutRow = ref(null);
const shortcutProgress = ref(0);
const shortcutColor = ref("primary");
const activeKeyLabel = ref("");
const cursorPos = ref({ x: 0, y: 0 });

let shortcutTimer = null;
let shortcutStart = 0;
let activeKey = null;

// Retrouve la ligne réellement sous le curseur au moment T, plutôt que de se
// fier au mouseenter capturé une seule fois : quand la touche reste
// enfoncée, la ligne classée disparaît/se déplace (tri, filtre) sans que la
// souris ne bouge, donc aucun nouvel événement mouseenter n'arrive.
const rowUnderCursor = () => {
  const el = document.elementFromPoint(cursorPos.value.x, cursorPos.value.y);
  const tr = el && el.closest && el.closest("tr[data-alarm-id]");
  if (!tr) return null;
  const alarmId = tr.getAttribute("data-alarm-id");
  return alarmId ? { alarmId } : null;
};

const clearShortcutTimer = () => {
  if (shortcutTimer) {
    clearInterval(shortcutTimer);
    shortcutTimer = null;
  }
  shortcutProgress.value = 0;
  activeKey = null;
  activeKeyLabel.value = "";
};

const onRowMouseEnter = (row) => {
  shortcutRow.value = row;
};

const onRowMouseLeave = () => {
  shortcutRow.value = null;
  clearShortcutTimer();
};

const onMouseMove = (e) => {
  cursorPos.value = { x: e.clientX, y: e.clientY };
};

const armShortcutCycle = (key, shortcut) => {
  activeKey = key;
  shortcutColor.value = shortcut.color;
  activeKeyLabel.value = key.toUpperCase();
  shortcutStart = Date.now();

  shortcutTimer = setInterval(() => {
    const elapsed = Date.now() - shortcutStart;
    shortcutProgress.value = Math.min(elapsed / SHORTCUT_HOLD_MS, 1);
    if (elapsed >= SHORTCUT_HOLD_MS) {
      clearInterval(shortcutTimer);
      shortcutTimer = null;

      const row = rowUnderCursor() || shortcutRow.value;
      if (row && row.alarmId) {
        dataLogStore[shortcut.action](row.alarmId);
        // La ligne va disparaître/se déplacer suite au reclassement sans que
        // la souris ne bouge : on invalide la référence figée pour que le
        // prochain cycle se fie uniquement à rowUnderCursor().
        shortcutRow.value = null;
        $q.notify({
          message: `Alarme classée en "${shortcut.label}"`,
          color: shortcut.color,
          icon: "check_circle",
          timeout: 1000,
          group: true,
        });
      }

      // Tant que la touche est toujours maintenue, on enchaîne aussitôt sur
      // la prochaine alarme qui se retrouve sous le curseur (après tri/filtre).
      if (activeKey === key) {
        armShortcutCycle(key, shortcut);
      }
    }
  }, 16);
};

const onShortcutKeydown = (e) => {
  if (!App.userHasAccess("canClassifyAlarms")) return;
  if (!shortcutRow.value || !shortcutRow.value.alarmId) return;
  // Ignore les raccourcis clavier natifs (ex: focus sur un champ texte)
  const target = e.target;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  ) {
    return;
  }

  const key = e.key.toLowerCase();
  const shortcut = SHORTCUT_KEYS[key];
  if (!shortcut) return;
  if (activeKey === key) return; // déjà en cours (répétition de keydown)

  clearShortcutTimer();
  armShortcutCycle(key, shortcut);
};

const onShortcutKeyup = (e) => {
  const key = e.key.toLowerCase();
  if (activeKey === key) {
    clearShortcutTimer();
  }
};

const translateAlarm = async (alarmId) => {
  $q.dialog({
    title: "Ajouter une traduction",
    message: "Entrez la traduction de l'alarme",
    prompt: {
      model: "",
      type: "text",
    },
    cancel: true,
    persistent: true,
  }).onOk(async (data) => {
    await dataLogStore.translateAlarm(alarmId, data);
  });
};

onMounted(async () => {
  dataLogStore.initialize();
  if ($route.query.alarmId) {
    filter.value = $route.query.alarmId;
  }
  window.addEventListener("keydown", onShortcutKeydown);
  window.addEventListener("keyup", onShortcutKeyup);
  window.addEventListener("mousemove", onMouseMove);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onShortcutKeydown);
  window.removeEventListener("keyup", onShortcutKeyup);
  window.removeEventListener("mousemove", onMouseMove);
  clearShortcutTimer();
});
</script>

<style scoped>
.alarm-row--hovered:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.shortcut-hint {
  font-size: 0.85em;
}

.shortcut-cursor-indicator {
  position: fixed;
  z-index: 9999;
  width: 48px;
  height: 48px;
  transform: translate(-24px, -24px);
  pointer-events: none;
}

.shortcut-cursor-indicator svg {
  transform: rotate(-90deg);
}

.shortcut-cursor-indicator__bg {
  fill: none;
  stroke: rgba(0, 0, 0, 0.15);
  stroke-width: 4;
}

.shortcut-cursor-indicator__ring {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 16ms linear;
}

.shortcut-cursor-indicator__label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: bold;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.7);
}
</style>
