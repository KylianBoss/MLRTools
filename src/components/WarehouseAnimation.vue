<template>
  <div class="scene-wrapper">
    <svg class="scene-svg" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="warehouseBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :style="`stop-color:${COLORS.skyTop}`" />
          <stop offset="100%" :style="`stop-color:${COLORS.skyBottom}`" />
        </linearGradient>
        <clipPath id="warehouseConvClip">
          <rect x="80" y="0" width="340" height="200" />
        </clipPath>
      </defs>

      <!-- Fond -->
      <rect width="800" height="200" fill="url(#warehouseBg)" />
      <!-- Sol -->
      <rect y="162" width="800" height="38" :fill="COLORS.ground" />
      <line x1="0" y1="162" x2="800" y2="162" :stroke="COLORS.groundLine" stroke-width="1.5" />

      <!-- ===== BÂTIMENT / TUNNEL (fond) ===== -->
      <rect x="0" y="95" width="90" height="70" :fill="COLORS.building" />
      <rect x="72" y="110" width="20" height="32" rx="3" :fill="COLORS.tunnelOpening" />
      <rect x="0" y="88" width="90" height="10" :fill="COLORS.buildingRoof" />
      <rect x="10" y="102" width="18" height="14" rx="1" :fill="COLORS.window" />
      <rect x="38" y="102" width="18" height="14" rx="1" :fill="COLORS.window" />

      <!-- ===== CONVOYEUR ===== -->
      <rect x="80" y="130" width="320" height="10" rx="2" :fill="COLORS.conveyor" />
      <line
        v-for="rx in convRollers" :key="rx"
        :x1="rx" y1="130" :x2="rx" y2="140"
        :stroke="COLORS.conveyorRoller" stroke-width="2"
      />
      <rect x="145" y="140" width="5" height="22" :fill="COLORS.conveyorLeg" />
      <rect x="290" y="140" width="5" height="22" :fill="COLORS.conveyorLeg" />
      <rect x="390" y="140" width="5" height="22" :fill="COLORS.conveyorLeg" />

      <!-- ===== ZONE TAMPON — petites tables au sol ===== -->
      <g v-for="(_, i) in SCENE.bufferSlotX" :key="'buf-table-'+i">
        <!-- Plateau -->
        <rect
          :x="SCENE.bufferSlotX[i] - 30" y="140"
          width="60" height="5" rx="1"
          :fill="COLORS.bufferMark"
        />
        <!-- Pied gauche -->
        <rect :x="SCENE.bufferSlotX[i] - 26" y="145" width="4" height="17" :fill="COLORS.bufferMark" />
        <!-- Pied droit -->
        <rect :x="SCENE.bufferSlotX[i] + 22" y="145" width="4" height="17" :fill="COLORS.bufferMark" />
      </g>

      <!-- ===== CAISSES SUR CONVOYEUR ===== -->
      <g clip-path="url(#warehouseConvClip)">
        <g v-for="box in conveyorBoxes" :key="box.id">
          <rect
            v-if="box.type === 'A' || box.type === 'B'"
            :x="box.x" :y="SCENE.convBoxY"
            :width="box.width" :height="SCENE.boxH"
            rx="2" :fill="box.type === 'A' ? COLORS.boxA : COLORS.boxB"
          />
          <rect
            v-if="box.type === 'E'"
            :x="box.x" :y="SCENE.convBoxY + SCENE.boxH / 2"
            :width="box.width" :height="SCENE.boxH / 2"
            rx="2" :fill="COLORS.boxE"
          />
          <template v-if="box.type === 'EB'">
            <rect :x="box.x" :y="SCENE.convBoxY + SCENE.boxH / 2"
              :width="box.width" :height="SCENE.boxH / 2" rx="2" :fill="COLORS.boxE" />
            <rect :x="box.x" :y="SCENE.convBoxY"
              :width="box.width" :height="SCENE.boxH / 2" rx="2" :fill="COLORS.boxE" />
            <line
              :x1="box.x" :y1="SCENE.convBoxY + SCENE.boxH / 2"
              :x2="box.x + box.width" :y2="SCENE.convBoxY + SCENE.boxH / 2"
              :stroke="COLORS.boxELine" stroke-width="1"
            />
          </template>
        </g>
      </g>

      <!-- ===== CAISSES EN ZONE TAMPON ===== -->
      <g v-for="(box, i) in bufferSlots" :key="'buf-box-'+i">
        <template v-if="box !== null">
          <rect
            v-if="box.type === 'A' || box.type === 'B'"
            :x="SCENE.bufferSlotX[i] - box.width / 2" :y="SCENE.bufferY"
            :width="box.width" :height="SCENE.boxH"
            rx="2" :fill="box.type === 'A' ? COLORS.boxA : COLORS.boxB"
          />
          <template v-if="box.type === 'EB'">
            <rect
              :x="SCENE.bufferSlotX[i] - box.width / 2" :y="SCENE.bufferY + SCENE.boxH / 2"
              :width="box.width" :height="SCENE.boxH / 2" rx="2" :fill="COLORS.boxE" />
            <rect
              :x="SCENE.bufferSlotX[i] - box.width / 2" :y="SCENE.bufferY"
              :width="box.width" :height="SCENE.boxH / 2" rx="2" :fill="COLORS.boxE" />
            <line
              :x1="SCENE.bufferSlotX[i] - box.width / 2" :y1="SCENE.bufferY + SCENE.boxH / 2"
              :x2="SCENE.bufferSlotX[i] + box.width / 2" :y2="SCENE.bufferY + SCENE.boxH / 2"
              :stroke="COLORS.boxELine" stroke-width="1"
            />
          </template>
        </template>
      </g>

      <!-- ===== PORTIQUE PICK & PLACE ===== -->
      <rect x="80" y="20" width="640" height="6" rx="2" :fill="COLORS.gantryRail" />

      <!-- Chariot -->
      <g :transform="`translate(${pickPlace.x}, 0)`">
        <rect x="-14" y="20" width="28" height="13" rx="2" :fill="COLORS.ppCart" />
        <!-- Bras -->
        <rect x="-4" y="33" width="8" :height="pickPlace.armLength" :fill="COLORS.ppArm" />
        <!-- Pince gauche -->
        <rect
          :x="-pickPlace.gripHalfW - 3"
          :y="33 + pickPlace.armLength - 2"
          :width="pickPlace.gripHalfW" height="4" rx="1"
          :fill="COLORS.ppGrip"
        />
        <!-- Pince droite -->
        <rect
          x="3"
          :y="33 + pickPlace.armLength - 2"
          :width="pickPlace.gripHalfW" height="4" rx="1"
          :fill="COLORS.ppGrip"
        />
        <!-- Caisse tenue A ou B -->
        <rect
          v-if="pickPlace.carriedBox && (pickPlace.carriedBox.type === 'A' || pickPlace.carriedBox.type === 'B')"
          :x="-pickPlace.carriedBox.width / 2"
          :y="33 + pickPlace.armLength + 2"
          :width="pickPlace.carriedBox.width" :height="SCENE.boxH"
          rx="2" :fill="pickPlace.carriedBox.type === 'A' ? COLORS.boxA : COLORS.boxB"
        />
        <!-- Caisse tenue E simple -->
        <rect
          v-if="pickPlace.carriedBox && pickPlace.carriedBox.type === 'E'"
          :x="-pickPlace.carriedBox.width / 2"
          :y="33 + pickPlace.armLength + 2"
          :width="pickPlace.carriedBox.width" :height="SCENE.boxH / 2"
          rx="2" :fill="COLORS.boxE"
        />
        <!-- Caisse tenue EB -->
        <template v-if="pickPlace.carriedBox && pickPlace.carriedBox.type === 'EB'">
          <rect
            :x="-pickPlace.carriedBox.width / 2"
            :y="33 + pickPlace.armLength + 2 + SCENE.boxH / 2"
            :width="pickPlace.carriedBox.width" :height="SCENE.boxH / 2"
            rx="2" :fill="COLORS.boxE"
          />
          <rect
            :x="-pickPlace.carriedBox.width / 2"
            :y="33 + pickPlace.armLength + 2"
            :width="pickPlace.carriedBox.width" :height="SCENE.boxH / 2"
            rx="2" :fill="COLORS.boxE"
          />
          <line
            :x1="-pickPlace.carriedBox.width / 2"
            :y1="33 + pickPlace.armLength + 2 + SCENE.boxH / 2"
            :x2="pickPlace.carriedBox.width / 2"
            :y2="33 + pickPlace.armLength + 2 + SCENE.boxH / 2"
            :stroke="COLORS.boxELine" stroke-width="1"
          />
        </template>
      </g>

      <!-- ===== PALETTE STATIQUE ===== -->
      <g v-if="!palette.leaving">
        <rect x="560" y="152" width="114" height="10" rx="1" :fill="COLORS.palletBase" />
        <!-- <rect x="566" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <!-- <rect x="610" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <!-- <rect x="654" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <g v-for="box in palette.boxes" :key="box.id">
          <rect
            v-if="box.type === 'A' || box.type === 'B'"
            :x="box.x" :y="box.y" :width="box.width" :height="SCENE.boxH"
            rx="1" :fill="box.type === 'A' ? COLORS.boxA : COLORS.boxB"
          />
          <template v-if="box.type === 'EB'">
            <rect :x="box.x" :y="box.y + SCENE.boxH / 2"
              :width="box.width" :height="SCENE.boxH / 2" rx="1" :fill="COLORS.boxE" />
            <rect :x="box.x" :y="box.y"
              :width="box.width" :height="SCENE.boxH / 2" rx="1" :fill="COLORS.boxE" />
            <line
              :x1="box.x" :y1="box.y + SCENE.boxH / 2"
              :x2="box.x + box.width" :y2="box.y + SCENE.boxH / 2"
              :stroke="COLORS.boxELine" stroke-width="1"
            />
          </template>
        </g>
      </g>

      <!-- ===== PALETTE QUI PART ===== -->
      <g v-if="palette.leaving" :transform="`translate(${palette.leaveX}, 0)`">
        <rect x="560" y="152" width="114" height="10" rx="1" :fill="COLORS.palletBase" />
        <!-- <rect x="566" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <!-- <rect x="610" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <!-- <rect x="654" y="144" width="12" height="10" :fill="COLORS.palletFoot" /> -->
        <g v-for="box in palette.boxes" :key="box.id">
          <rect
            v-if="box.type === 'A' || box.type === 'B'"
            :x="box.x" :y="box.y" :width="box.width" :height="SCENE.boxH"
            rx="1" :fill="box.type === 'A' ? COLORS.boxA : COLORS.boxB"
          />
          <template v-if="box.type === 'EB'">
            <rect :x="box.x" :y="box.y + SCENE.boxH / 2"
              :width="box.width" :height="SCENE.boxH / 2" rx="1" :fill="COLORS.boxE" />
            <rect :x="box.x" :y="box.y"
              :width="box.width" :height="SCENE.boxH / 2" rx="1" :fill="COLORS.boxE" />
            <line
              :x1="box.x" :y1="box.y + SCENE.boxH / 2"
              :x2="box.x + box.width" :y2="box.y + SCENE.boxH / 2"
              :stroke="COLORS.boxELine" stroke-width="1"
            />
          </template>
        </g>
      </g>

      <!-- ===== TUNNEL façade ===== -->
      <rect x="0" y="95" width="82" height="70" :fill="COLORS.building" />
      <rect x="0" y="88" width="90" height="10" :fill="COLORS.buildingRoof" />
      <rect x="10" y="102" width="18" height="14" rx="1" :fill="COLORS.window" />
      <rect x="38" y="102" width="18" height="14" rx="1" :fill="COLORS.window" />
      <rect x="72" y="110" width="15" height="32" rx="2" :fill="COLORS.tunnelOpening" />
    </svg>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";

