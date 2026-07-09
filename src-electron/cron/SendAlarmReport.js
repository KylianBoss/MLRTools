import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";

const jobName = "sendAlarmReport";
const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");
const MAX_RETRY = 3;

// Calcule les statistiques du rapport pour une date donnée.
// Unique source de vérité : utilisée par le cron ET par la prévisualisation
// admin (Alarms.routes.js /alarm-report-preview), pour garantir qu'elles
// affichent toujours exactement les mêmes chiffres.
// Retourne null si aucune alarme n'existe pour cette date.
export const computeAlarmReportData = async (targetDate) => {
  const db = getDB();
  const Op = db.Sequelize.Op;
  const targetDateLabel = targetDate.format("DD.MM.YYYY");

  // Vérifier qu'il existe au moins une alarme la veille dans le Datalog
  const alarmCount = await db.models.Datalog.count({
    where: {
      timeOfOccurence: {
        [Op.between]: [
          targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
          targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
        ],
      },
    },
  });

  if (alarmCount === 0) {
    return null;
  }

  const minDurationSetting = await db.models.Settings.findByPk("MIN_ALARM_DURATION");
  const minDuration = minDurationSetting ? parseInt(minDurationSetting.value) || 0 : 0;

  // Récupérer séparément les alarmId de type "primary" et non classifiés (null)
  const alarmTypes = await db.models.Alarms.findAll({
    where: {
      [Op.or]: [{ type: "primary" }, { type: null }],
    },
    attributes: ["alarmId", "type"],
  });
  const primaryAlarmIds = alarmTypes.filter((a) => a.type === "primary").map((a) => a.alarmId);
  const unclassifiedAlarmIds = alarmTypes.filter((a) => a.type === null).map((a) => a.alarmId);

  // Toutes les alarmes primary + non classées du jour
  const allAlarms = await db.models.Datalog.findAll({
    where: {
      alarmId: { [Op.in]: [...primaryAlarmIds, ...unclassifiedAlarmIds] },
      duration: { [Op.gte]: minDuration },
      timeOfOccurence: {
        [Op.between]: [
          targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
          targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
        ],
      },
    },
    attributes: ["dbId", "alarmId", "x_group", "assignedUser", "timeOfOccurence", "timeOfAssignment"],
  });

  // Ne garder qu'une seule occurrence par groupe (une alarme groupée = 1 incident)
  // pour tous les comptages qui suivent (total, assignation, stats par utilisateur)
  const seenGroups = new Set();
  const dedupedAlarms = allAlarms.filter((alarm) => {
    if (alarm.x_group === null) return true;
    if (seenGroups.has(alarm.x_group)) return false;
    seenGroups.add(alarm.x_group);
    return true;
  });

  const totalPrimaryCount = dedupedAlarms.filter((a) =>
    primaryAlarmIds.includes(a.alarmId)
  ).length;
  const totalUnclassifiedCount = dedupedAlarms.filter((a) =>
    unclassifiedAlarmIds.includes(a.alarmId)
  ).length;

  // Alarmes assignées (assignedUser non null et non vide/blanc)
  // Le champ SAV peut contenir une chaîne vide ou des espaces plutôt que null
  // quand personne n'est assigné : on les traite comme "non assignées".
  const assignedAlarms = dedupedAlarms.filter(
    (a) => a.assignedUser !== null && a.assignedUser.trim() !== ""
  );
  const totalAssignedCount = assignedAlarms.length;

  // Stats par utilisateur : nombre d'alarmes (dédupliquées par groupe) et temps moyen de prise en charge
  const userStatsMap = new Map();

  for (const alarm of assignedAlarms) {
    const user = alarm.assignedUser;
    if (!userStatsMap.has(user)) {
      userStatsMap.set(user, { count: 0, totalResponseTime: 0, validResponseTimes: 0 });
    }

    const stats = userStatsMap.get(user);
    stats.count++;

    if (alarm.timeOfAssignment && alarm.timeOfOccurence) {
      const responseMs =
        new Date(alarm.timeOfAssignment).getTime() -
        new Date(alarm.timeOfOccurence).getTime();
      if (responseMs >= 0) {
        stats.totalResponseTime += responseMs;
        stats.validResponseTimes++;
      }
    }
  }

  // Formater les stats utilisateurs, triées par nombre d'alarmes décroissant
  const userStats = Array.from(userStatsMap.entries())
    .map(([username, stats]) => ({
      username,
      count: stats.count,
      avgResponseMinutes:
        stats.validResponseTimes > 0
          ? Math.round(stats.totalResponseTime / stats.validResponseTimes / 60000)
          : null,
      hasMissingAssignmentTime: stats.validResponseTimes < stats.count,
    }))
    .sort((a, b) => b.count - a.count);

  const totalRelevantCount = totalPrimaryCount + totalUnclassifiedCount;
  const assignedPercentage =
    totalRelevantCount > 0
      ? Math.round((totalAssignedCount / totalRelevantCount) * 100)
      : null;

  console.log(
    `[SendAlarmReport] Stats for ${targetDateLabel}: ` +
      `primary=${totalPrimaryCount}, unclassified=${totalUnclassifiedCount}, assigned=${totalAssignedCount}, users=${userStats.length}`
  );

  return {
    date: targetDateLabel,
    totalPrimary: totalPrimaryCount,
    totalUnclassified: totalUnclassifiedCount,
    totalAssigned: totalAssignedCount,
    assignedPercentage,
    userStats,
  };
};

