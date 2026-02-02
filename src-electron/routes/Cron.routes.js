import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { sendCommandToFrontend } from "../electron-main.js";
import cron from "node-cron";
import { extractTrayAmount } from "../cron/ExtractTrayAmount.js";
import { extractWMS } from "../cron/ExtractWMS.js";
import { extractSAV } from "../cron/ExtractSAV.js";
import { sendKPI } from "../cron/SendKPI.js";

const router = Router();

// Map pour stocker les références des cron jobs actifs
const activeCronJobs = new Map();

// Intervalle de polling pour la queue (5 secondes)
let queuePollingInterval = null;

/**
 * Fonction réutilisable pour exécuter une action de job avec des arguments
 */
async function executeJobAction(action, args = {}) {
  console.log(`Executing job action: ${action}`, args);

  switch (action) {
    case "extractTrayAmount":
      const date = args.date || dayjs().subtract(1, "day").format("YYYY-MM-DD");
      const headless = args.headless !== undefined ? args.headless : true;
      const retryCount = args.retryCount || 0;
      return await extractTrayAmount(date, headless, retryCount);

    case "extractWMS":
      return await extractWMS(args.date, args.retryCount || 0);

    case "extractSAV":
      return await extractSAV(args.date, args.retryCount || 0);

    case "sendKPI":
      return await sendKPI();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Traiter la queue de jobs en attente
 */
async function processJobQueue() {
  try {
    // Vérifier s'il y a déjà un job en cours d'exécution
    const runningJobs = await db.models.JobQueue.findAll({
      where: { status: "running" },
    });

    if (runningJobs.length > 0) {
      console.log(
        `Skipping queue processing: ${runningJobs.length} job(s) already running`
      );
      return;
    }

    const pendingJobs = await db.models.JobQueue.findAll({
      where: { status: "pending" },
      order: [["createdAt", "ASC"]],
      limit: 1,
    });

    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    console.log(`Processing queued job: ${job.jobName} (ID: ${job.id})`);

    // Mettre à jour le statut à "running"
    await job.update({
      status: "running",
      startedAt: new Date(),
    });

    try {
      // Exécuter le job avec les args (incluant retryCount)
      await executeJobAction(job.action, job.args || {});

      // Marquer comme complété
      await job.update({
        status: "completed",
        completedAt: new Date(),
      });

      console.log(`Job completed: ${job.jobName} (ID: ${job.id})`);
    } catch (error) {
      console.error(`Job failed: ${job.jobName} (ID: ${job.id})`, error);

      // Vérifier si on doit retry
      const currentRetryCount = (job.args && job.args.retryCount) || 0;
      const maxRetries = 5;

      if (currentRetryCount < maxRetries) {
        // Créer un nouveau job avec retryCount incrémenté
        const newArgs = {
          ...(job.args || {}),
          retryCount: currentRetryCount + 1,
        };

        await db.models.JobQueue.create({
          jobName: `${job.jobName} (Retry ${currentRetryCount + 1})`,
          action: job.action,
          args: newArgs,
          requestedBy: job.requestedBy,
        });

        console.log(
          `Scheduled retry ${currentRetryCount + 1}/${maxRetries} for job: ${
            job.jobName
          }`
        );

        // Marquer le job actuel comme échoué mais avec info de retry
        await job.update({
          status: "failed",
          error: `${error.message} (Retry ${
            currentRetryCount + 1
          }/${maxRetries} scheduled)`,
          completedAt: new Date(),
        });
      } else {
        // Max retries atteint, marquer comme échoué définitivement
        await job.update({
          status: "failed",
          error: `${error.message} (Max retries reached: ${maxRetries})`,
          completedAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error processing job queue:", error);
  }
}

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

    // Arrêter tous les jobs existants avant de réinitialiser
    activeCronJobs.forEach((task, jobName) => {
      console.log(`Stopping existing cron job: ${jobName}`);
      task.stop();
      task.destroy();
    });
    activeCronJobs.clear();

    // Arrêter le polling de la queue s'il existe
    if (queuePollingInterval) {
      clearInterval(queuePollingInterval);
      queuePollingInterval = null;
    }

    const cronJobs = await db.models.CronJobs.findAll({
      where: {
        enabled: true,
      },
    });

    for (const job of cronJobs) {
      // Valider l'expression cron
      if (!cron.validate(job.cronExpression)) {
        console.error(
          `Invalid cron expression for ${job.jobName}: ${job.cronExpression}`
        );
        continue;
      }

      console.log(`Starting cron job: ${job.jobName} (${job.cronExpression})`);

      const task = cron.schedule(job.cronExpression, async () => {
        console.log(`Cron triggered: ${job.jobName}`);

        // Parser les arguments du job si définis
        let parsedArgs = {};
        if (job.args) {
          try {
            const args = job.args.split(",");
            args.forEach((arg) => {
              const [key, value] = arg.split(":").map((s) => s.trim());

              // Conversion des types basiques
              if (value === "true") parsedArgs[key] = true;
              else if (value === "false") parsedArgs[key] = false;
              else if (!isNaN(value)) parsedArgs[key] = Number(value);
              else parsedArgs[key] = value;
            });
          } catch (e) {
            console.error(`Error parsing args for ${job.jobName}:`, e);
          }
        }

        // Exécuter l'action
        try {
          await executeJobAction(job.action, parsedArgs);
        } catch (error) {
          console.error(`Error executing scheduled job ${job.jobName}:`, error);
        }
      });

      activeCronJobs.set(job.jobName, task);
    }

    // Démarrer le polling de la queue de jobs (toutes les 5 secondes)
    queuePollingInterval = setInterval(processJobQueue, 5000);
    console.log("Job queue polling started (every 5 seconds)");

    console.log("Cron jobs initialized successfully");
    res.json({
      message: "Cron jobs initialized successfully",
      jobsCount: activeCronJobs.size,
    });
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

// Demander l'exécution d'un job (pour les utilisateurs)
router.post("/request-job", async (req, res) => {
  const { action, args, userId } = req.body;

  if (!action) {
    res.status(400).json({ error: "Action is required" });
    return;
  }

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    // Vérifier que le job existe
    const cronJob = await db.models.CronJobs.findOne({
      where: { action },
    });

    if (!cronJob) {
      res.status(404).json({ error: "Cron job not found for this action" });
      return;
    }

    // Créer une entrée dans la queue
    const queuedJob = await db.models.JobQueue.create({
      jobName: cronJob.jobName,
      action: action,
      args: args || null,
      requestedBy: userId,
      status: "pending",
      createdAt: new Date(),
    });

    console.log(`Job queued: ${cronJob.jobName} (Queue ID: ${queuedJob.id})`);

    res.json({
      message: "Job queued successfully, waiting for bot to process",
      queueId: queuedJob.id,
      jobName: cronJob.jobName,
      estimatedDelay: "5-10 seconds",
    });
  } catch (error) {
    console.error("Error requesting job:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir le statut d'un job dans la queue
router.get("/queue/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const queuedJob = await db.models.JobQueue.findByPk(id);

    if (!queuedJob) {
      res.status(404).json({ error: "Queued job not found" });
      return;
    }

    res.json(queuedJob);
  } catch (error) {
    console.error("Error fetching queued job:", error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir tous les jobs en attente dans la queue
router.get("/queue", async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    const where = status ? { status } : {};

    const queuedJobs = await db.models.JobQueue.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });

    res.json(queuedJobs);
  } catch (error) {
    console.error("Error fetching job queue:", error);
    res.status(500).json({ error: error.message });
  }
});
// SSE for cron job status
router.get("/status", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  console.log("Client connected via SSE for cron job status");
  res.write('data: {"type":"connected","message":"SSE connected"}\n\n');

  // Fonction pour envoyer l'état actuel
  const sendStatus = async () => {
    try {
      // Envoyer la liste complète des cron jobs
      const allCronJobs = await db.models.CronJobs.findAll();
      const cronJobsData = allCronJobs.map((job) => ({
        name: job.jobName,
        action: job.action,
        enabled: job.enabled,
        cronExpression: job.cronExpression,
        actualState: job.actualState,
        lastRun: job.lastRun,
        lastLog: job.lastLog,
      }));

      const cronData = JSON.stringify({
        type: "cronJobStatus",
        jobs: cronJobsData,
        timestamp: new Date().toISOString(),
      });
      res.write(`data: ${cronData}\n\n`);

      // Envoyer aussi les jobs en queue
      const queueJobs = await db.models.JobQueue.findAll({
        order: [["createdAt", "DESC"]],
        limit: 50,
      });

      queueJobs.forEach((job) => {
        const queueData = JSON.stringify({
          type: "jobQueueStatus",
          job: {
            id: job.id,
            jobName: job.jobName,
            action: job.action,
            status: job.status,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error,
          },
          timestamp: new Date().toISOString(),
        });
        res.write(`data: ${queueData}\n\n`);
      });
    } catch (error) {
      console.error("Error sending SSE status:", error);
    }
  };

  // Envoyer l'état initial
  await sendStatus();

  // Envoyer l'état toutes les secondes
  const interval = setInterval(sendStatus, 1000);

  req.on("close", () => {
    console.log("Client disconnected from SSE for cron job status");
    clearInterval(interval);
  });
});

// Start manually a cron job with custom arguments
router.post("/start", async (req, res) => {
  const { action, args } = req.body;

  if (!action) {
    res.status(400).json({ error: "Action is required" });
    return;
  }

  try {
    const cronJob = await db.models.CronJobs.findOne({
      where: { action },
    });

    if (!cronJob) {
      res.status(404).json({ error: "Cron job not found" });
      return;
    }

    console.log(`Manual execution requested for: ${cronJob.jobName}`, args);

    // Exécuter immédiatement avec les arguments fournis
    await executeJobAction(action, args || {});

    res.json({
      message: `Cron job ${cronJob.jobName} executed successfully`,
      action,
      args,
    });
  } catch (error) {
    console.error("Error starting cron job:", error);
    res.status(500).json({ error: error.message });
  }
});
// Test router command
router.get("/test", (req, res) => {
  global.sendCommandToFrontend("router", { path: "faillures-charts" });
  res.json({ message: "Cron routes are working!" });
});

export default router;