// ─── Couleurs ─────────────────────────────────────────────────────────────────
const COLORS = {
  skyTop:         "#c8dcea",
  skyBottom:      "#e8f3fa",
  ground:         "#8fa8b8",
  groundLine:     "#6a8898",
  building:       "#2a3a45",
  buildingRoof:   "#1a2a35",
  tunnelOpening:  "#0d1a22",
  window:         "#3a5a6a",
  conveyor:       "#2196f3",
  conveyorRoller: "#ef5a51",
  conveyorLeg:    "#c9cdd1",
  boxA:           "#cc8400",
  boxB:           "#cc8400",
  boxE:           "#cc8400",
  boxELine:       "#9a6226",
  bufferMark:     "#4a6a7a",
  gantryRail:     "#c9cdd1",
  ppCart:         "#ffa500",
  ppArm:          "#000000",
  ppGrip:         "#1a3a20",
  palletBase:     "#ffa500",
  palletFoot:     "#1a2530",
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const SLOT_W     = 28;
const BOX_WIDTHS = { A: 26, B: 54, E: 54, EB: 54 };

// Géométrie verticale :
//   Sol          y=162
//   Tapis conv   dessus y=130, pieds jusqu'à y=162
//   Caisses conv DESSUS y=110, bas y=130        → convBoxY=110
//   Caisse E     DESSUS y=120, bas y=130        (demi-hauteur)
//   Table tampon plateau y=140, pieds→y=162
//   Caisses tampon DESSUS y=120, bas y=140      → bufferY=120
//   Palette base y=152, caisses étage0 DESSUS y=132
//   Chariot y=20, bas y=33, bras depuis y=33
//   Caisse tenue : DESSUS = 33 + armLength + 2  →  armLength = yDessus - 35

const ARM_BASE_Y = 33;
// armLengthFor(yDessus) : longueur pour que le DESSUS de la caisse tenue soit à yDessus
function armLengthFor(yDessus) { return yDessus - ARM_BASE_Y - 2; }

const SCENE = {
  convStart:        80,
  convPickupX:     400,
  convBoxY:        110,   // y du DESSUS des caisses A/B/EB sur convoyeur (bas=130)
  boxH:             20,
  convSpeed:        60,
  convSpacing:       5,
  ppSpeed:         500,
  armBase:          10,
  armSpeed:         250,
  // Zone tampon : plateau à y=140, caisses : dessus y=120, bas y=140
  bufferSlotX:     [435, 500],
  bufferY:         120,   // y du DESSUS des caisses en tampon (bas=140)
  // Palette — 4 slots × 28 = 112px, 5 étages
  palLeft:         562,
  // Caisses : bas sur la base palette (y=152), dessus y=132 → étages de 20px vers le haut
  palRows:   [132, 112, 92, 72, 52],
  palSlots:          4,
  palLeaveSpeed:   120,
  palLeaveDistance: 250,
};

// ─── Classes ──────────────────────────────────────────────────────────────────

class Box {
  constructor(id, type = "A") {
    this.id    = id;
    this.type  = type;
    this.width = BOX_WIDTHS[type];
    this.x     = 50;
    this.y     = undefined;
  }
}

class PickPlace {
  constructor() {
    this.x                 = SCENE.convPickupX;
    this.armLength         = SCENE.armBase;
    this.carriedBox        = null;
    this.state             = "idle";
    this._pickupX          = SCENE.convPickupX;
    this._depositX         = 615;
    this._pickupArmLength  = armLengthFor(SCENE.convBoxY);      // dessus caisse conv = 110
    this._depositArmLength = armLengthFor(SCENE.palRows[0]);    // dessus caisse pal étage0 = 132
  }

  /** Saisie A/B/EB sur convoyeur : dessus caisse = convBoxY = 110 */
  setPickupTarget(box) {
    this._pickupX = box.x + box.width / 2;
    this._pickupArmLength = armLengthFor(SCENE.convBoxY);
  }

  /** Saisie depuis tampon : dessus caisse = bufferY = 120 */
  setPickupTargetBuffer(bufIdx) {
    this._pickupX = SCENE.bufferSlotX[bufIdx];
    this._pickupArmLength = armLengthFor(SCENE.bufferY);
  }

  /** Saisie E simple : dessus = convBoxY + boxH/2 = 120 */
  setPickupTargetE(box) {
    this._pickupX = box.x + box.width / 2;
    this._pickupArmLength = armLengthFor(SCENE.convBoxY + SCENE.boxH / 2);
  }

  /** Dépôt palette : slot.y = dessus de la caisse à poser */
  setDepositTarget(slot) {
    this._depositX = slot.x + slot.width / 2;
    this._depositArmLength = armLengthFor(slot.y);
  }

  /** Dépôt tampon : dessus caisse = bufferY = 120 */
  setDepositTargetBuffer(bufIdx) {
    this._depositX = SCENE.bufferSlotX[bufIdx];
    this._depositArmLength = armLengthFor(SCENE.bufferY);
  }

  /** Stack E2 sur E1 : dessus de E2 = convBoxY + boxH/2 = 120 */
  setStackTarget(targetBox) {
    this._depositX = targetBox.x + targetBox.width / 2;
    this._depositArmLength = armLengthFor(SCENE.convBoxY + SCENE.boxH / 2);
  }

  get gripHalfW() { return Math.floor(BOX_WIDTHS.A / 2) + 1; }
}

class Palette {
  constructor() {
    this.boxes   = [];
    this.leaving = false;
    this.leaveX  = 0;
    this._grid   = Array.from({ length: 5 }, () => [null, null, null, null]);
  }

  _isSupported(row, col, slotsUsed) {
    if (row === 0) return true;
    const below = this._grid[row - 1];
    for (let s = 0; s < slotsUsed; s++) {
      if (below[col + s] === null) return false;
    }
    return true;
  }

  nextSlot(type) {
    const wide = type === "B" || type === "EB";
    for (let row = 0; row < 5; row++) {
      const g = this._grid[row];
      if (!wide) {
        for (let col = 0; col < SCENE.palSlots; col++) {
          if (g[col] === null && this._isSupported(row, col, 1))
            return this._makeSlot(row, col, type);
        }
      } else {
        for (let col = 0; col <= SCENE.palSlots - 2; col++) {
          if (g[col] === null && g[col + 1] === null && this._isSupported(row, col, 2))
            return this._makeSlot(row, col, type);
        }
      }
    }
    return null;
  }

  _makeSlot(row, col, type) {
    const wide = type === "B" || type === "EB";
    return {
      row, col, type,
      slotsUsed: wide ? 2 : 1,
      x: SCENE.palLeft + col * SLOT_W,
      y: SCENE.palRows[row],
      width: BOX_WIDTHS[type],
    };
  }

  deposit(box, slot) {
    box.x = slot.x;
    box.y = slot.y;
    this.boxes.push(box);
    const mark = (slot.type === "B" || slot.type === "EB") ? "B" : "A";
    for (let s = 0; s < slot.slotsUsed; s++)
      this._grid[slot.row][slot.col + s] = mark;
  }

  get isFull() { return this._grid.every(r => r.every(c => c !== null)); }

  reset() {
    this.boxes   = [];
    this.leaving = false;
    this.leaveX  = 0;
    this._grid   = Array.from({ length: 5 }, () => [null, null, null, null]);
  }
}

// ─── État réactif ─────────────────────────────────────────────────────────────
const convRollers   = [];
for (let x = 100; x <= 410; x += 30) convRollers.push(x);

const conveyorBoxes = ref([]);
const bufferSlots   = reactive([null, null]); // Box | null par slot
const pickPlace     = reactive(new PickPlace());
const palette       = reactive(new Palette());

let lastTime           = null;
let rafId              = null;
let boxCounter         = 0;
let timeSinceLastSpawn = 0;
const SPAWN_INTERVAL   = 2200;

let pendingSlot  = null;  // slot palette courant
let pendingBufIdx = -1;   // index tampon courant (-1 = aucun)

// ─── Randomizer ───────────────────────────────────────────────────────────────
let consecutiveB = 0;
let pendingE     = false;

function randomType() {
  if (pendingE) { pendingE = false; return "E"; }
  if (consecutiveB >= 2) { consecutiveB = 0; return "A"; }
  const r = Math.random();
  if (r < 0.2) { pendingE = true; return "E"; }
  if (r < 0.5) { consecutiveB++; return "B"; }
  consecutiveB = 0;
  return "A";
}

function spawnBox() {
  const box = new Box(boxCounter++, randomType());
  box.x = 50;
  conveyorBoxes.value.push(box);
}

// ─── Boucle principale ────────────────────────────────────────────────────────
function tick(ts) {
  if (lastTime === null) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;

  // 1. Avancer le convoyeur
  // La caisse en tête (index 0) est gelée si le bras est descendu (pas encore rétracté),
  // pour éviter qu'elle reparte sous le P&P pendant une prise ou un dépôt.
  const armBusy = pickPlace.armLength > SCENE.armBase + 1;
  for (let i = 0; i < conveyorBoxes.value.length; i++) {
    const box   = conveyorBoxes.value[i];
    const stopX = SCENE.convPickupX - box.width;
    const maxX  = i === 0
      ? stopX
      : conveyorBoxes.value[i - 1].x - box.width - SCENE.convSpacing;
    // Geler la tête si le bras est occupé au-dessus du convoyeur
    if (i === 0 && armBusy && pickPlace.x <= SCENE.convPickupX + 10) continue;
    if (box.x < maxX) box.x = Math.min(box.x + SCENE.convSpeed * dt, maxX);
  }

  // 2. Spawn
  if (!palette.leaving) {
    const last   = conveyorBoxes.value.at(-1);
    const minGap = (last?.width ?? 0) + SCENE.convSpacing + 10;
    if (!last || last.x > 50 + minGap) {
      timeSinceLastSpawn += dt * 1000;
      if (timeSinceLastSpawn >= SPAWN_INTERVAL) {
        timeSinceLastSpawn = 0;
        spawnBox();
      }
    }
  }

  // 3. P&P
  updatePickPlace(dt);

  // 4. Palette qui part
  if (palette.leaving) {
    palette.leaveX += SCENE.palLeaveSpeed * dt;
    if (palette.leaveX > SCENE.palLeaveDistance) {
      palette.reset();
      timeSinceLastSpawn = 0;
    }
  }

  rafId = requestAnimationFrame(tick);
}

// ─── Helpers de décision ──────────────────────────────────────────────────────

function isStopped(i) {
  const boxes = conveyorBoxes.value;
  const box   = boxes[i];
  const stopX = SCENE.convPickupX - box.width;
  if (i === 0) return box.x >= stopX - 1;
  const prev = boxes[i - 1];
  return box.x >= Math.min(stopX, prev.x - box.width - SCENE.convSpacing) - 1;
}

/** Deux E arrêtées en tête → empiler */
function shouldStack() {
  const boxes = conveyorBoxes.value;
  return (
    boxes.length >= 2 &&
    boxes[0].type === "E" && boxes[1].type === "E" &&
    isStopped(0) && isStopped(1)
  );
}

/**
 * Cherche la meilleure source (tampon ou convoyeur) pour alimenter la palette.
 * Retourne { source: 'buffer'|'conveyor', index, box, slot } ou null.
 */
function chooseCaisse() {
  const candidates = [];

  // --- Sources : tampon (priorité) ---
  for (let i = 0; i < 2; i++) {
    const box = bufferSlots[i];
    if (!box) continue;
    const slot = palette.nextSlot(box.type);
    if (slot) candidates.push({ source: "buffer", index: i, box, slot });
  }

  // --- Sources : convoyeur ---
  const boxes = conveyorBoxes.value;
  for (let i = 0; i < Math.min(boxes.length, 2); i++) {
    if (!isStopped(i)) continue;
    if (boxes[i].type === "E") continue; // E seule → doit être empilée d'abord
    const slot = palette.nextSlot(boxes[i].type);
    if (slot) candidates.push({ source: "conveyor", index: i, box: boxes[i], slot });
  }

  if (candidates.length === 0) return null;

  // Tri : rangée la plus basse, puis B/EB avant A, tampon avant convoyeur
  candidates.sort((a, b) => {
    if (a.slot.row !== b.slot.row) return a.slot.row - b.slot.row;
    const aWide = a.box.type === "B" || a.box.type === "EB" ? 0 : 1;
    const bWide = b.box.type === "B" || b.box.type === "EB" ? 0 : 1;
    if (aWide !== bWide) return aWide - bWide;
    if (a.source !== b.source) return a.source === "buffer" ? -1 : 1;
    return a.index - b.index;
  });

  return candidates[0];
}

/**
 * Cherche une caisse du convoyeur qu'on ne peut PAS placer sur la palette
 * mais qu'on peut mettre en tampon (libérer le convoyeur).
 * Retourne { convIdx, box, bufIdx } ou null.
 */
function chooseCaisseForBuffer() {
  // Si les deux slots tampon sont pleins → pas de place
  const freeBuf = bufferSlots.findIndex(s => s === null);
  if (freeBuf === -1) return null;

  const boxes = conveyorBoxes.value;
  for (let i = 0; i < Math.min(boxes.length, 2); i++) {
    if (!isStopped(i)) continue;
    if (boxes[i].type === "E") continue; // E seule non acceptée en tampon
    // Si elle peut déjà aller sur palette → ce n'est pas son rôle d'aller en tampon
    if (palette.nextSlot(boxes[i].type)) continue;
    return { convIdx: i, box: boxes[i], bufIdx: freeBuf };
  }
  return null;
}

// ─── Profil trapézoïdal ───────────────────────────────────────────────────────
// Paramètres : accélération et décélération identiques.
const ACCEL_X   = 1000;  // px/s²  chariot horizontal
const ACCEL_ARM = 800;  // px/s²  bras vertical

/**
 * Déplace `current` vers `target` avec profil trapézoïdal.
 * `traveled` : distance déjà parcourue depuis le début du mouvement (>= 0).
 * Retourne { pos, traveled, done }.
 */
function trapMove(current, target, traveled, vMax, accel, dt) {
  const remaining = Math.abs(target - current);
  if (remaining < 0.5) return { pos: target, traveled, done: true };

  const total    = traveled + remaining;
  const dAccel   = (vMax * vMax) / (2 * accel);          // distance pour atteindre vMax
  // Vitesse à la position `traveled` dans le profil
  const fromStart = Math.sqrt(2 * accel * traveled);
  const fromEnd   = Math.sqrt(2 * accel * remaining);
  const v = Math.min(vMax, fromStart, fromEnd);
  const step = Math.min(v * dt + 0.5 * accel * dt * dt, remaining); // pas max = remaining
  const newTraveled = traveled + step;
  const newPos = current + Math.sign(target - current) * step;
  return { pos: newPos, traveled: newTraveled, done: step >= remaining - 0.5 };
}

// ─── State machine ────────────────────────────────────────────────────────────
let targetIndex = 0;
// Distance parcourue pour le mouvement en cours (chariot et bras séparément)
let traveledX   = 0;
let traveledArm = 0;

function startMove() { traveledX = 0; traveledArm = 0; }

/** Déplace le chariot vers target, retourne true quand arrivé */
function moveX(pp, target, dt) {
  const r = trapMove(pp.x, target, traveledX, SCENE.ppSpeed, ACCEL_X, dt);
  pp.x = r.pos; traveledX = r.traveled;
  if (r.done) { pp.x = target; return true; }
  return false;
}

/** Déplace le bras vers target, retourne true quand arrivé */
function moveArm(pp, target, dt) {
  const r = trapMove(pp.armLength, target, traveledArm, SCENE.armSpeed, ACCEL_ARM, dt);
  pp.armLength = r.pos; traveledArm = r.traveled;
  if (r.done) { pp.armLength = target; return true; }
  return false;
}

function updatePickPlace(dt) {
  const pp = pickPlace;

  switch (pp.state) {

    case "idle": {
      // Priorité 1 : empiler une paire E
      if (shouldStack()) {
        const boxes = conveyorBoxes.value;
        pp.setPickupTargetE(boxes[1]);
        pp.setStackTarget(boxes[0]);
        targetIndex = 1;
        startMove();
        pp.state = "going-stack-pickup";
        break;
      }

      // Priorité 2 : déposer sur la palette (depuis tampon ou convoyeur)
      const chosen = chooseCaisse();
      if (chosen) {
        pendingSlot   = chosen.slot;
        pendingBufIdx = chosen.source === "buffer" ? chosen.index : -1;
        targetIndex   = chosen.index;
        if (chosen.source === "buffer") pp.setPickupTargetBuffer(chosen.index);
        else pp.setPickupTarget(chosen.box);
        pp.setDepositTarget(pendingSlot);
        startMove();
        pp.state = "going-pickup";
        break;
      }

      // Priorité 3 : mettre en tampon une caisse bloquante
      const toBuf = chooseCaisseForBuffer();
      if (toBuf) {
        targetIndex   = toBuf.convIdx;
        pendingBufIdx = toBuf.bufIdx;
        pp.setPickupTarget(toBuf.box);
        pp.setDepositTargetBuffer(toBuf.bufIdx);
        startMove();
        pp.state = "going-pickup-to-buffer";
        break;
      }
      break;
    }

    // ══ Stacking E ══════════════════════════════════════════════════════════

    case "going-stack-pickup": {
      if (moveX(pp, pp._pickupX, dt)) { startMove(); pp.state = "stack-picking"; }
      break;
    }
    case "stack-picking": {
      if (moveArm(pp, pp._pickupArmLength, dt)) {
        const box = conveyorBoxes.value.splice(targetIndex, 1)[0];
        if (box) pp.carriedBox = box;
        targetIndex = 0; startMove();
        pp.state = "stack-retracting-pickup";
      }
      break;
    }
    case "stack-retracting-pickup": {
      if (moveArm(pp, SCENE.armBase, dt)) { startMove(); pp.state = "going-stack-deposit"; }
      break;
    }
    case "going-stack-deposit": {
      if (moveX(pp, pp._depositX, dt)) { startMove(); pp.state = "stack-depositing"; }
      break;
    }
    case "stack-depositing": {
      if (moveArm(pp, pp._depositArmLength, dt)) {
        const eBottom = conveyorBoxes.value[0];
        if (eBottom && pp.carriedBox) {
          const eb = new Box(eBottom.id, "EB");
          eb.x = eBottom.x;
          conveyorBoxes.value.splice(0, 1, eb);
        }
        pp.carriedBox = null; startMove();
        pp.state = "stack-retracting-deposit";
      }
      break;
    }
    case "stack-retracting-deposit": {
      if (moveArm(pp, SCENE.armBase, dt)) { startMove(); pp.state = "returning"; }
      break;
    }

    // ══ Mise en tampon ══════════════════════════════════════════════════════

    case "going-pickup-to-buffer": {
      if (moveX(pp, pp._pickupX, dt)) { startMove(); pp.state = "picking-to-buffer"; }
      break;
    }
    case "picking-to-buffer": {
      if (moveArm(pp, pp._pickupArmLength, dt)) {
        const box = conveyorBoxes.value.splice(targetIndex, 1)[0];
        if (box) pp.carriedBox = box;
        targetIndex = 0; startMove();
        pp.state = "retracting-to-buffer";
      }
      break;
    }
    case "retracting-to-buffer": {
      if (moveArm(pp, SCENE.armBase, dt)) { startMove(); pp.state = "going-deposit-buffer"; }
      break;
    }
    case "going-deposit-buffer": {
      if (moveX(pp, pp._depositX, dt)) { startMove(); pp.state = "depositing-buffer"; }
      break;
    }
    case "depositing-buffer": {
      if (moveArm(pp, pp._depositArmLength, dt)) {
        if (pp.carriedBox && pendingBufIdx >= 0) bufferSlots[pendingBufIdx] = pp.carriedBox;
        pp.carriedBox = null; pendingBufIdx = -1; startMove();
        pp.state = "retracting-deposit";
      }
      break;
    }

    // ══ Dépôt palette (convoyeur ou tampon) ═════════════════════════════════

    case "going-pickup": {
      if (moveX(pp, pp._pickupX, dt)) { startMove(); pp.state = "picking"; }
      break;
    }
    case "picking": {
      if (moveArm(pp, pp._pickupArmLength, dt)) {
        let box;
        if (pendingBufIdx >= 0) {
          box = bufferSlots[pendingBufIdx];
          bufferSlots[pendingBufIdx] = null;
        } else {
          box = conveyorBoxes.value.splice(targetIndex, 1)[0];
          targetIndex = 0;
        }
        if (box) pp.carriedBox = box;
        startMove();
        pp.state = "retracting-pickup";
      }
      break;
    }
    case "retracting-pickup": {
      if (moveArm(pp, SCENE.armBase, dt)) { startMove(); pp.state = "going-deposit"; }
      break;
    }
    case "going-deposit": {
      if (moveX(pp, pp._depositX, dt)) { startMove(); pp.state = "depositing"; }
      break;
    }
    case "depositing": {
      if (moveArm(pp, pp._depositArmLength, dt)) {
        if (pp.carriedBox && pendingSlot) palette.deposit(pp.carriedBox, pendingSlot);
        pp.carriedBox = null; pendingSlot = null; pendingBufIdx = -1; startMove();
        pp.state = "retracting-deposit";
      }
      break;
    }
    case "retracting-deposit": {
      if (moveArm(pp, SCENE.armBase, dt)) {
        startMove();
        if (palette.isFull) { palette.leaving = true; pp.state = "idle"; }
        else pp.state = "returning";
      }
      break;
    }
    case "returning": {
      const homeX = SCENE.convPickupX - BOX_WIDTHS.A / 2;
      if (moveX(pp, homeX, dt)) { pp.state = "idle"; }
      break;
    }
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  spawnBox();
  conveyorBoxes.value[0].x = 220;
  spawnBox();
  conveyorBoxes.value[1].x = 100;
  rafId = requestAnimationFrame(tick);
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<style scoped>
.scene-wrapper {
  width: calc(100% - 24px);
  overflow: hidden;
  border-radius: 8px;
  margin: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.scene-svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>
