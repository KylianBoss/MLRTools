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

  const candidates = await db.models.Datalog.findAll({
    where: {
      x_group: null,
      x_treated: false,
      alarmId: primaryAlarms,
      duration: { [Op.gte]: MIN_ALARM_DURATION },
      timeOfOccurence: {
        [Op.between]: [
          targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
          targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
        ],
      },
    },
    order: [["timeOfOccurence", "ASC"]],
  });

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
