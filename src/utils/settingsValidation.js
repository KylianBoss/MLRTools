/**
 * Validation de saisie pour la page Settings admin, par type de clé
 * (Settings.type : 'text' | 'number' | 'date' | 'duration' | 'secret').
 *
 * Miroir volontairement minimal (parsing seul, pas de conversion) de
 * src-electron/routes/Settings.routes.js — le frontend ne peut pas importer
 * depuis src-electron (bundles séparés) ; la source de vérité pour la
 * validation reste côté backend (revalidée dans PUT /settings/:key).
 */

const DURATION_UNIT_ALIASES = new Set([
  "s",
  "sec",
  "secs",
  "seconde",
  "secondes",
  "min",
  "mins",
  "minute",
  "minutes",
  "h",
  "hr",
  "hrs",
  "heure",
  "heures",
  "j",
  "jour",
  "jours",
  "d",
  "day",
  "days",
]);

/**
 * @param {string} text
 * @returns {boolean} true si le texte est une durée valide, ex: "5 min"
 */
export const isValidDurationText = (text) => {
  if (text == null) return false;
  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^([0-9]+(?:[.,][0-9]+)?)\s*([a-zéû]+)$/i);
  if (!match) return false;
  return DURATION_UNIT_ALIASES.has(match[2]);
};

/**
 * @param {string} text
 * @returns {boolean} true si le texte est un nombre valide
 */
export const isValidNumberText = (text) => text != null && text !== "" && Number.isFinite(Number(text));

/**
 * @param {string} text
 * @returns {boolean} true si le texte est une date ISO valide (AAAA-MM-JJ)
 */
export const isValidDateText = (text) =>
  typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(text).getTime());

// Settings.type -> { validate, rule, hint } pour piloter le q-input du
// dialog d'édition (règle Quasar + texte d'aide)
export const SETTING_TYPE_VALIDATORS = {
  duration: {
    validate: isValidDurationText,
    rule: (val) => isValidDurationText(val) || "Format attendu, ex: 5 min, 10 sec, 7 jours",
    hint: "Format attendu, ex: 5 min, 10 sec, 7 jours",
  },
  number: {
    validate: isValidNumberText,
    rule: (val) => isValidNumberText(val) || "Valeur numérique attendue",
    hint: "Valeur numérique",
  },
  date: {
    validate: isValidDateText,
    rule: (val) => isValidDateText(val) || "Format attendu : AAAA-MM-JJ",
    hint: "Format attendu : AAAA-MM-JJ",
  },
};
