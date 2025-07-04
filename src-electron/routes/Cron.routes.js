import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import cron from "node-cron";
import { extractTrayAmount } from "../cron/ExtractTrayAmount.js";

const router = Router();

router.post("/initialize", async (req, res) => {
  const { user } = req.body;
  if (!user) {
    res.status(400).json({ error: "No user provided" });
    return;
  }

  try {
    // Get the user
    const user_ = await db.models.Users.findOne({
      where: {
        username: user,
      },
      include: {
        model: db.models.UserAccess,
        attributes: ["menuId"],
      },
    });
    if (!user_) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Control if the user is a bot
    if (!user_.isBot) {
      res.status(403).json({ error: "User not authorized" });
      return;
    }

    console.log("Initializing cron jobs for user:", user);
    const cronJobs = await db.models.CronJobs.findAll({
      where: {
        enabled: true,
      },
    });

    for (const job of cronJobs) {
      console.log(`Starting cron job: ${job.name}`);
      cron.schedule(job.cronExpression, async () => {
        switch (job.action) {
          case "extractTrayAmount":
            extractTrayAmount(dayjs().subtract(1, "day").format("YYYY-MM-DD"));
            break;
        }
      });
    }
    console.log("Cron jobs initialized successfully");
    res.json({ message: "Cron jobs initialized successfully" });
  } catch (error) {
    console.error("Error initializing cron jobs:", error);
    res.status(500).json({ error: error.message });
  }
});
// Get a list of all cron jobs
router.get("/", async (req, res) => {
  try {
    const cronJobs = await db.models.CronJobs.findAll({
      order: [["jobName", "ASC"]],
    });
    res.json(cronJobs);
  } catch (error) {
    console.error("Error fetching cron jobs:", error);
    res.status(500).json({ error: error.message });
  }
});
// SSE for cron job status
router.get("/status", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  console.log("Client connected via SSE for cron job status");
  res.write('data: {"type":"connected","message":"SSE connected"}\n\n');

  req.on("close", () => {
    console.log("Client disconnected from SSE for cron job status");
  });

  // Send status every time a cron job is updated in db
  db.models.CronJobs.addHook("afterUpdate", (job, options) => {
    const data = JSON.stringify({
      type: "cronJobStatus",
      job: {
        jobName: job.jobName,
        action: job.action,
        enabled: job.enabled,
        cronExpression: job.cronExpression,
        actualState: job.actualState,
        lastRun: job.lastRun,
        lastLog: job.lastLog,
      },
      timestamp: new Date().toISOString(),
    });
    res.write(`data: ${data}\n\n`);
  });
});

export default router;
