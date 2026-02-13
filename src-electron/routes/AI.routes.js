import { Router } from "express";
import { requirePermission, requireAdmin } from "../middlewares/permissions.js";
import {
  getAIStatus,
  initializeLlama,
  downloadModel,
  getDownloadProgress,
  findAlarmsWithAI,
  answerAlarmQuestion,
  deleteModel
} from "../services/llama-service.js";

const router = Router();

/**
 * Statut du système IA
 * GET /api/ai/status
 */
router.get("/status", requireAdmin, async (req, res) => {
  try {
    const status = await getAIStatus();
    res.json(status);
  } catch (error) {
    console.error("Error checking AI status:", error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

/**
 * Initialisation du modèle LLM
 * POST /api/ai/initialize
 */
router.post("/initialize", requireAdmin, async (req, res) => {
  try {
    const result = await initializeLlama();
    res.json(result);
  } catch (error) {
    console.error("Error initializing AI:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Suppression du modèle (pour re-télécharger si corrompu)
 * DELETE /api/ai/delete-model
 */
router.delete("/delete-model", requireAdmin, async (req, res) => {
  try {
    const result = deleteModel();
    res.json(result);
  } catch (error) {
    console.error("Error deleting model:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * Téléchargement du modèle (Admin uniquement)
 * GET /api/ai/download-model (SSE Stream)
 */
router.get("/download-model", requireAdmin, async (req, res) => {
  try {
    // Envoyer la progression en temps réel via SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const progressCallback = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    const result = await downloadModel(progressCallback);
    res.write(`data: ${JSON.stringify({ ...result, done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Error downloading model:", error);
    res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
    res.end();
  }
});

/**
 * Progression du téléchargement
 * GET /api/ai/download-progress
 */
router.get("/download-progress", requireAdmin, async (req, res) => {
  try {
    const progress = getDownloadProgress();
    res.json(progress);
  } catch (error) {
    console.error("Error getting download progress:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Recherche intelligente d'alarmes pour une intervention
 * POST /api/ai/find-alarms
 */
router.post("/find-alarms", requireAdmin, requirePermission("canValidateInterventions"), async (req, res) => {
  try {
    const { description, plannedDate, startTime, endTime } = req.body;

    if (!description || !plannedDate) {
      return res.status(400).json({
        success: false,
        error: "Description et date planifiée sont requis"
      });
    }

    const result = await findAlarmsWithAI(
      description,
      plannedDate,
      startTime || "00:00:00",
      endTime || "23:59:59"
    );

    res.json(result);
  } catch (error) {
    console.error("Error finding alarms with AI:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Questions analytiques sur les alarmes
 * POST /api/ai/ask
 */
router.post("/ask", requireAdmin, requirePermission("canAccessJournal"), async (req, res) => {
  try {
    const { question, dateRange } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Question requise"
      });
    }

    const result = await answerAlarmQuestion(question, dateRange);
    res.json(result);
  } catch (error) {
    console.error("Error answering question:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
