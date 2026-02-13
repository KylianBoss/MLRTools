/**
 * AI Service - Interface avec le LLM (Ollama)
 * 
 * Ce service gère la communication avec le modèle de langage local
 * pour fournir des fonctionnalités d'intelligence artificielle :
 * - Recherche intelligente d'alarmes
 * - Réponses à des questions analytiques
 * - Suggestions contextuelles
 */

import axios from 'axios';
import { getDB } from '../database.js';
import dayjs from 'dayjs';

// Configuration Ollama
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Teste la connexion avec Ollama
 */
export async function testOllamaConnection() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000
    });
    return {
      connected: true,
      models: response.data.models || []
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Envoie une requête au LLM avec contexte
 */
export async function askLLM(prompt, context = '', systemPrompt = '') {
  try {
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\nContexte:\n${context}\n\nQuestion: ${prompt}`
      : `Contexte:\n${context}\n\nQuestion: ${prompt}`;

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: MODEL_NAME,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.3, // Plus déterministe
          num_predict: 500, // Limite de tokens
        }
      },
      {
        timeout: 30000 // 30 secondes
      }
    );

    return {
      success: true,
      response: response.data.response,
      model: MODEL_NAME
    };
  } catch (error) {
    console.error('Error calling LLM:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Recherche intelligente d'alarmes basée sur une description naturelle
 */
export async function findAlarmsWithAI(description, interventionDate, startTime = null, endTime = null) {
  const db = getDB();
  
  try {
    // 1. Récupérer le contexte : alarmes récentes de la période
    const startDateTime = `${interventionDate} ${startTime || '00:00:00'}`;
    const endDateTime = `${interventionDate} ${endTime || '23:59:59'}`;
    
    const recentAlarms = await db.models.Datalog.findAll({
      where: {
        timeOfOccurence: {
          [db.Sequelize.Op.between]: [startDateTime, endDateTime]
        }
      },
      limit: 50,
      order: [['timeOfOccurence', 'ASC']]
    });

    if (recentAlarms.length === 0) {
      return {
        success: false,
        message: 'Aucune alarme trouvée dans cette période'
      };
    }

    // 2. Construire le contexte pour le LLM
    const alarmsContext = recentAlarms.map((alarm, idx) => {
      const a = alarm.toJSON();
      return `[${idx + 1}] ${dayjs(a.timeOfOccurence).format('HH:mm:ss')} | Code: ${a.alarmCode || 'N/A'} | Zone: ${a.alarmArea || 'N/A'} | Message: ${a.alarmText} | ID: ${a.dbId}`;
    }).join('\n');

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse d'alarmes industrielles.
Ton rôle est d'identifier quelles alarmes correspondent le mieux à une description d'intervention.

Règles importantes:
- Réponds UNIQUEMENT avec les numéros des alarmes pertinentes (format: [1, 3, 5])
- Si aucune alarme ne correspond bien, réponds: []
- Base-toi sur les codes d'alarme, zones, et messages
- Privilégie les alarmes proches dans le temps`;

    const prompt = `Description de l'intervention: "${description}"
${startTime ? `Heure de début: ${startTime}` : ''}
${endTime ? `Heure de fin: ${endTime}` : ''}

Voici les alarmes de cette période:
${alarmsContext}

Quelles alarmes (numéros) correspondent à cette intervention ? Réponds au format JSON: [numéro1, numéro2, ...]`;

    // 3. Demander au LLM
    const llmResponse = await askLLM(prompt, '', systemPrompt);

    if (!llmResponse.success) {
      throw new Error(llmResponse.error);
    }

    // 4. Parser la réponse du LLM
    const responseText = llmResponse.response.trim();
    const numbersMatch = responseText.match(/\[[\d,\s]*\]/);
    
    let selectedIndices = [];
    if (numbersMatch) {
      try {
        selectedIndices = JSON.parse(numbersMatch[0]);
      } catch (e) {
        console.error('Error parsing LLM response:', e);
      }
    }

    // 5. Récupérer les alarmes sélectionnées
    const selectedAlarms = selectedIndices
      .filter(idx => idx > 0 && idx <= recentAlarms.length)
      .map(idx => recentAlarms[idx - 1].toJSON());

    return {
      success: true,
      alarms: selectedAlarms,
      allAlarms: recentAlarms.map(a => a.toJSON()),
      aiExplanation: llmResponse.response,
      selectedCount: selectedAlarms.length
    };

  } catch (error) {
    console.error('Error in findAlarmsWithAI:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Répond à une question analytique sur les alarmes
 */
export async function answerAlarmQuestion(question, dateRange = null) {
  const db = getDB();
  
  try {
    // Définir la période (par défaut: aujourd'hui)
    const startDate = dateRange?.start || dayjs().format('YYYY-MM-DD 00:00:00');
    const endDate = dateRange?.end || dayjs().format('YYYY-MM-DD 23:59:59');

    // Récupérer les données pertinentes
    const alarms = await db.models.Datalog.findAll({
      where: {
        timeOfOccurence: {
          [db.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      limit: 100,
      order: [['timeOfOccurence', 'DESC']]
    });

    // Statistiques de base
    const stats = {
      total: alarms.length,
      byCode: {},
      byArea: {},
      bySource: {}
    };

    alarms.forEach(alarm => {
      const a = alarm.toJSON();
      stats.byCode[a.alarmCode] = (stats.byCode[a.alarmCode] || 0) + 1;
      stats.byArea[a.alarmArea] = (stats.byArea[a.alarmArea] || 0) + 1;
      stats.bySource[a.dataSource] = (stats.bySource[a.dataSource] || 0) + 1;
    });

    // Contexte pour le LLM
    const context = `Période analysée: ${dayjs(startDate).format('DD/MM/YYYY HH:mm')} à ${dayjs(endDate).format('DD/MM/YYYY HH:mm')}

Statistiques:
- Total d'alarmes: ${stats.total}
- Top 5 codes d'alarme: ${Object.entries(stats.byCode).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, count]) => `${code} (${count})`).join(', ')}
- Top 3 zones: ${Object.entries(stats.byArea).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([area, count]) => `${area} (${count})`).join(', ')}
- Sources: ${Object.entries(stats.bySource).map(([source, count]) => `${source} (${count})`).join(', ')}

Dernières alarmes:
${alarms.slice(0, 10).map(a => {
  const alarm = a.toJSON();
  return `- ${dayjs(alarm.timeOfOccurence).format('HH:mm')} | ${alarm.alarmCode} | ${alarm.alarmArea} | ${alarm.alarmText}`;
}).join('\n')}`;

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de données d'alarmes industrielles.
Réponds de manière concise et factuelle en français.
Utilise les statistiques fournies pour répondre précisément.
Si tu ne peux pas répondre avec certitude, indique-le clairement.`;

    const llmResponse = await askLLM(question, context, systemPrompt);

    if (!llmResponse.success) {
      throw new Error(llmResponse.error);
    }

    return {
      success: true,
      answer: llmResponse.response,
      stats: stats,
      period: {
        start: startDate,
        end: endDate
      }
    };

  } catch (error) {
    console.error('Error in answerAlarmQuestion:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  testOllamaConnection,
  askLLM,
  findAlarmsWithAI,
  answerAlarmQuestion
};
