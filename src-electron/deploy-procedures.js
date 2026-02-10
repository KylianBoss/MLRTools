import { Sequelize } from "sequelize";
import { readFile } from "fs/promises";
import { join } from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Deploy all SQL stored procedures to the database
 */
async function deployProcedures() {
  const config = {
    dialect: "mariadb",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    logging: false,
  };

  const sequelize = new Sequelize(config);

  const procedures = [
    "getKPICount.sql",
    "getKPICountByZoneGroup.sql",
    "getKPIDuration.sql",
    "getTop10AlarmsWithDailyBreakdown.sql",
    "getGroupedAlarms.sql",
    "getAlarmDataLast7Days.sql",
    "getAverageErrorsAndDowntimeLast7Days.sql",
    "getChartData.sql",
    "getCustomChartsData.sql",
    "getDowntimeMinutesByThousand.sql",
    "getErrorsByThousand.sql",
  ];

  console.log("Deploying SQL stored procedures...\n");

  try {
    await sequelize.authenticate();
    console.log("✓ Database connection established\n");

    let successCount = 0;
    let failCount = 0;

    for (const procedure of procedures) {
      const procedurePath = join(process.cwd(), "storage", procedure);

      try {
        console.log(`Deploying ${procedure}...`);
        const sql = await readFile(procedurePath, "utf-8");

        // Extract DROP and CREATE statements
        const dropMatch = sql.match(/(DROP PROCEDURE IF EXISTS[^;]+;)/);
        const createStart = sql.indexOf("CREATE PROCEDURE");

        if (dropMatch && createStart > 0) {
          const dropStatement = dropMatch[1];
          const createStatement = sql.substring(createStart);

          // Execute DROP first
          await sequelize.query(dropStatement);

          // Then execute CREATE
          await sequelize.query(createStatement);
        } else {
          // If no DROP found, just execute the whole thing
          await sequelize.query(sql);
        }

        console.log(`✓ ${procedure} deployed successfully\n`);
        successCount++;
      } catch (error) {
        console.error(`✗ Failed to deploy ${procedure}:`);
        console.error(error.message);
        console.error("");
        failCount++;
      }
    }

    console.log("Deployment Summary:");
    console.log(`================`);
    console.log(`✓ Success: ${successCount}`);
    if (failCount > 0) {
      console.log(`✗ Failed:  ${failCount}`);
    }
    console.log(`Total:     ${procedures.length}`);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
deployProcedures().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
