import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";

const jobName = "sendAlarmReport";
const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");
const MAX_RETRY = 3;

export const sendAlarmReport = async (retryCount = 0) => {
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

  const targetDate = dayjs().subtract(1, "day");
  const targetDateLabel = targetDate.format("DD.MM.YYYY");
  const targetDateISO = targetDate.format("YYYY-MM-DD");

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
    const minDurationSetting = await db.models.Settings.findByPk("MIN_ALARM_DURATION");
    const minDuration = minDurationSetting ? parseInt(minDurationSetting.value) || 0 : 0;
    const Op = db.Sequelize.Op;

    // Récupérer les alarmId de type "primary"
    const primaryAlarmIds = await db.models.Alarms.findAll({
      where: { type: "primary" },
      attributes: ["alarmId"],
    }).then((rows) => rows.map((a) => a.alarmId));

    // Toutes les alarmes primary du jour (en tenant compte des groupes)
    const allPrimaryAlarms = await db.models.Datalog.findAll({
      where: {
        alarmId: { [Op.in]: primaryAlarmIds },
        duration: { [Op.gte]: minDuration },
        timeOfOccurence: {
          [Op.between]: [
            targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
            targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
          ],
        },
      },
      attributes: ["dbId", "x_group", "assignedUser", "timeOfOccurence", "timeOfAssignment"],
    });

    // Compter les alarmes "primary" en tenant compte des groupes
    // (une alarme groupée = 1 seule alarme comptée, représentée par le groupe)
    const countedGroups = new Set();
    let totalPrimaryCount = 0;

    for (const alarm of allPrimaryAlarms) {
      if (alarm.x_group !== null) {
        if (!countedGroups.has(alarm.x_group)) {
          countedGroups.add(alarm.x_group);
          totalPrimaryCount++;
        }
      } else {
        totalPrimaryCount++;
      }
    }

    // Alarmes assignées (assignedUser non null)
    const assignedAlarms = allPrimaryAlarms.filter((a) => a.assignedUser !== null);
    const totalAssignedCount = assignedAlarms.length;

    // Stats par utilisateur : nombre d'alarmes et temps moyen de prise en charge
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
      }))
      .sort((a, b) => b.count - a.count);

    const reportData = {
      date: targetDateLabel,
      totalPrimary: totalPrimaryCount,
      totalAssigned: totalAssignedCount,
      userStats,
    };

    console.log(
      `[SendAlarmReport] Stats for ${targetDateLabel}: ` +
        `total=${totalPrimaryCount}, assigned=${totalAssignedCount}, users=${userStats.length}`
    );

    await sendReportByEmail(reportData);

    const logMessage = `Rapport alarmes envoyé pour le ${targetDateLabel} — ${totalPrimaryCount} alarme(s) primaire(s), ${totalAssignedCount} assignée(s).`;

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
  const { date, totalPrimary, totalAssigned, userStats } = data;

  const userLines =
    userStats.length > 0
      ? userStats
          .map(
            (u) =>
              `  - ${u.username} : ${u.count} alarme(s), temps moyen de prise en charge : ${formatDuration(u.avgResponseMinutes)}`
          )
          .join("\n")
      : "  Aucune alarme assignée.";

  return `Rapport quotidien des alarmes — ${date}
${"=".repeat(50)}

Alarmes primaires (J-1) : ${totalPrimary}
Alarmes assignées       : ${totalAssigned}

Détail par technicien :
${userLines}

-----------------------------------------------------------------------
Ceci est un email généré automatiquement, merci de ne pas y répondre.
Dies ist eine automatisch generierte E-Mail, bitte nicht antworten.
This is an automatically generated email, please do not reply.`;
}

function buildEmailHtml(data) {
  const { date, totalPrimary, totalAssigned, userStats } = data;

  const userRows =
    userStats.length > 0
      ? userStats
          .map(
            (u) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${u.username}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${u.count}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${formatDuration(u.avgResponseMinutes)}</td>
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
          <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:50%;">
            <div style="font-size:32px;font-weight:bold;color:#1e3a5f;">${totalPrimary}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">Alarmes primaires (J-1)</div>
          </td>
          <td style="width:16px;"></td>
          <td style="padding:12px;background:#f3f4f6;border-radius:6px;text-align:center;width:50%;">
            <div style="font-size:32px;font-weight:bold;color:#1e3a5f;">${totalAssigned}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">Alarmes assignées</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:15px;color:#374151;margin:0 0 12px;">Détail par technicien</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Technicien</th>
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
