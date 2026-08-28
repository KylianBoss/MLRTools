<template>
  <div>
    <div class="aisle-grid-wrapper">
      <div class="aisle-grid" :style="{ gridTemplateColumns: gridTemplateColumns }">
        <!-- en-tête : coin vide, un pilier, puis (nom d'allée + pilier) x6 -->
        <div class="aisle-grid__corner"></div>
        <div class="aisle-grid__pillar-header"></div>
        <template v-for="aisle in aisles" :key="'header-' + aisle.id">
          <div class="aisle-grid__header">
            {{ aisle.name }}
            <div class="text-caption text-grey-6">
              {{ aisle.occupiedCount }}/{{ aisle.floorsCount }}
            </div>
          </div>
          <div class="aisle-grid__pillar-header"></div>
        </template>

        <!-- lignes d'étages, du plus haut (en premier) au plus bas ; une
             passerelle (caillebotis) s'intercale sous le premier étage de
             chaque niveau de maintenance humaine -->
        <template v-for="floor in floorRows" :key="floor">
          <div class="aisle-grid__floor-label">{{ floor }}</div>
          <div class="aisle-grid__pillar"></div>
          <template v-for="aisle in aisles" :key="aisle.id + '-' + floor">
            <div class="aisle-grid__cell">
              <StingrayIcon
                v-if="stingrayByPosition.get(`${aisle.id}-${floor}`)"
                :number="stingrayByPosition.get(`${aisle.id}-${floor}`).number"
                :state="stingrayByPosition.get(`${aisle.id}-${floor}`).state"
                :alarm-level="stingrayByPosition.get(`${aisle.id}-${floor}`).alarmLevel"
                :size="120"
                :show-badge="false"
                @click="$emit('select', stingrayByPosition.get(`${aisle.id}-${floor}`).id)"
              />
              <StingrayIcon v-else placeholder :size="120" />
            </div>
            <div class="aisle-grid__pillar"></div>
          </template>

          <template v-if="levelForFloor.get(floor)">
            <div class="aisle-grid__walkway-label">
              N{{ levelForFloor.get(floor) }}
            </div>
            <div
              v-if="levelForFloor.get(floor) !== 1"
              class="aisle-grid__walkway"
              :style="{ gridColumn: `2 / span ${aisles.length * 2 + 1}` }"
            ></div>
          </template>
        </template>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mt-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">
            Atelier maintenance
            <q-badge color="orange" :label="workshopStingrays.length" class="q-ml-xs" />
          </div>
          <div class="overflow-zone">
            <StingrayIcon
              v-for="s in workshopStingrays"
              :key="s.id"
              :number="s.number"
              :state="s.state"
              :alarm-level="s.alarmLevel"
              :size="120"
              :show-badge="false"
              @click="$emit('select', s.id)"
            />
            <div v-if="workshopStingrays.length === 0" class="text-caption text-grey-6">
              Aucun stingray à l'atelier
            </div>
          </div>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card flat bordered class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">
            Stock
            <q-badge color="grey-7" :label="stockStingrays.length" class="q-ml-xs" />
          </div>
          <div class="overflow-zone">
            <StingrayIcon
              v-for="s in stockStingrays"
              :key="s.id"
              :number="s.number"
              :state="s.state"
              :alarm-level="s.alarmLevel"
              :size="120"
              :show-badge="false"
              @click="$emit('select', s.id)"
            />
            <div v-if="stockStingrays.length === 0" class="text-caption text-grey-6">
              Aucun stingray en stock
            </div>
          </div>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import StingrayIcon from "components/maintenance/StingrayIcon.vue";

const props = defineProps({
  stingrays: { type: Array, required: true },
  aisles: { type: Array, required: true },
});
defineEmits(["select"]);

// Nombre max d'étages sur l'ensemble des allées : lu dynamiquement (pas de
// 28 codé en dur), une allée pourrait en théorie en avoir un nombre différent.
const maxFloors = computed(() =>
  Math.max(0, ...props.aisles.map((a) => a.floorsCount || 0))
);

// Index rapide "aisleId-floor" -> stingray, pour un lookup O(1) par cellule
const stingrayByPosition = computed(() => {
  const map = new Map();
  props.stingrays.forEach((s) => {
    if (s.currentAisleId && s.currentFloor) {
      map.set(`${s.currentAisleId}-${s.currentFloor}`, s);
    }
  });
  return map;
});

// Étages du plus haut au plus bas : la ligne du haut de la grille = l'étage
// le plus élevé, comme un vrai rack/bâtiment vu de face.
const floorRows = computed(() =>
  Array.from({ length: maxFloors.value }, (_, i) => maxFloors.value - i)
);

// 56px pour les numéros d'étage, puis une largeur de pilier fixe avant/entre/
// après chaque allée (7 piliers pour 6 allées).
const gridTemplateColumns = computed(
  () => `56px 12px ${"1fr 12px ".repeat(props.aisles.length).trim()}`
);

// Niveaux de maintenance humaine (tailles de groupe inégales, c'est la
// répartition réelle du bâtiment). Chaque niveau >= 2 est desservi par une
// passerelle en caillebotis à la base de sa plage d'étages ; le niveau 1 n'en
// a pas (sa base est le sol du bâtiment) mais garde son étiquette "N1".
const WALKWAY_LEVELS = [
  { level: 1, from: 1, to: 5 },
  { level: 2, from: 6, to: 11 },
  { level: 3, from: 12, to: 17 },
  { level: 4, from: 18, to: 23 },
  { level: 5, from: 24, to: 28 },
];
// étage (base du groupe) -> numéro de niveau, pour savoir sous quel étage
// afficher l'étiquette de niveau (et, sauf pour le niveau 1, la passerelle).
const levelForFloor = computed(() => {
  const map = new Map();
  WALKWAY_LEVELS.forEach(({ level, from }) => map.set(from, level));
  return map;
});

const workshopStingrays = computed(() =>
  props.stingrays.filter((s) => s.currentLocationLabel === "Maintenance stingray")
);
const stockStingrays = computed(() =>
  props.stingrays.filter((s) => s.currentLocationLabel === "Stock")
);
</script>

<style scoped>
.aisle-grid-wrapper {
  /* Laisse de la place, sous la grille, pour le titre/les onglets au-dessus
     et les zones Atelier/Stock en dessous : sans ça la page entière doit
     aussi défiler pour les atteindre, en plus du scroll interne de la grille. */
  max-height: 60vh;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 4px;
}
.aisle-grid {
  display: grid;
  gap: 1px 10px;
  padding: 8px;
  min-width: 1040px;
}
.aisle-grid__corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 3;
  background: var(--q-page-background, #fff);
}
.aisle-grid__header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--q-page-background, #fff);
  text-align: center;
  font-weight: 600;
  padding-bottom: 4px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.12);
}
.aisle-grid__floor-label {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--q-page-background, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #757575;
}
.aisle-grid__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
}

/* Piliers de support entre (et de part et d'autre) des allées */
.aisle-grid__pillar-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--q-page-background, #fff);
}
.aisle-grid__pillar {
  width: 100%;
  align-self: stretch;
  background: repeating-linear-gradient(
    to bottom,
    #b0b7c0 0,
    #b0b7c0 4px,
    #8b929c 4px,
    #8b929c 5px
  );
  border-left: 1px solid #7c838d;
  border-right: 1px solid #7c838d;
}

/* Passerelle de maintenance (caillebotis) desservant un niveau d'étages */
.aisle-grid__walkway-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #8a6d1f;
  white-space: nowrap;
}
.aisle-grid__walkway {
  height: 10px;
  margin: 3px 0;
  border-top: 1px solid #b8860b;
  border-bottom: 1px solid #b8860b;
  background: repeating-linear-gradient(
    45deg,
    #f0c869 0,
    #f0c869 3px,
    #d9a441 3px,
    #d9a441 6px
  );
}

.overflow-zone {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 10px;
  align-items: flex-start;
  min-height: 32px;
}
</style>
