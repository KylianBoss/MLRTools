/**
 * Llama AI Service - Intégration directe de LLM dans Electron
 * Utilise node-llama-cpp pour exécuter le modèle localement sans Ollama externe
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLlama, LlamaChatSession, Llama3_1ChatWrapper } from 'node-llama-cpp';
import fs from 'fs';
import { app } from 'electron';
import https from 'https';
import { getDB } from '../database.js';
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import { generateDataSourceMappingPrompt, extractDataSourcesFromDescription } from './datasource-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MODEL_NAME = 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';
const MODEL_URL = 'https://huggingface.co/lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf';
const MODELS_DIR = join(app.getPath('userData'), 'ai-models');
const MODEL_PATH = join(MODELS_DIR, MODEL_NAME);

// État global
let llama = null;
let model = null;
let isInitialized = false;
let isDownloading = false;
let downloadProgress = 0;

/**
 * Initialise le répertoire des modèles
 */
function ensureModelsDirectory() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    console.log('[Llama] Models directory created:', MODELS_DIR);
  }
}

/**
 * Vérifie si le modèle est téléchargé
 */
export function isModelDownloaded() {
  return fs.existsSync(MODEL_PATH);
}

/**
 * Supprime le modèle téléchargé (pour re-télécharger un fichier corrompu)
 */
