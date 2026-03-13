import dayjs from "dayjs";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";

const jobName = "cleanDB";
const MAX_RETRY = 5;

export const cleanDB = async (retryCount = 0) => {
  const db = getDB();
  if (retryCount >= MAX_RETRY) {
    await updateJob(
      {
        actualState: "error",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Maximum retry count reached (${MAX_RETRY}), aborting cleaning`,
        endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        cronExpression: "30 0 * * *",
        args: null,
      },
      jobName
    );
    throw new Error(
      `Maximum retry count reached (${MAX_RETRY}), aborting cleaning`
    );
  }

  console.log("Starting DB cleaning...");
  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: "Starting DB cleaning...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  try {
    // Clean old notifications (keep last 100 per user)
    const users = await db.models.Users.findAll();
    for (const user of users) {
      const notifications = await db.models.Notifications.findAll({
        where: { userId: user.id },
        order: [["createdAt", "DESC"]],
        offset: 100,
      });
      for (const notification of notifications) {
        await notification.destroy();
      }
    }
    console.log("Notifications cleaned.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "Notifications cleaned.",
      },
      jobName
    );

    // Clean old audit (keep last 30 days)
    const cutoffDate = dayjs().subtract(30, "day").toDate();
    await db.models.Audit.destroy({
      where: {
        timestamp: {
          [db.Sequelize.Op.lt]: cutoffDate,
        },
      },
    });
    console.log("Audit logs cleaned.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "Audit logs cleaned.",
      },
      jobName
    );

    // Clean request logs (keep last 30 days)
    await db.models.RequestLogs.destroy({
      where: {
        timestamp: {
          [db.Sequelize.Op.lt]: cutoffDate,
        },
      },
    });
    console.log("Request logs cleaned.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "Request logs cleaned.",
      },
      jobName
    );

    // DB cleaning completed
    console.log("DB cleaning completed.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "DB cleaning completed.",
      },
      jobName
    );

    // Send notification to admins
    const admins = await db.models.Users.findAll({
      where: { isAdmin: true },
    });

    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `Database cleaning has been completed successfully.`,
        type: "success",
      });
    }
  } catch (error) {
    console.error("Error during DB cleaning :", error);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Error during DB cleaning: ${error.message} (Retry ${
          retryCount + 1
        }/${MAX_RETRY})`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );
    // Send notification to admins
    const admins = await db.models.Users.findAll({
      where: { isAdmin: true },
    });

    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `Database cleaning failed: ${error.message} (Retry ${
          retryCount + 1
        }/${MAX_RETRY})`,
        type: "error",
      });
    }
    // Le retry est géré automatiquement par le processeur de queue (processJobQueue)
    return Promise.reject(error);
  }
};
