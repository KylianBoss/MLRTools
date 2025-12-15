import { updateJob } from "./utils.js";

const jobName = "SendKPI";

export const sendKPI = async () => {
  console.log("Starting SendKPI job...");
  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: "Starting SendKPI job...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  global.sendCommandToFrontend("router", { path: "faillures-charts" });

  console.log("SendKPI job completed.");
  await updateJob(
    {
      lastRun: new Date(),
      lastLog: "SendKPI job completed.",
      endAt: new Date(),
      actualState: "idle",
    },
    jobName
  );

  const admins = await db.models.Users.findAll({
    where: { role: "admin" },
  });

  for (const admin of admins) {
    await db.models.Notifications.create({
      userId: admin.id,
      message: "KPI data has been sent by mail.",
      type: "info",
    });
  }
};