export function deleteModel() {
  try {
    if (fs.existsSync(MODEL_PATH)) {
      fs.unlinkSync(MODEL_PATH);
      console.log('[Llama] Model file deleted:', MODEL_PATH);
      
      // Reset state
      isInitialized = false;
      model = null;
      llama = null;
      
      return { success: true, message: 'Model deleted successfully' };
    }
    return { success: true, message: 'Model file does not exist' };
  } catch (error) {
    console.error('[Llama] Error deleting model:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtient la progression du téléchargement
 */
export function getDownloadProgress() {
  return {
    isDownloading,
    progress: downloadProgress,
    modelPath: MODEL_PATH,
    modelExists: isModelDownloaded()
  };
}

/**
 * Télécharge le modèle LLM
 */
export async function downloadModel(progressCallback = null) {
  if (isDownloading) {
    throw new Error('Un téléchargement est déjà en cours');
  }

  if (isModelDownloaded()) {
    console.log('[Llama] Model already downloaded');
    return { success: true, message: 'Model already available' };
  }

  ensureModelsDirectory();
  
  return new Promise((resolve, reject) => {
    console.log('[Llama] Download started:', MODEL_URL);
    isDownloading = true;
    downloadProgress = 0;

    const file = fs.createWriteStream(MODEL_PATH);
    let downloadedBytes = 0;
    let totalBytes = 0;

    https.get(MODEL_URL, (response) => {
      // Gérer les redirections
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, handleResponse).on('error', handleError);
        return;
      }

      handleResponse(response);
    }).on('error', handleError);

    function handleResponse(response) {
      totalBytes = parseInt(response.headers['content-length'], 10);
      console.log(`[Llama] Total size: ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        downloadProgress = Math.round((downloadedBytes / totalBytes) * 100);

        if (progressCallback) {
          progressCallback({
            progress: downloadProgress,
            downloadedMB: (downloadedBytes / 1024 / 1024).toFixed(2),
            totalMB: (totalBytes / 1024 / 1024).toFixed(2)
          });
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          isDownloading = false;
          downloadProgress = 100;
          console.log('[Llama] Download complete:', MODEL_PATH);
          resolve({
            success: true,
            message: 'Model downloaded successfully',
            path: MODEL_PATH
          });
        });
      });
    }

    function handleError(err) {
      isDownloading = false;
      downloadProgress = 0;
      fs.unlink(MODEL_PATH, () => {}); // Supprimer le fichier partiel
      console.error('[Llama] Erreur téléchargement:', err.message);
      reject(new Error('Échec du téléchargement: ' + err.message));
    }
  });
}

/**
 * Initialise le modèle LLM
 */
export async function initializeLlama() {
  if (isInitialized && model) {
    return { success: true, message: 'Modèle déjà initialisé' };
  }

  if (!isModelDownloaded()) {
    return {
      success: false,
      error: 'Model not downloaded',
      needsDownload: true
    };
  }

  // Check model file integrity
  try {
    const stats = fs.statSync(MODEL_PATH);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`[Llama] Model file size: ${fileSizeMB} MB`);
    
    // Expected size is ~4700 MB for Q4_K_M
    if (stats.size < 100 * 1024 * 1024) { // Less than 100 MB
      console.error('[Llama] Model file too small, likely incomplete download');
      return {
        success: false,
        error: 'Model file incomplete. Please re-download the model.',
        needsDownload: true
      };
    }
  } catch (statError) {
    console.error('[Llama] Error checking model file:', statError);
  }

  try {
    console.log('[Llama] Initializing model...');

    llama = await getLlama();
    console.log('[Llama] Llama instance created');

    model = await llama.loadModel({
      modelPath: MODEL_PATH
    });
    console.log('[Llama] Model loaded successfully');
    isInitialized = true;
    return { success: true, message: 'Model initialized' };

  } catch (error) {
    console.error('[Llama] Initialization error:', error);
    isInitialized = false;
    model = null;
    llama = null;
    return {
      success: false,
      error: `Failed to load model: ${error.message}. The model file may be corrupted. Try re-downloading.`
    };
  }
}

/**
 * Vérifie le statut du système IA
 */
export async function getAIStatus() {
  return {
    isInitialized,
    modelExists: isModelDownloaded(),
    isDownloading,
    downloadProgress,
    modelPath: MODEL_PATH,
    modelName: MODEL_NAME
  };
}

/**
 * Génère une réponse avec le LLM
 */
async function generateResponse(systemPrompt, userPrompt, context = '') {
  if (!isInitialized || !model) {
    console.log('[Llama] Model not initialized, attempting to initialize...');
    const initResult = await initializeLlama();
    if (!initResult.success) {
      throw new Error('Model not initialized: ' + (initResult.error || 'Download required'));
    }
  }

  try {
    const contextSession = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: contextSession.getSequence(),
      chatWrapper: new Llama3_1ChatWrapper() // Explicitly use Llama 3.1 format
    });

    // Build the complete prompt
    let fullPrompt = systemPrompt + '\n\n';
    if (context) {
      fullPrompt += 'CONTEXT:\n' + context + '\n\n';
    }
    fullPrompt += 'QUESTION:\n' + userPrompt;

    console.log('[Llama] Generating response...');
    const startTime = Date.now();

    const response = await session.prompt(fullPrompt, {
      maxTokens: 500,
      temperature: 0.3,
      topK: 40,
      topP: 0.9
    });

    const duration = Date.now() - startTime;
    console.log(`[Llama] Response generated in ${duration}ms`);

    return response;

  } catch (error) {
    console.error('[Llama] Generation error:', error);
    throw error;
  }
}

/**
 * Recherche intelligente d'alarmes pour une intervention
 */
export async function findAlarmsWithAI(description, date, startTime, endTime) {
  try {
    const db = getDB();
    const Datalog = db.models.Datalog;
    
    console.log('[Llama] Fetching alarms from DB...');
    // Build date range
    const startDateTime = dayjs(`${date} ${startTime}`).format('YYYY-MM-DD HH:mm:ss');
    const endDateTime = dayjs(`${date} ${endTime}`).format('YYYY-MM-DD HH:mm:ss');

    // Récupérer les alarmes dans la plage horaire
    // Utiliser raw query pour libérer rapidement la connexion
    const alarms = await Datalog.findAll({
      where: {
        timeOfOccurence: {
          [Op.between]: [startDateTime, endDateTime]
        }
      },
      order: [['timeOfOccurence', 'ASC']],
      raw: true, // Returns simple objects, faster
    });
    
    console.log(`[Llama] ${alarms.length} alarms fetched`);

    if (alarms.length === 0) {
      return {
        success: true,
        alarms: [],
        allAlarms: [],
        selectedCount: 0,
        aiExplanation: 'No alarms found in this time range.'
      };
    }

    // Extract potential dataSources from description
    const detectedSources = extractDataSourcesFromDescription(description);
    const sourceHint = detectedSources.length > 0 
      ? `\n\nDETECTED DATASOURCES from description: ${detectedSources.join(', ')}\n→ Pay special attention to alarms from these sources!`
      : '';

    // Build context for LLM - Include dataSource which is often mentioned in interventions
    const alarmsContext = alarms.map((alarm, idx) => {
      return `[${idx + 1}] ${dayjs(alarm.timeOfOccurence).format('HH:mm:ss')} | Source: ${alarm.dataSource || 'N/A'} | Code: ${alarm.alarmCode || 'N/A'} | Zone: ${alarm.alarmArea || 'N/A'} | ${alarm.alarmText || 'N/A'}`;
    }).join('\n');

    // Generate dynamic mapping from configuration
    const mappingPrompt = generateDataSourceMappingPrompt();

    const systemPrompt = `You are a specialized assistant for analyzing industrial alarms.
Your role is to identify relevant alarms for a given intervention.

${mappingPrompt}

STRICT RULES:
1. **DATASOURCE IS CRITICAL** - Users often mention machine/station names in descriptions
2. Match keywords from description with dataSource first, then alarmCode, zone, and text
3. Consider timing proximity (alarms close to intervention time are more relevant)
4. Look for patterns: repeated alarms, escalating severity, related zones
5. Return ONLY a JSON array of indices [1, 3, 5]
6. If no alarm matches, return []
7. MANDATORY response format: [1, 3, 5] or []

MATCHING STRATEGY:
- Exact dataSource match = HIGH priority
- Keyword in alarmText = MEDIUM priority  
- Same zone/area = LOW priority
- Timing proximity = BONUS score

DO NOT add explanations, ONLY the JSON array.`;

    const userPrompt = `INTERVENTION: "${description}"
Period: ${startTime} - ${endTime}${sourceHint}

AVAILABLE ALARMS:
${alarmsContext}

Which alarms match this intervention? Respond ONLY with a JSON array of indices.`;

    console.log('[Llama] Searching alarms with AI...');
    console.log('[Llama] Detected sources from description:', detectedSources.length > 0 ? detectedSources.join(', ') : 'none');
    const response = await generateResponse(systemPrompt, userPrompt);

    // Parse response
    let selectedIndices = [];
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\d,\s]*\]/);
      if (jsonMatch) {
        selectedIndices = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[Llama] JSON parsing error:', parseError);
      selectedIndices = [];
    }

    // Map indices to alarms
    const selectedAlarms = selectedIndices
      .filter(idx => idx > 0 && idx <= alarms.length)
      .map(idx => alarms[idx - 1]);

    // Build explanation with detected sources
    let explanation = `AI analyzed ${alarms.length} alarms and selected ${selectedAlarms.length} as relevant for this intervention.`;
    
    if (detectedSources.length > 0) {
      explanation += `\n\nDetected dataSources: ${detectedSources.join(', ')}`;
      
      // Count how many selected alarms match detected sources
      const matchingSourceCount = selectedAlarms.filter(alarm => 
        detectedSources.includes(alarm.dataSource)
      ).length;
      
      if (matchingSourceCount > 0) {
        explanation += `\n${matchingSourceCount} alarm(s) from these sources were selected.`;
      }
    }

    return {
      success: true,
      alarms: selectedAlarms,
      allAlarms: alarms,
      selectedCount: selectedAlarms.length,
      aiExplanation: explanation,
      detectedSources // Include for frontend display
    };

  } catch (error) {
    console.error('[Llama] findAlarmsWithAI error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Répond à une question sur les alarmes
 */
export async function answerAlarmQuestion(question, dateRange = null) {
  try {
    const db = getDB();
    const Datalog = db.models.Datalog;
    
    console.log('[Llama] Fetching alarms for analysis...');
    // Define default date range (today)
    if (!dateRange) {
      dateRange = {
        start: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        end: dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
      };
    }

    // Récupérer les alarmes récentes
    const alarms = await Datalog.findAll({
      where: {
        timeOfOccurence: {
          [Op.between]: [dateRange.start, dateRange.end]
        }
      },
      limit: 100,
      order: [['timeOfOccurence', 'DESC']],
      raw: true // Returns simple objects
    });
    
    console.log(`[Llama] ${alarms.length} alarms fetched for analysis`);

    // Calculate statistics
    const stats = {
      total: alarms.length,
      byCode: {},
      byArea: {},
      bySource: {},
      period: dateRange
    };

    alarms.forEach(alarm => {
      // Par code
      if (alarm.alarmCode) {
        stats.byCode[alarm.alarmCode] = (stats.byCode[alarm.alarmCode] || 0) + 1;
      }
      // Par zone
      if (alarm.alarmArea) {
        stats.byArea[alarm.alarmArea] = (stats.byArea[alarm.alarmArea] || 0) + 1;
      }
      // Par source
      if (alarm.dataSource) {
        stats.bySource[alarm.dataSource] = (stats.bySource[alarm.dataSource] || 0) + 1;
      }
    });

    // Construire le contexte
    const statsText = `
STATISTIQUES (${dayjs(dateRange.start).format('DD/MM/YYYY')} - ${dayjs(dateRange.end).format('DD/MM/YYYY')}):
- Total: ${stats.total} alarmes

Top 5 codes d'alarme:
${Object.entries(stats.byCode)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([code, count]) => `  - ${code}: ${count}`)
  .join('\n')}

Top 5 zones:
${Object.entries(stats.byArea)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([area, count]) => `  - ${area}: ${count}`)
  .join('\n')}

Dernières alarmes:
${alarms.slice(0, 10).map(a => 
  `- ${dayjs(a.timeOfOccurence).format('HH:mm')} | ${a.alarmCode} | ${a.alarmArea} | ${a.alarmText}`
).join('\n')}`;

    const systemPrompt = `Tu es un assistant d'analyse de données industrielles.
Tu réponds aux questions sur les alarmes de manière factuelle et concise.

CONSIGNES:
1. Base-toi UNIQUEMENT sur les données fournies
2. Donne des chiffres précis
3. Reste concis (3-5 phrases maximum)
4. Si données insuffisantes, dis-le clairement
5. Réponds en français`;

    console.log('[Llama] Answering question...');
    const answer = await generateResponse(systemPrompt, question, statsText);

    return {
      success: true,
      answer,
      stats,
      period: dateRange
    };

  } catch (error) {
    console.error('[Llama] Erreur answerAlarmQuestion:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
