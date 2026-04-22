import dayjs from "dayjs";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";
import { autoGroupAlarms } from "../services/autoGroupAlarms.js";

const jobName = "autoGroupAlarms";
const MAX_RETRY = 3;

export const autoGroupAlarmsJob = async (retryCount = 0) => {
  const db = getDB();

  if (retryCount >= MAX_RETRY) {
    await updateJob(
      {
        actualState: "error",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Maximum retry count reached (${MAX_RETRY}), aborting auto group`,
        endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        cronExpression: "5 8 * * *",
      },
      jobName
    );
    throw new Error(`Maximum retry count reached (${MAX_RETRY}), aborting auto group`);
  }

  const targetDate = dayjs().subtract(1, "day");
  const targetDateLabel = targetDate.format("DD.MM.YYYY");
  const targetDateISO = targetDate.format("YYYY-MM-DD");

  // Vérifier si l'analyse a déjà été faite manuellement pour J-1
  const doneSetting = await db.models.Settings.findByPk("dailyAnalysisDoneDate");
  if (doneSetting?.value === targetDateISO) {
    const skipMsg = `Analyse du ${targetDateLabel} déjà effectuée manuellement — cron ignoré.`;
    console.log(`[AutoGroupAlarms] ${skipMsg}`);
    await updateJob(
      {
        lastRun: new Date(),
        actualState: "idle",
        lastLog: skipMsg,
        endAt: new Date(),
        cronExpression: "5 8 * * *",
      },
      jobName
    );
    return;
  }

  console.log(`[AutoGroupAlarms] Starting for ${targetDateLabel}...`);

  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: `Groupement automatique en cours pour le ${targetDateLabel}...`,
      startAt: new Date(),
      endAt: null,
      cronExpression: "5 8 * * *",
    },
    jobName
  );

  try {
    const { created, failed } = await autoGroupAlarms(targetDate, db);

    const logMessage = `Groupement automatique terminé pour le ${targetDateLabel} — ${created} groupe(s) créé(s)${failed > 0 ? `, ${failed} échec(s)` : ""}.`;
    console.log(`[AutoGroupAlarms] ${logMessage}`);

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
        type: failed > 0 ? "warning" : "success",
      });
    }
  } catch (error) {
    console.error("[AutoGroupAlarms] Error:", error);

    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Erreur lors du groupement automatique : ${error.message} (Retry ${retryCount + 1}/${MAX_RETRY})`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );

    const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `Groupement automatique échoué pour le ${targetDateLabel} : ${error.message}`,
        type: "error",
      });
    }

    return Promise.reject(error);
  }
};
