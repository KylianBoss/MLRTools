<template>
  <div
    class="stingray-icon"
    :class="{ 'stingray-icon--placeholder': placeholder }"
    :style="{ width: size + 'px' }"
    @click="!placeholder && $emit('click')"
  >
    <svg viewBox="0 0 400 140" width="100%" role="img" :aria-label="placeholder ? 'Emplacement libre' : `Stingray ${paddedNumber}`">
      <!-- roues -->
      <circle cx="36" cy="114" r="14" fill="#0a3d91" />
      <circle cx="36" cy="114" r="4.5" fill="#ffffff" />
      <circle cx="364" cy="114" r="14" fill="#0a3d91" />
      <circle cx="364" cy="114" r="4.5" fill="#ffffff" />
      <!-- corps -->
      <rect x="10" y="22" width="380" height="88" rx="22" fill="#1f6fd6" stroke="#0a3d91" stroke-width="1.5" />
      <!-- chevrons + bandeau -->
      <g fill="#ffffff">
        <path d="M104 22 L62 22 L14 66 L14 110 L31 110 L31 75 L78 40 L104 40 Z" />
        <path d="M296 22 L338 22 L386 66 L386 110 L369 110 L369 75 L322 40 L296 40 Z" />
        <template v-if="showDetailChevrons">
          <path d="M50 110 L62 74 L68 74 L56 110 Z" />
          <path d="M65 110 L76 80 L82 80 L71 110 Z" />
          <path d="M80 110 L90 86 L96 86 L86 110 Z" />
          <path d="M350 110 L338 74 L332 74 L344 110 Z" />
          <path d="M335 110 L324 80 L318 80 L329 110 Z" />
          <path d="M320 110 L310 86 L304 86 L314 110 Z" />
        </template>
        <rect x="100" y="26" width="200" height="7" rx="3.5" fill="#dce8fa" />
      </g>
      <!-- numéro -->
      <text
        x="200"
        y="76"
        text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="40"
        font-weight="700"
        letter-spacing="2"
        fill="#ffffff"
      >{{ placeholder ? "STINGRAY" : `SH ${paddedNumber}` }}</text>
    </svg>

    <div v-if="showBadge && badgeLabel" class="stingray-icon__badge" :class="`bg-${badgeColor}`">
      {{ badgeLabel }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  number: { type: [Number, String], default: null },
  state: { type: String, default: null },
  alarmLevel: { type: String, default: null },
  size: { type: [Number, String], default: 72 },
  showBadge: { type: Boolean, default: true },
  placeholder: { type: Boolean, default: false },
});
defineEmits(["click"]);

const paddedNumber = computed(() => String(props.number ?? "").padStart(3, "0"));

// En-dessous de ~90px de large les chevrons de détail (3 par côté) deviennent
// des traits sub-pixel illisibles : on garde uniquement les 2 grands chevrons
// d'angle + le bandeau + les roues, qui restent reconnaissables en miniature.
const showDetailChevrons = computed(() => Number(props.size) >= 90);

const ALARM_LABELS = { ok: "OK", warning: "Attn", critical: "Alerte" };
const ALARM_COLORS = { ok: "positive", warning: "orange", critical: "negative" };
const STATE_LABELS = { maintenance: "Atelier", out_of_service: "HS", spare: "Stock" };
const STATE_COLORS = { maintenance: "orange", out_of_service: "negative", spare: "grey-7" };

// Priorité à l'alarme quand le stingray est en service (c'est ce qui demande
// une action) ; sinon on affiche son état (Atelier / Hors service / Stock).
const badgeLabel = computed(() => {
  if (props.state === "in_service" && props.alarmLevel && props.alarmLevel !== "ok") {
    return ALARM_LABELS[props.alarmLevel] || null;
  }
  if (props.state === "in_service") return null;
  return STATE_LABELS[props.state] || null;
});
const badgeColor = computed(() => {
  if (props.state === "in_service" && props.alarmLevel && props.alarmLevel !== "ok") {
    return ALARM_COLORS[props.alarmLevel] || "grey-7";
  }
  return STATE_COLORS[props.state] || "grey-7";
});
</script>

<style scoped>
.stingray-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease;
}
.stingray-icon:hover {
  transform: scale(1.06);
}
.stingray-icon--placeholder {
  opacity: 0.12;
  cursor: default;
}
.stingray-icon--placeholder:hover {
  transform: none;
}
.stingray-icon__badge {
  margin-top: 2px;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 10px;
  line-height: 16px;
  color: #ffffff;
  white-space: nowrap;
}
</style>
