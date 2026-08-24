import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { QueryTypes } from "sequelize";

dotenv.config();

const execPromise = promisify(exec);

/**
 * Échappe une valeur JS pour l'insérer littéralement dans une instruction SQL.
 * Ne dépend d'aucun outil externe (mysqldump) : utilisé par exportDatabaseSQL
 * qui génère le dump directement via la connexion Sequelize existante.
 */
function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) {
    return `'${dayjs(value).format("YYYY-MM-DD HH:mm:ss")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }
  // string, ou tout objet non géré ci-dessus (ex: valeurs JSON) -> sérialisé en texte
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

// Types de colonne considérés comme sûrs pour une comparaison ">" fiable en
// pagination par clé (entiers). Les types texte/décimaux/temporels sont
// exclus par prudence (tri lexicographique ou arrondis potentiellement
// piégeux) : ces tables retombent sur la pagination par OFFSET.
const NUMERIC_PK_TYPES = new Set([
  "int",
  "bigint",
  "smallint",
  "mediumint",
  "tinyint",
]);

/**
 * Retourne le nom de la colonne de clé primaire d'une table si (et seulement
 * si) c'est une PK à colonne unique de type entier — le cas qui permet une
 * pagination par clé fiable et rapide. Retourne null sinon (PK composite,
 * PK non entière, ou pas de PK du tout), auquel cas l'appelant retombe sur
 * une pagination par OFFSET classique.
 */
async function getSimpleNumericPrimaryKey(db, dbName, tableName) {
  const columns = await db.query(
    `SELECT COLUMN_NAME as name, DATA_TYPE as dataType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = :dbName AND TABLE_NAME = :tableName AND COLUMN_KEY = 'PRI'`,
    {
      type: QueryTypes.SELECT,
      raw: true,
      replacements: { dbName, tableName },
    }
  );
  if (columns.length !== 1) return null; // pas de PK, ou PK composite
  const [{ name, dataType }] = columns;
  return NUMERIC_PK_TYPES.has(dataType.toLowerCase()) ? name : null;
}

/**
 * Exporte la base de données complète (structure + données) dans un fichier
 * .sql restaurable avec un client MySQL/MariaDB standard, sans dépendre de
 * mysqldump (utile quand l'outil n'est pas installé sur la machine).
 * Écrit en flux, table par table, pour ne pas charger toute la DB en mémoire.
 *
 * @param {import("sequelize").Sequelize} db - Instance Sequelize (getDB())
 * @param {(event: object) => void} [onProgress] - Appelé à chaque étape avec :
 *   { phase: "counting"|"table-start"|"table-progress"|"table-done"|"done",
 *     tableIndex, tableCount, tableName,
 *     rowsDoneInTable, rowsTotalInTable,
 *     rowsDoneTotal, rowsTotal,
 *     elapsedMs }
 * @returns {Promise<string>} Chemin du fichier d'export généré
 */
export async function exportDatabaseSQL(db, onProgress = () => {}) {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const exportDir = path.join(process.cwd(), "storage", "backups");
  const exportFile = path.join(exportDir, `export_${timestamp}.sql`);

  await fs.mkdir(exportDir, { recursive: true });

  const dbName = db.getDatabaseName();

  // SHOW TABLES retourne aussi les VUES, qui n'ont pas de données propres et
  // peuvent être cassées (référencer une table/colonne supprimée depuis) sans
  // que ça n'empêche le reste de la base de fonctionner normalement. On les
  // distingue via information_schema pour les traiter à part (définition
  // seule, pas de COUNT/SELECT qui ferait planter tout l'export).
  const tableInfos = await db.query(
    "SELECT TABLE_NAME as name, TABLE_TYPE as type FROM information_schema.TABLES WHERE TABLE_SCHEMA = :dbName ORDER BY TABLE_NAME",
    { type: QueryTypes.SELECT, raw: true, replacements: { dbName } }
  );
  const tableNames = tableInfos
    .filter((t) => t.type === "BASE TABLE")
    .map((t) => t.name);
  const viewNames = tableInfos
    .filter((t) => t.type === "VIEW")
    .map((t) => t.name);

  console.log(
    `Starting SQL export of ${tableNames.length} tables and ${viewNames.length} views...`
  );

  // Pré-comptage des lignes de chaque table : nécessaire pour donner une
  // progression et une estimation de temps fiables (le volume par table
  // varie énormément, ex: Datalog vs Settings). Une table individuellement
  // inaccessible (permissions, vue cassée listée par erreur, etc.) ne doit
  // pas interrompre l'export des autres : son compte retombe à 0 et elle
  // sera retentée (et loggée en erreur) au moment de l'export réel.
  onProgress({
    phase: "counting",
    tableIndex: 0,
    tableCount: tableNames.length,
    elapsedMs: elapsed(),
  });

  const rowCounts = {};
  for (const tableName of tableNames) {
    try {
      const [{ count }] = await db.query(
        `SELECT COUNT(*) as count FROM \`${tableName}\``,
        { type: QueryTypes.SELECT, raw: true }
      );
      rowCounts[tableName] = Number(count);
    } catch (error) {
      console.error(`Skipping row count for "${tableName}": ${error.message}`);
      rowCounts[tableName] = 0;
    }
  }
  const rowsTotal = Object.values(rowCounts).reduce((a, b) => a + b, 0);

  const stream = createWriteStream(exportFile, { encoding: "utf8" });
  const write = (text) =>
    new Promise((resolve, reject) => {
      stream.write(text, (err) => (err ? reject(err) : resolve()));
    });

  let rowsDoneTotal = 0;

  try {
    await write(
      `-- Export de la base ${dbName}\n-- Généré le ${dayjs().format(
        "YYYY-MM-DD HH:mm:ss"
      )}\n\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`
    );

    for (const [tableIndex, tableName] of tableNames.entries()) {
      console.log(`Exporting table: ${tableName}`);
      const rowsTotalInTable = rowCounts[tableName];

      onProgress({
        phase: "table-start",
        tableIndex,
        tableCount: tableNames.length,
        tableName,
        rowsDoneInTable: 0,
        rowsTotalInTable,
        rowsDoneTotal,
        rowsTotal,
        elapsedMs: elapsed(),
      });

      try {
        const [createRow] = await db.query(
          `SHOW CREATE TABLE \`${tableName}\``,
          { type: QueryTypes.SELECT, raw: true }
        );
        const createStatement = createRow["Create Table"];

        await write(
          `-- ----------------------------\n-- Table \`${tableName}\`\n-- ----------------------------\n`
        );
        await write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
        await write(`${createStatement};\n\n`);

        // Pagination par clé (keyset) quand la table a une PK simple (une
        // seule colonne) : WHERE pk > dernierPk au lieu de OFFSET, qui reste
        // rapide même après plusieurs millions de lignes (OFFSET oblige
        // MariaDB à rescanner et jeter tout ce qui précède à chaque page,
        // donc ça ralentit de plus en plus au fil de l'export). Fallback sur
        // OFFSET pour les tables sans PK simple (généralement petites ici).
        const pkColumn = await getSimpleNumericPrimaryKey(db, dbName, tableName);

        const BATCH_SIZE = 2000;
        let rowsInTable = 0;
        let lastPk = null;
        let offset = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const rows = pkColumn
            ? await db.query(
                lastPk === null
                  ? `SELECT * FROM \`${tableName}\` ORDER BY \`${pkColumn}\` ASC LIMIT ${BATCH_SIZE}`
                  : `SELECT * FROM \`${tableName}\` WHERE \`${pkColumn}\` > :lastPk ORDER BY \`${pkColumn}\` ASC LIMIT ${BATCH_SIZE}`,
                {
                  type: QueryTypes.SELECT,
                  raw: true,
                  replacements: lastPk === null ? {} : { lastPk },
                }
              )
            : await db.query(
                `SELECT * FROM \`${tableName}\` LIMIT ${BATCH_SIZE} OFFSET ${offset}`,
                { type: QueryTypes.SELECT, raw: true }
              );
          if (rows.length === 0) break;

          const columns = Object.keys(rows[0]);
          const columnList = columns.map((c) => `\`${c}\``).join(", ");
          const valuesList = rows
            .map(
              (row) =>
                `(${columns.map((c) => sqlLiteral(row[c])).join(", ")})`
            )
            .join(",\n");

          await write(
            `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${valuesList};\n`
          );

          rowsInTable += rows.length;
          rowsDoneTotal += rows.length;
          if (pkColumn) lastPk = rows[rows.length - 1][pkColumn];
          else offset += rows.length;

          onProgress({
            phase: "table-progress",
            tableIndex,
            tableCount: tableNames.length,
            tableName,
            rowsDoneInTable: rowsInTable,
            rowsTotalInTable,
            rowsDoneTotal,
            rowsTotal,
            elapsedMs: elapsed(),
          });

          if (rows.length < BATCH_SIZE) break;
        }

        await write("\n");
      } catch (error) {
        // Une table individuellement inaccessible (vue mal classée, droits
        // insuffisants, etc.) ne doit pas faire échouer tout l'export.
        console.error(`Skipping table "${tableName}": ${error.message}`);
        await write(`-- SKIPPED (export error): ${error.message}\n\n`);
        // Compte quand même ses lignes comme "traitées" pour que la barre de
        // progression globale et l'ETA restent cohérents malgré le skip.
        rowsDoneTotal += rowsTotalInTable;
      }

      onProgress({
        phase: "table-done",
        tableIndex,
        tableCount: tableNames.length,
        tableName,
        rowsDoneInTable: rowsTotalInTable,
        rowsTotalInTable,
        rowsDoneTotal,
        rowsTotal,
        elapsedMs: elapsed(),
      });
    }

    // Vues : uniquement leur définition (pas de données propres à exporter).
    // Exportées après les tables puisqu'une vue peut en dépendre.
    for (const viewName of viewNames) {
      console.log(`Exporting view: ${viewName}`);
      try {
        const [createRow] = await db.query(`SHOW CREATE VIEW \`${viewName}\``, {
          type: QueryTypes.SELECT,
          raw: true,
        });
        const createStatement = createRow["Create View"];
        await write(
          `-- ----------------------------\n-- View \`${viewName}\`\n-- ----------------------------\n`
        );
        await write(`DROP VIEW IF EXISTS \`${viewName}\`;\n`);
        await write(`${createStatement};\n\n`);
      } catch (error) {
        // Vue cassée (référence une table/colonne supprimée) : on le note
        // dans le dump et on continue, sans interrompre l'export.
        console.error(`Skipping view "${viewName}": ${error.message}`);
        await write(
          `-- SKIPPED VIEW \`${viewName}\` (export error): ${error.message}\n\n`
        );
      }
    }

    await write("SET FOREIGN_KEY_CHECKS=1;\n");
  } finally {
    await new Promise((resolve, reject) => {
      stream.end((err) => (err ? reject(err) : resolve()));
    });
  }

  const stats = await fs.stat(exportFile);
  console.log(
    `✓ Database export created: ${exportFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
  );

  onProgress({
    phase: "done",
    tableIndex: tableNames.length,
    tableCount: tableNames.length,
    rowsDoneTotal,
    rowsTotal,
    elapsedMs: elapsed(),
    fileSizeBytes: stats.size,
  });

  return exportFile;
}

/**
 * Creates a backup of the database before running migrations
 * @returns {Promise<string>} Path to the backup file
 */
export async function backupDatabase() {
  const timestamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const backupDir = path.join(process.cwd(), "storage", "backups");
  const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);

  console.log("Starting database backup...");

  // Create backups directory if it doesn't exist
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create backup directory:", error);
    throw error;
  }

  // Get database credentials from environment
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = process.env.DB_PORT || "3306";
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASS; // Note: .env uses DB_PASS not DB_PASSWORD
  const dbName = process.env.DB_NAME;

  if (!dbUser || !dbPassword || !dbName) {
    throw new Error("Database credentials not found in environment variables");
  }

  // Use mysqldump to create backup
  const command = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPassword} --single-transaction --routines --triggers ${dbName} > "${backupFile}"`;

  try {
    await execPromise(command);
    console.log(`✓ Database backup created: ${backupFile}`);

    // Verify backup file exists and has content
    const stats = await fs.stat(backupFile);
    if (stats.size === 0) {
      throw new Error("Backup file is empty");
    }

    console.log(`✓ Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Clean old backups (keep last 10)
    await cleanOldBackups(backupDir);

    return backupFile;
  } catch (error) {
    console.error("Backup failed:", error);

    // Try to delete incomplete backup file
    try {
      await fs.unlink(backupFile);
    } catch (unlinkError) {
      // Ignore if file doesn't exist
    }

    throw error;
  }
}

/**
 * Restores database from a backup file
 * @param {string} backupFile Path to the backup file
 */
export async function restoreDatabase(backupFile) {
  console.log(`Restoring database from: ${backupFile}`);

  // Verify backup file exists
  try {
    await fs.access(backupFile);
  } catch (error) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  // Get database credentials
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = process.env.DB_PORT || "3306";
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASS; // Note: .env uses DB_PASS not DB_PASSWORD
  const dbName = process.env.DB_NAME;

  if (!dbUser || !dbPassword || !dbName) {
    throw new Error("Database credentials not found in environment variables");
  }

  // Use mysql to restore backup
  const command = `mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPassword} ${dbName} < "${backupFile}"`;

  try {
    await execPromise(command);
    console.log("✓ Database restored successfully");
  } catch (error) {
    console.error("Restore failed:", error);
    throw error;
  }
}

/**
 * Cleans old backup files, keeping only the most recent ones
 * @param {string} backupDir Directory containing backups
 * @param {number} keepCount Number of backups to keep (default: 10)
 */
async function cleanOldBackups(backupDir, keepCount = 10) {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter((file) => file.startsWith("backup_") && file.endsWith(".sql"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
      }));

    if (backupFiles.length <= keepCount) {
      return; // Nothing to clean
    }

    // Sort by name (which includes timestamp)
    backupFiles.sort((a, b) => b.name.localeCompare(a.name));

    // Delete old backups
    const filesToDelete = backupFiles.slice(keepCount);

    for (const file of filesToDelete) {
      await fs.unlink(file.path);
      console.log(`✓ Deleted old backup: ${file.name}`);
    }
  } catch (error) {
    console.error("Failed to clean old backups:", error);
    // Don't throw - cleaning is not critical
  }
}

/**
 * Lists available backup files
 * @returns {Promise<Array>} Array of backup file objects with name and path
 */
export async function listBackups() {
  const backupDir = path.join(process.cwd(), "storage", "backups");

  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = [];

    for (const file of files) {
      if (file.startsWith("backup_") && file.endsWith(".sql")) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);

        backupFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
        });
      }
    }

    // Sort by creation date (newest first)
    backupFiles.sort((a, b) => b.created - a.created);

    return backupFiles;
  } catch (error) {
    if (error.code === "ENOENT") {
      return []; // No backups directory
    }
    throw error;
  }
}
