import { updateJob } from "./utils.js";

const jobName = "SendKPI";

export const sendKPI = async () => {
  console.log("Starting SendKPI job...");

  // Get args of the job
  const job = await db.models.CronJobs.findOne({
    where: { name: jobName },
  });
  const args = job.args
    ? job.args.split(",").map((a) => {
        const [key, value] = a.split(":").map((s) => s.trim());
        return { key, value };
      })
    : [];

  // Check if trayAmount, sav and wms extractions are done
  let trayAmountDone = false;
  let savDone = false;
  let wmsDone = false;
  args.forEach((arg) => {
    if (arg.key === "trayAmount" && arg.value === "done") {
      trayAmountDone = true;
    }
    if (arg.key === "sav" && arg.value === "done") {
      savDone = true;
    }
    if (arg.key === "wms" && arg.value === "done") {
      wmsDone = true;
    }
  });

  if (!trayAmountDone || !savDone || !wmsDone) {
    const missingJobs = [];
    if (!trayAmountDone) missingJobs.push("Tray Amount");
    if (!savDone) missingJobs.push("SAV");
    if (!wmsDone) missingJobs.push("WMS");

    const message = `Cannot send KPI data, the following extractions are not completed: ${missingJobs.join(
      ", "
    )}.`;

    console.warn(message);
    await updateJob(
      {
        actualState: "error",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: message,
        endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        cronExpression: "30 5 * * *",
        args: null,
      },
      jobName
    );
    return Promise.reject(new Error(message));
  }

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
      cronExpression: "30 5 * * *",
      args: "trayAmount:pending,sav:pending,wms:pending",
    },
    jobName
  );

  const admins = await db.models.Users.findAll({
    where: { isAdmin: true },
  });

  for (const admin of admins) {
    await db.models.Notifications.create({
      userId: admin.id,
      message: "KPI data has been sent by mail.",
      type: "info",
    });
  }
};
