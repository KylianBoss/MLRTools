import dayjs from "dayjs";
import { Op } from "sequelize";

const GAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Applique les règles de groupement automatique pour une date donnée.
 * Charge les règles depuis la DB, cluster les alarmes non traitées/non groupées,
 * crée les groupes et marque les alarmes comme traitées.
 *
 * @param {dayjs.Dayjs} targetDate - La date cible (objet dayjs)
 * @param {object} db - Instance de la DB (getDB())
 * @returns {{ created: number, failed: number }}
 */
export const autoGroupAlarms = async (targetDate, db) => {
  // 1. Charger les règles actives depuis la DB
  const rules = await db.models.AutoGroupRules.findAll({
    where: { enabled: true },
    order: [["id", "ASC"]],
  });

  // 2. Charger les alarmes primaires non groupées/non traitées du jour cible
  const primaryAlarms = await db.models.Alarms.findAll({
    where: { type: "primary" },
    attributes: ["alarmId"],
  }).then((rows) => rows.map((a) => a.alarmId));

  const MIN_ALARM_DURATION = await db.models.Settings.getValue("MIN_ALARM_DURATION");

  const dayRange = [
    targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
    targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
  ];

  const candidates = await db.models.Datalog.findAll({
    where: {
      x_group: null,
      x_treated: false,
      alarmId: primaryAlarms,
      duration: { [Op.gte]: MIN_ALARM_DURATION },
      timeOfOccurence: { [Op.between]: dayRange },
    },
    order: [["timeOfOccurence", "ASC"]],
  });

  // 2bis. Pool séparé pour les déclencheurs de règles "trigger" : toutes
  // catégories d'alarme confondues (y compris 'human'), sans le filtre de
  // durée minimale (un événement type "porte ouverte" peut être bref).
  const triggerRuleIds = rules
    .filter((r) => r.action === "trigger" && r.triggerAlarmId)
    .map((r) => r.triggerAlarmId);

  const triggerPool = triggerRuleIds.length
    ? await db.models.Datalog.findAll({
        where: {
          x_group: null,
          x_treated: false,
          alarmId: triggerRuleIds,
          timeOfOccurence: { [Op.between]: dayRange },
        },
        order: [["timeOfOccurence", "ASC"]],
      })
    : [];

  // 3. Construire les proposals (même logique que le frontend)
  const proposals = [];
  const usedDbIds = new Set();

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

  const resolveComment = (cluster) => {
    for (const rule of rules) {
      if (cluster.some((a) => matchesRule(a, rule))) {
        return rule.comment;
      }
    }
    return null;
  };

  const buildClusters = (alarmList) => {
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

  // Règles "treat" d'abord
  for (const rule of rules) {
    if (rule.action !== "treat") continue;

    const matchingAlarms = candidates.filter(
      (a) => matchesRule(a, rule) && !usedDbIds.has(a.dbId)
    );

    if (matchingAlarms.length === 0) continue;

    matchingAlarms.forEach((a) => usedDbIds.add(a.dbId));
    proposals.push({ type: "treat", alarms: matchingAlarms, comment: rule.comment });
  }

  // Règles "trigger" : une alarme déclencheuse (identifiée par son alarmId
  // exact, ex: interrupteur à clé) capture toutes les alarmes d'une zone
  // (paires précises dataSource+alarmArea) sur toute la durée de l'incident :
  // on remonte jusqu'au début de la chaîne d'alarmes déjà en cours dans la
  // zone à l'instant du déclencheur (l'ouverture de porte suit déjà une
  // erreur), puis on étend jusqu'à sa clôture + une marge après.
  for (const rule of rules) {
    if (rule.action !== "trigger" || !rule.zone?.length || !rule.triggerAlarmId) continue;

    const triggers = triggerPool.filter(
      (a) =>
        a.alarmId === rule.triggerAlarmId &&
        (rule.dataSourceFilter ? a.dataSource === rule.dataSourceFilter : true) &&
        !usedDbIds.has(a.dbId)
    );
    if (triggers.length === 0) continue;

    const windowAfterMs = rule.windowAfterMs ?? 120000;
    const inZone = (a) =>
      rule.zone.some((z) => z.dataSource === a.dataSource && z.alarmArea === a.alarmArea);
    const zoneCandidates = candidates
      .filter(inZone)
      .sort((a, b) => new Date(a.timeOfOccurence) - new Date(b.timeOfOccurence));

    for (const trigger of triggers) {
      if (usedDbIds.has(trigger.dbId)) continue; // déjà absorbée par un trigger précédent

      const triggerStart = new Date(trigger.timeOfOccurence).getTime();
      const triggerEnd =
        new Date(trigger.timeOfAcknowledge || trigger.timeOfOccurence).getTime() + windowAfterMs;

      // Remonte la chaîne d'alarmes de la zone déjà connectées (gap <= GAP_MS)
      // qui touche l'instant du déclencheur, pour englober l'incident déjà en
      // cours avant l'ouverture de la porte.
      let windowStart = triggerStart;
      for (let i = zoneCandidates.length - 1; i >= 0; i--) {
        const a = zoneCandidates[i];
        if (usedDbIds.has(a.dbId)) continue;
        const aStart = new Date(a.timeOfOccurence).getTime();
        const aEnd = new Date(a.timeOfAcknowledge || a.timeOfOccurence).getTime();
        if (aStart > windowStart) continue; // pas encore atteint l'instant du trigger
        if (windowStart - aEnd > GAP_MS) break; // rupture de chaîne, on arrête de remonter
        windowStart = Math.min(windowStart, aStart);
      }

      // Étend en avant : toute alarme de la zone qui s'enchaîne (gap <= GAP_MS)
      // depuis la fenêtre courante est absorbée, jusqu'à triggerEnd inclus.
      let windowEnd = triggerEnd;
      let extended = true;
      while (extended) {
        extended = false;
        for (const a of zoneCandidates) {
          if (usedDbIds.has(a.dbId)) continue;
          const aStart = new Date(a.timeOfOccurence).getTime();
          if (aStart < windowStart || aStart > windowEnd + GAP_MS) continue;
          const aEnd = new Date(a.timeOfAcknowledge || a.timeOfOccurence).getTime() + windowAfterMs;
          if (aEnd > windowEnd) {
            windowEnd = aEnd;
            extended = true;
          }
        }
      }

      const captured = zoneCandidates.filter((a) => {
        if (usedDbIds.has(a.dbId)) return false;
        const t = new Date(a.timeOfOccurence).getTime();
        return t >= windowStart && t <= windowEnd;
      });

      captured.push(trigger);
      if (captured.length < 2) continue;

      captured.forEach((a) => usedDbIds.add(a.dbId));
      proposals.push({ type: "group", alarms: captured, comment: rule.comment });
    }
  }

  // Règles "group" zone
  for (const rule of rules) {
    if (rule.action !== "group" || rule.groupBy !== "zone" || !rule.zone) continue;

    // Toutes les alarmes des zones listées (pas encore utilisées)
    const allZoneAlarms = candidates.filter(
      (a) => rule.zone.includes(a.dataSource) && !usedDbIds.has(a.dbId)
    );

    for (const cluster of buildClusters(allZoneAlarms)) {
      // N'activer le groupe que si au moins une alarme du cluster déclenche la règle
      if (!cluster.some((a) => matchesRule(a, rule))) continue;

      cluster.forEach((a) => usedDbIds.add(a.dbId));
      proposals.push({ type: "group", alarms: cluster, comment: rule.comment });
    }
  }

  // Règles "group" location actives (avec critères)
  for (const rule of rules) {
    if (rule.action !== "group" || rule.groupBy !== "location") continue;
    if (!rule.keyword && !rule.alarmCodePattern && !rule.dataSourceFilter) continue;

    const ruleAlarms = candidates.filter(
      (a) => !usedDbIds.has(a.dbId) && (rule.dataSourceFilter ? a.dataSource === rule.dataSourceFilter : true)
    );

    const byLoc = {};
    ruleAlarms.forEach((a) => {
      const key = `${a.dataSource}.${a.alarmArea}`;
      if (!byLoc[key]) byLoc[key] = [];
      byLoc[key].push(a);
    });

    for (const locationAlarms of Object.values(byLoc)) {
      for (const cluster of buildClusters(locationAlarms)) {
        if (!cluster.some((a) => matchesRule(a, rule))) continue;
        cluster.forEach((a) => usedDbIds.add(a.dbId));
        proposals.push({ type: "group", alarms: cluster, comment: rule.comment });
      }
    }
  }

  // Fallback : groupement temporel par emplacement
  const remaining = candidates.filter((a) => !usedDbIds.has(a.dbId));
  const byLocation = {};
  remaining.forEach((a) => {
    const key = `${a.dataSource}.${a.alarmArea}`;
    if (!byLocation[key]) byLocation[key] = [];
    byLocation[key].push(a);
  });

  for (const locationAlarms of Object.values(byLocation)) {
    for (const cluster of buildClusters(locationAlarms)) {
      proposals.push({ type: "group", alarms: cluster, comment: resolveComment(cluster) });
    }
  }

  // 4. Appliquer les proposals en DB
  let created = 0;
  let failed = 0;

  for (const proposal of proposals) {
    const dbIds = proposal.alarms.map((a) => a.dbId);
    try {
      if (proposal.type === "treat") {
        if (proposal.comment) {
          for (const dbId of dbIds) {
            await db.models.Datalog.update({ x_comment: proposal.comment }, { where: { dbId } });
          }
        }
        await db.models.Datalog.update({ x_treated: true }, { where: { dbId: dbIds } });
        created++;
      } else {
        // type === "group"
        const maxGroup = await db.models.Datalog.max("x_group");
        const groupId = (maxGroup || 0) + 1;

        await db.models.Datalog.update({ x_group: groupId }, { where: { dbId: dbIds } });

        const effectiveComment = proposal.comment || proposal.alarms[0]?.alarmText || null;
        if (effectiveComment) {
          await db.models.Datalog.update({ x_comment: effectiveComment }, { where: { dbId: dbIds[0] } });
        }

        await db.models.Datalog.update({ x_state: "unplanned", x_treated: true }, { where: { dbId: dbIds } });
        created++;
      }
    } catch {
      failed++;
    }
  }

  return { created, failed };
};
