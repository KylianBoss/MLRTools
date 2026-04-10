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

  const resolveComment = (cluster) => {
    for (const rule of rules) {
      if (cluster.some((a) => a.alarmText.toLowerCase().includes(rule.keyword.toLowerCase()))) {
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

  // Règles zone d'abord
  for (const rule of rules) {
    if (rule.groupBy !== "zone" || !rule.zone) continue;

    const zoneAlarms = candidates.filter(
      (a) =>
        a.alarmText.toLowerCase().includes(rule.keyword.toLowerCase()) &&
        rule.zone.includes(a.dataSource) &&
        !usedDbIds.has(a.dbId)
    );

    for (const cluster of buildClusters(zoneAlarms)) {
      cluster.forEach((a) => usedDbIds.add(a.dbId));
      proposals.push({ alarms: cluster, comment: rule.comment });
    }
  }

  // Règles location (par dataSource + alarmArea)
  const remaining = candidates.filter((a) => !usedDbIds.has(a.dbId));
  const byLocation = {};
  remaining.forEach((a) => {
    const key = `${a.dataSource}.${a.alarmArea}`;
    if (!byLocation[key]) byLocation[key] = [];
    byLocation[key].push(a);
  });

  for (const locationAlarms of Object.values(byLocation)) {
    for (const cluster of buildClusters(locationAlarms)) {
      proposals.push({ alarms: cluster, comment: resolveComment(cluster) });
    }
  }

  // 4. Créer les groupes en DB
  let created = 0;
  let failed = 0;

  for (const proposal of proposals) {
    const dbIds = proposal.alarms.map((a) => a.dbId);
    try {
      // Créer le groupe
      const maxGroup = await db.models.Datalog.max("x_group");
      const groupId = (maxGroup || 0) + 1;

      await db.models.Datalog.update(
        { x_group: groupId },
        { where: { dbId: dbIds } }
      );

      // Appliquer le commentaire sur la première alarme du groupe
      if (proposal.comment) {
        await db.models.Datalog.update(
          { x_comment: proposal.comment },
          { where: { dbId: dbIds[0] } }
        );
      }

      // Marquer comme non planifié + traité
      await db.models.Datalog.update(
        { x_state: "unplanned", x_treated: true },
        { where: { dbId: dbIds } }
      );

      created++;
    } catch {
      failed++;
    }
  }

  return { created, failed };
};
