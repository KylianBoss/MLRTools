import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";

const INACTIVE_BOT_THRESHOLD = 5; // minutes

const router = Router();

router.post("/active", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const user = await db.models.Users.findByPk(userId);
    if (!user || !user.isBot) {
      return res.status(404).json({ error: "Bot not found or not a bot user" });
    }

    user.isBotActive = new Date();
    await user.save();

    return res.json({ message: "Bot activity updated successfully" });
  } catch (error) {
    console.error("Error updating bot activity:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/status", async (req, res) => {
  try {
    const bots = await db.models.Users.findAll({
      where: { isBot: true },
      attributes: ["id", "fullname", "isBotActive"],
    });

    const now = dayjs();
    const botStatuses = bots.map((bot) => {
      const lastActive = dayjs(bot.isBotActive);
      const isActive = lastActive.isAfter(
        now.subtract(INACTIVE_BOT_THRESHOLD, "minutes")
      );
      return {
        id: bot.id,
        fullname: bot.fullname,
        isActive,
        lastActive: bot.isBotActive,
      };
    });
    return res.json(botStatuses);
  } catch (error) {
    console.error("Error fetching bot status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/needs-restart/:userId", async (req, res) => {
  try {
    const bot = await db.models.Users.findOne({
      where: { isBot: true, id: req.params.userId },
      attributes: ["id", "fullname", "needsRestart"],
    });
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    return res.json({ needsRestart: bot.needsRestart });
  } catch (error) {
    console.error("Error checking bot restart status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/restart-ack/:userId", async (req, res) => {
  try {
    const bot = await db.models.Users.findOne({
      where: { isBot: true, id: req.params.userId },
    });
    if (!bot) {
      return res.status(404).json({ error: "Bot not found" });
    }
    bot.needsRestart = false;
    await bot.save();
    return res.json({ message: "Bot restart acknowledged" });
  } catch (error) {
    console.error("Error acknowledging bot restart:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/ask/extract", async (req, res) => {
  const { date } = req.body;
  if (!date || !dayjs(date, "YYYY-MM-DD", true).isValid()) {
    return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
  }
  try {
    const bots = await db.models.Users.findAll({
      where: { isBot: true },
      limit: 1,
    });

    if (bots.length === 0) {
      return res.status(404).json({ error: "No bot users found" });
    }

    const bot = bots[0];
    bot.needsRestart = true;
    await bot.save();

    const cronJob = await db.models.CronJobs.findOne({
      where: { action: "extractTrayAmount" },
    });
    if (!cronJob) {
      return res.status(404).json({ error: "Cron job 'extractTrayAmount' not found" });
    }

    let args = `date:${date}`;
    const cronExpression = dayjs().add(5, "minute").format("m H * * *");
    cronJob.args = args;
    cronJob.cronExpression = cronExpression;
    cronJob.lastLog = `Manual trigger for date ${date} at ${dayjs().format(
      "YYYY-MM-DD HH:mm"
    )}`;
    await cronJob.save();

    return res.json({ message: "Extraction job scheduled successfully" });
  } catch (error) {
    console.error("Error scheduling extraction job:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/ask/extractWMS", async (req, res) => {
  const { date } = req.body;
  if (!date || !dayjs(date, "YYYY-MM-DD", true).isValid()) {
    return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
  }
  try {
    const bots = await db.models.Users.findAll({
      where: { isBot: true },
      limit: 1,
    });

    if (bots.length === 0) {
      return res.status(404).json({ error: "No bot users found" });
    }

    const bot = bots[0];
    bot.needsRestart = true;
    await bot.save();

    const cronJob = await db.models.CronJobs.findOne({
      where: { action: "extractWMS" },
    });
    if (!cronJob) {
      return res.status(404).json({ error: "Cron job 'extractTrayAmount' not found" });
    }

    let args = `date:${date}`;
    const cronExpression = dayjs().add(3, "minute").format("m H * * *");
    cronJob.args = args;
    cronJob.cronExpression = cronExpression;
    cronJob.lastLog = `Manual trigger for date ${date} at ${dayjs().format(
      "YYYY-MM-DD HH:mm"
    )}`;
    await cronJob.save();

    return res.json({ message: "Extraction job scheduled successfully" });
  } catch (error) {
    console.error("Error scheduling extraction job:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/ask/restart", async (req, res) => {
  try {
    const bots = await db.models.Users.findAll({
      where: { isBot: true },
    });

    if (bots.length === 0) {
      return res.status(404).json({ error: "No bot users found" });
    }

    for (const bot of bots) {
      bot.needsRestart = true;
      await bot.save();
    }

    return res.json({ message: "All bots marked for restart" });
  } catch (error) {
    console.error("Error marking bots for restart:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