export const sendAlarmReport = async (retryCount = 0, date = null) => {
  const db = getDB();

  if (retryCount >= MAX_RETRY) {
    await updateJob(
      {
        actualState: "error",
        lastRun: new Date(),
        lastLog: `Maximum retry count reached (${MAX_RETRY}), aborting alarm report`,
        endAt: new Date(),
        cronExpression: "30 8 * * *",
      },
      jobName
    );
    throw new Error(`Maximum retry count reached (${MAX_RETRY}), aborting alarm report`);
  }

  const targetDate = date ? dayjs(date) : dayjs().subtract(1, "day");
  const targetDateLabel = targetDate.format("DD.MM.YYYY");

  console.log(`[SendAlarmReport] Starting for ${targetDateLabel}...`);

  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: `Rapport alarmes en cours pour le ${targetDateLabel}...`,
      startAt: new Date(),
      endAt: null,
      cronExpression: "30 8 * * *",
    },
    jobName
  );

  try {
    const reportData = await computeAlarmReportData(targetDate);

    if (reportData === null) {
      const noDataMsg = "Aucune alarme de la veille trouvée";
      console.log(`[SendAlarmReport] ${noDataMsg}`);
      await updateJob(
        {
          lastRun: new Date(),
          actualState: "idle",
          lastLog: noDataMsg,
          endAt: new Date(),
        },
        jobName
      );
      return;
    }

    await sendReportByEmail(reportData);

    const logMessage = `Rapport alarmes envoyé pour le ${targetDateLabel} — ${reportData.totalPrimary} alarme(s) primaire(s), ${reportData.totalUnclassified} non classée(s), ${reportData.totalAssigned} assignée(s).`;

    await updateJob(
      {
        lastRun: new Date(),
        lastLog: logMessage,
        endAt: new Date(),
        actualState: "idle",
      },
      jobName
    );

    // Notification aux admins
    const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: logMessage,
        type: "success",
      });
    }
  } catch (error) {
    console.error("[SendAlarmReport] Error:", error);

    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Erreur lors de l'envoi du rapport alarmes : ${error.message} (Retry ${retryCount + 1}/${MAX_RETRY})`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );

    const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `Rapport alarmes échoué pour le ${targetDate.format("DD.MM.YYYY")} : ${error.message}`,
        type: "error",
      });
    }

    return Promise.reject(error);
  }
};

