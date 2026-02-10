import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const execPromise = promisify(exec);

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
