import { Sequelize, QueryTypes } from "sequelize";
import { readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
import { backupDatabase, restoreDatabase, listBackups } from "./backup.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration runner for Sequelize
 * Handles running and rolling back migrations with automatic backup
 */
class MigrationRunner {
  constructor(config) {
    this.sequelize = new Sequelize({
      dialect: "mariadb",
      host: config.db_host || "localhost",
      port: parseInt(config.db_port) || 3306,
      username: config.db_user,
      password: config.db_password,
      database: config.db_name,
      logging: false, // Set to console.log for debugging
    });

    this.migrationsPath = join(process.cwd(), "storage", "migrations");
    this.executedMigrations = [];
  }

  /**
   * Initialize migrations tracking table
   */
  async initialize() {
    await this.sequelize.query(`
      CREATE TABLE IF NOT EXISTS SequelizeMeta (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Load executed migrations
    const results = await this.sequelize.query(
      "SELECT name FROM SequelizeMeta ORDER BY name",
      { type: QueryTypes.SELECT }
    );

    this.executedMigrations = results.map((r) => r.name);
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations() {
    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter((f) => f.endsWith(".js") && !f.endsWith(".cjs"))
      .sort();

    return migrationFiles.filter(
      (file) => !this.executedMigrations.includes(file)
    );
  }

  /**
   * Run all pending migrations
   * @param {boolean} createBackup Whether to create a backup before migrating
   */
  async up(createBackup = true) {
    let backupFile = null;

    try {
      await this.initialize();

      const pending = await this.getPendingMigrations();

      if (pending.length === 0) {
        console.log("✓ No pending migrations");
        return;
      }

      console.log(`Found ${pending.length} pending migration(s):`);
      pending.forEach((m) => console.log(`  - ${m}`));
      console.log("");

      // Create backup before running migrations
      if (createBackup) {
        backupFile = await backupDatabase();
        console.log("");
      }

      // Run each migration
      for (const migration of pending) {
        console.log(`Running migration: ${migration}`);

        try {
          const migrationPath = join(this.migrationsPath, migration);
          // Convert to file:// URL for ESM import on Windows
          const migrationUrl = pathToFileURL(migrationPath).href;
          const { up } = await import(migrationUrl);

          await up(this.sequelize.getQueryInterface(), Sequelize);

          // Record migration as executed
          await this.sequelize.query(
            "INSERT INTO SequelizeMeta (name) VALUES (?)",
            { replacements: [migration] }
          );

          console.log(`✓ Migration completed: ${migration}\n`);
        } catch (error) {
          console.error(`✗ Migration failed: ${migration}`);
          console.error(error);

          if (createBackup && backupFile) {
            console.log("\nAttempting to restore from backup...");
            try {
              await restoreDatabase(backupFile);
              console.log("✓ Database restored from backup");
            } catch (restoreError) {
              console.error("✗ Failed to restore from backup:", restoreError);
            }
          }

          throw error;
        }
      }

      console.log("✓ All migrations completed successfully!");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  async down() {
    try {
      await this.initialize();

      if (this.executedMigrations.length === 0) {
        console.log("✓ No migrations to rollback");
        return;
      }

      const lastMigration =
        this.executedMigrations[this.executedMigrations.length - 1];

      console.log(`Rolling back migration: ${lastMigration}`);

      // Create backup before rollback
      const backupFile = await backupDatabase();
      console.log("");

      try {
        const migrationPath = join(this.migrationsPath, lastMigration);
        // Convert to file:// URL for ESM import on Windows
        const migrationUrl = pathToFileURL(migrationPath).href;
        const { down } = await import(migrationUrl);

        await down(this.sequelize.getQueryInterface(), Sequelize);

        // Remove migration from executed list
        await this.sequelize.query("DELETE FROM SequelizeMeta WHERE name = ?", {
          replacements: [lastMigration],
        });

        console.log(`✓ Rollback completed: ${lastMigration}`);
      } catch (error) {
        console.error(`✗ Rollback failed: ${lastMigration}`);
        console.error(error);

        console.log("\nAttempting to restore from backup...");
        try {
          await restoreDatabase(backupFile);
          console.log("✓ Database restored from backup");
        } catch (restoreError) {
          console.error("✗ Failed to restore from backup:", restoreError);
        }

        throw error;
      }
    } catch (error) {
      console.error("Rollback failed:", error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status() {
    await this.initialize();

    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter((f) => f.endsWith(".js") && !f.endsWith(".cjs"))
      .sort();

    console.log("Migration Status:");
    console.log("================\n");

    if (migrationFiles.length === 0) {
      console.log("No migrations found");
      return;
    }

    for (const file of migrationFiles) {
      const isExecuted = this.executedMigrations.includes(file);
      const status = isExecuted ? "✓ Executed" : "○ Pending";
      console.log(`${status}  ${file}`);
    }

    console.log("");
    console.log(
      `Total: ${migrationFiles.length} | Executed: ${
        this.executedMigrations.length
      } | Pending: ${migrationFiles.length - this.executedMigrations.length}`
    );
  }

  /**
   * Close database connection
   */
  async close() {
    await this.sequelize.close();
  }
}

/**
 * Main CLI function
 */
async function main() {
  const command = process.argv[2];
  const skipBackup = process.argv.includes("--no-backup");

  const config = {
    db_host: process.env.DB_HOST,
    db_port: process.env.DB_PORT,
    db_user: process.env.DB_USER,
    db_password: process.env.DB_PASS, // Note: .env uses DB_PASS not DB_PASSWORD
    db_name: process.env.DB_NAME,
  };

  const runner = new MigrationRunner(config);

  try {
    switch (command) {
      case "up":
        await runner.up(!skipBackup);
        break;

      case "down":
        await runner.down();
        break;

      case "status":
        await runner.status();
        break;

      case "backup":
        await backupDatabase();
        break;

      case "restore":
        const backupPath = process.argv[3];
        if (!backupPath) {
          console.error("Error: Please provide backup file path");
          console.log("\nUsage: npm run migrate restore <backup-file-path>");
          process.exit(1);
        }
        await restoreDatabase(backupPath);
        break;

      case "list-backups":
        const backups = await listBackups();
        console.log("Available Backups:");
        console.log("==================\n");
        if (backups.length === 0) {
          console.log("No backups found");
        } else {
          backups.forEach((backup) => {
            console.log(`${backup.name}`);
            console.log(`  Created: ${backup.created.toLocaleString()}`);
            console.log(`  Size: ${(backup.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Path: ${backup.path}\n`);
          });
        }
        break;

      default:
        console.log("Sequelize Migration Runner");
        console.log("==========================\n");
        console.log("Usage:");
        console.log(
          "  npm run migrate up              Run all pending migrations (with backup)"
        );
        console.log(
          "  npm run migrate down            Rollback last migration (with backup)"
        );
        console.log("  npm run migrate status          Show migration status");
        console.log("  npm run migrate backup          Create database backup");
        console.log(
          "  npm run migrate restore <file>  Restore from backup file"
        );
        console.log("  npm run migrate list-backups    List available backups");
        console.log("");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { MigrationRunner };