function formatDuration(minutes) {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function buildEmailText(data) {
  const { date, totalPrimary, totalUnclassified, totalAssigned, assignedPercentage, userStats } = data;

  const percentageLabel = assignedPercentage !== null ? `${assignedPercentage}%` : "N/A";

  const userLines =
    userStats.length > 0
      ? userStats
          .map(
            (u) =>
              `  - ${u.username} : ${u.count} alarme(s), temps moyen de prise en charge : ${formatDuration(u.avgResponseMinutes)}${u.hasMissingAssignmentTime ? " (partiel, heure d'assignation manquante sur certaines alarmes)" : ""}`
          )
          .join("\n")
      : "  Aucune alarme assignée.";

  return `Rapport quotidien des alarmes — ${date}
${"=".repeat(50)}

Alarmes primaires (J-1)     : ${totalPrimary}
Alarmes non classées (J-1)  : ${totalUnclassified}
Alarmes assignées           : ${totalAssigned}
Pourcentage assigné         : ${percentageLabel}

Détail par technicien :
${userLines}

-----------------------------------------------------------------------
Ceci est un email généré automatiquement, merci de ne pas y répondre.
Dies ist eine automatisch generierte E-Mail, bitte nicht antworten.
This is an automatically generated email, please do not reply.`;
}

function buildEmailHtml(data) {
  const { date, totalPrimary, totalUnclassified, totalAssigned, assignedPercentage, userStats } = data;

  const percentageLabel = assignedPercentage !== null ? `${assignedPercentage}%` : "N/A";
  const percentageColor =
    assignedPercentage === null
      ? "#9ca3af"
      : assignedPercentage < 33
        ? "#dc2626"
        : assignedPercentage < 66
          ? "#d97706"
          : "#16a34a";

  const userRows =
    userStats.length > 0
      ? userStats
          .map(
            (u) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${u.username}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${u.count}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatDuration(u.avgResponseMinutes)}${u.hasMissingAssignmentTime ? ' <span style="color:#9ca3af;font-size:11px;">(partiel)</span>' : ""}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="padding:6px 12px;color:#6b7280;text-align:center;">Aucune alarme assignée</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#111827;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#1e3a5f;padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Rapport quotidien des alarmes</h1>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:14px;">${date}</p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:bold;color:#1e3a5f;">${totalPrimary}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">Alarmes primaires</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:bold;color:#1e3a5f;">${totalUnclassified}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">Alarmes non classées</div>
          </td>
          <td style="width:12px;"></td>
          <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:bold;color:#1e3a5f;">${totalAssigned}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">Alarmes assignées</div>
          </td>
        </tr>
      </table>

      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;">
          <span>Pourcentage d'alarmes assignées</span>
          <span style="font-weight:bold;color:${percentageColor};">${percentageLabel}</span>
        </div>
        <div style="background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
          <div style="background:${percentageColor};height:100%;width:${assignedPercentage !== null ? assignedPercentage : 0}%;"></div>
        </div>
      </div>

      <h2 style="font-size:15px;color:#374151;margin:0 0 12px;">Détail par personne</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Personne</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Alarmes</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Temps moyen de prise</th>
          </tr>
        </thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      Ceci est un email généré automatiquement, merci de ne pas y répondre.
    </div>
  </div>
</body>
</html>`;
}

async function sendReportByEmail(data) {
  const db = getDB();

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (!config.email || !config.email.enabled) {
    console.log("[SendAlarmReport] Email sending is disabled in configuration.");
    return;
  }

  const users = await db.models.Users.findAll({
    where: { recieveDailyAlarmsByUser: true },
  });

  if (!users || users.length === 0) {
    console.log("[SendAlarmReport] No users configured to receive daily report.");
    return;
  }

  const recipientEmails = users
    .map((u) => u.email)
    .filter((email) => email && email.includes("@"));

  if (recipientEmails.length === 0) {
    console.log("[SendAlarmReport] No valid email addresses found.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  const mailOptions = {
    from: `MLR Tool <${config.email.user}>`,
    to: recipientEmails,
    subject: `Rapport Alarmes - ${data.date}`,
    text: buildEmailText(data),
    html: buildEmailHtml(data),
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("[SendAlarmReport] Error sending email:", error);
        reject(error);
      } else {
        console.log("[SendAlarmReport] Email sent:", info.response);
        console.log(`[SendAlarmReport] Recipients: ${recipientEmails.join(", ")}`);
        resolve(info);
      }
    });
  });
}
