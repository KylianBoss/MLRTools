import { QueryTypes } from "sequelize";
import { getDB } from "../database.js";

/**
 * Read-only DB helpers for MCP tools.
 *
 * Decision (see plan): we reuse the existing getDB() connection rather than a
 * dedicated read-only MariaDB user. To keep that safe, every DB access in the
 * MCP layer MUST go through these helpers, which only ever run SELECT / CALL
 * on the known read procedures. Never import getDB() directly from a tool.
 */

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|set\s)\b/i;

/**
 * Run a parameterised SELECT and return plain rows.
 * @param {string} sql   - must be a SELECT statement
 * @param {object} params - named replacements (:name)
 */
export async function selectRows(sql, params = {}) {
  if (FORBIDDEN.test(sql)) {
    throw new Error("selectRows: only SELECT statements are allowed");
  }
  const db = getDB();
  return db.query(sql, {
    replacements: params,
    type: QueryTypes.SELECT,
  });
}

/**
 * Call one of the whitelisted read-only stored procedures.
 */
const ALLOWED_PROCS = new Set(["getGroupedAlarms", "getChartData"]);

export async function callProc(name, params = {}) {
  if (!ALLOWED_PROCS.has(name)) {
    throw new Error(`callProc: procedure "${name}" is not whitelisted`);
  }
  const db = getDB();
  const placeholders = Object.keys(params)
    .map((k) => `:${k}`)
    .join(", ");
  return db.query(`CALL ${name}(${placeholders})`, {
    replacements: params,
    type: QueryTypes.SELECT,
  });
}

/**
 * Read-only access to a Sequelize model via findAll, with a hard row cap.
 * @param {string} modelName
 * @param {object} options - Sequelize findAll options (where, order, limit...)
 */
export async function findRows(modelName, options = {}) {
  const db = getDB();
  const model = db.models[modelName];
  if (!model) throw new Error(`findRows: unknown model "${modelName}"`);
  return model.findAll({
    raw: true,
    limit: 500,
    ...options,
  });
}

export async function getSetting(key) {
  const db = getDB();
  return db.models.Settings.getValue(key);
}
