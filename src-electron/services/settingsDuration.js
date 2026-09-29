/**
 * Système harmonisé de settings "durée" (Settings.value au format texte
 * libre, ex: "5 min", "10 sec", "2 heures", "7 jours") plutôt que des
 * nombres bruts dont l'unité était encodée dans le nom de la clé
 * (ex: AUTO_GROUP_DATASOURCE_GAP_MS) ou sa description.
 *
 * Le nom de clé et la description ne portent plus d'unité : c'est la
 * valeur elle-même qui la précise, modifiable depuis la page Settings
 * sans avoir à connaître l'unité de stockage interne.
 */

const MS_PER_UNIT = {
  s: 1000,
  min: 60 * 1000,
  h: 60 * 60 * 1000,
  j: 24 * 60 * 60 * 1000,
};

// Alias reconnus en saisie libre -> unité canonique (s, min, h, j)
const UNIT_ALIASES = {
  s: "s",
  sec: "s",
  secs: "s",
  seconde: "s",
  secondes: "s",
  min: "min",
  mins: "min",
  minute: "min",
  minutes: "min",
  h: "h",
  hr: "h",
  hrs: "h",
  heure: "h",
  heures: "h",
  j: "j",
  jour: "j",
  jours: "j",
  d: "j",
  day: "j",
  days: "j",
};

/**
 * Parse un texte de durée libre, ex: "5 min", "10sec", "2 heures", "7 jours".
 * @param {string} text
 * @returns {{ amount: number, unit: 's'|'min'|'h'|'j' } | null}
 */
export const parseDurationText = (text) => {
  if (text == null) return null;
  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^([0-9]+(?:[.,][0-9]+)?)\s*([a-zéû]+)$/i);
  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  const unit = UNIT_ALIASES[match[2]];
  if (!Number.isFinite(amount) || !unit) return null;

  return { amount, unit };
};

/**
 * Formate une durée en millisecondes vers le texte lisible le plus adapté
 * (ex: 300000 -> "5 min", 604800000 -> "7 jours").
 * @param {number} ms
 * @returns {string}
 */
export const formatDurationMs = (ms) => {
  if (!Number.isFinite(ms)) return "";
  const abs = Math.abs(ms);

  if (abs !== 0 && abs % MS_PER_UNIT.j === 0) {
    const n = ms / MS_PER_UNIT.j;
    return `${n} jour${Math.abs(n) > 1 ? "s" : ""}`;
  }
  if (abs !== 0 && abs % MS_PER_UNIT.h === 0) {
    const n = ms / MS_PER_UNIT.h;
    return `${n} heure${Math.abs(n) > 1 ? "s" : ""}`;
  }
  if (abs !== 0 && abs % MS_PER_UNIT.min === 0) {
    return `${ms / MS_PER_UNIT.min} min`;
  }
  if (abs !== 0 && abs % MS_PER_UNIT.s === 0) {
    return `${ms / MS_PER_UNIT.s} sec`;
  }
  return `${ms} ms`;
};

/**
 * Convertit une durée textuelle ("5 min") vers l'unité de sortie demandée.
 * @param {string} text
 * @param {'ms'|'s'|'min'|'h'|'days'} outputUnit
 * @returns {number|null}
 */
export const convertDurationText = (text, outputUnit) => {
  const parsed = parseDurationText(text);
  if (!parsed) return null;

  const ms = parsed.amount * MS_PER_UNIT[parsed.unit];
  switch (outputUnit) {
    case "ms":
      return ms;
    case "s":
      return ms / MS_PER_UNIT.s;
    case "min":
      return ms / MS_PER_UNIT.min;
    case "h":
      return ms / MS_PER_UNIT.h;
    case "days":
      return ms / MS_PER_UNIT.j;
    default:
      throw new Error(`Unité de sortie inconnue: ${outputUnit}`);
  }
};

/**
 * Lit un setting "durée" en DB et le convertit vers l'unité demandée.
 * Tolère l'ancien format legacy (nombre brut sans unité) via
 * `legacyUnit` — l'unité dans laquelle ce nombre brut était stocké avant
 * la migration vers le format texte, pour ne pas casser un call-site tant
 * que sa clé n'a pas été migrée.
 *
 * @param {object} db - instance getDB()
 * @param {string} key
 * @param {'ms'|'s'|'min'|'h'|'days'} outputUnit
 * @param {{ legacyUnit?: 'ms'|'s'|'min'|'h'|'days', fallback?: number }} [options]
 * @returns {Promise<number|null>}
 */
export const getDurationSetting = async (db, key, outputUnit, options = {}) => {
  const raw = await db.models.Settings.getValue(key);
  if (raw == null) return options.fallback ?? null;

  const converted = convertDurationText(raw, outputUnit);
  if (converted != null) return converted;

  // Legacy : valeur numérique brute stockée avant migration vers le texte,
  // dans l'unité où le call-site la lisait historiquement (ex: ms pour
  // une clé qui s'appelait *_MS).
  const legacyNumber = Number(raw);
  if (Number.isFinite(legacyNumber) && options.legacyUnit) {
    const legacyMsPerUnit = { ms: 1, s: MS_PER_UNIT.s, min: MS_PER_UNIT.min, h: MS_PER_UNIT.h, days: MS_PER_UNIT.j };
    const outputMsPerUnit = legacyMsPerUnit; // mêmes clés que outputUnit
    const ms = legacyNumber * legacyMsPerUnit[options.legacyUnit];
    return ms / (outputMsPerUnit[outputUnit] ?? 1);
  }

  return options.fallback ?? null;
};
