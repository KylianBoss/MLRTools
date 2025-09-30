import fs from "fs";
import path from "path";
import os from "os";
import dayjs from "dayjs";
import csv from "csv-parser";
import { db } from "../database.js";

const ONEDRIVE_BUSINESS_PATH = path.join(os.homedir(), "OneDrive - Migros");
const WMS_HISTORY_PATH = path.join(
  ONEDRIVE_BUSINESS_PATH,
  "MLR Export WMS - Export_WMS_Suivi"
);
const START_DATE = dayjs("2025-06-30");
const jobName = "extractWMS";

function updateJob(data = {}) {
  return new Promise((resolve, reject) => {
    db.models.CronJobs.findOne({
      where: {
        action: jobName,
      },
    })
      .then((job) => {
        if (job) {
          job.update({ ...data }).then(() => {
            resolve(job);
          });
        } else {
          db.models.CronJobs.create({
            action: jobName,
            ...data,
          }).then((job) => {
            resolve(job);
          });
        }
      })
      .catch((error) => {
        console.error("Error updating job:", error);
        reject(error);
      });
  });
}

const getDatesInDB = async () => {
  const results = await db.models.ProductionData.findAll({
    attributes: ["date"],
    order: [["date", "ASC"]],
    raw: true,
  });
  return results.map((r) => dayjs(r.date).format("YYYY-MM-DD"));
};

export const extractWMS = async () => {
  console.log("Starting WMS extraction...");
  await updateJob({
    lastRun: new Date(),
    actualState: "running",
    lastLog: "Starting WMS extraction...",
    startAt: new Date(),
    endAt: null,
  });

  // Get dates already in the database
  const datesInDB = await getDatesInDB();

  // Dates to process since the START_DATE and to yesterday
  const datesToProcess = Array.from(
    { length: dayjs().diff(START_DATE, "day") },
    (_, i) => START_DATE.add(i, "day").format("YYYY-MM-DD")
  ).filter((date) => !datesInDB.includes(date));
  console.log("Dates to process:", datesToProcess);
  await updateJob({
    lastRun: new Date(),
    lastLog: `Dates to process: ${datesToProcess.join(", ")}`,
  });

  // Process each date
  try {
    for (const date of datesToProcess) {
      const data = [];
      let getFile = false;
      for (let i = 0; i < 23; i++) {
        const fileName = `SUIVI_${dayjs(date).format("YYYYMMDD")}_${i
          .toString()
          .padStart(2, "0")}.csv`;

        if (!fs.existsSync(path.join(WMS_HISTORY_PATH, fileName))) {
          console.warn(`File ${fileName} does not exist, skipping...`);
          await updateJob({
            lastRun: new Date(),
            lastLog: `File ${fileName} does not exist, skipping...`,
          });
          continue;
        }
        getFile = true;

        await new Promise((resolve) => {
          fs.createReadStream(path.join(WMS_HISTORY_PATH, fileName), "utf8")
            .pipe(csv({ separator: ";" }))
            .on("data", (row) => data.push(row))
            .on("end", async () => {
              console.log(`Processed file: ${fileName}`);
              await updateJob({
                lastRun: new Date(),
                lastLog: `Processed file: ${fileName}`,
              });
              resolve();
            });
        });
      }

      if (!getFile) {
        console.warn(
          `No files found for date ${date}, trying to get only one file...`
        );
        await updateJob({
          lastRun: new Date(),
          lastLog: `No files found for date ${date}, trying to get only one file...`,
        });
        const fileName = `SUIVI_${dayjs(date).format("YYYYMMDD")}.csv`;
        if (fs.existsSync(path.join(WMS_HISTORY_PATH, fileName))) {
          await new Promise((resolve) => {
            fs.createReadStream(path.join(WMS_HISTORY_PATH, fileName), "utf8")
              .pipe(csv({ separator: ";" }))
              .on("data", (row) => data.push(row))
              .on("end", async () => {
                console.log(`Processed file: ${fileName}`);
                await updateJob({
                  lastRun: new Date(),
                  lastLog: `Processed file: ${fileName}`,
                });
                resolve();
              });
          });
        }
      }

      const palettisationData = data.filter(
        (row) => row["ACTIVITE"] === "Palettisation"
      );
      const graiPalettised = palettisationData.map((row) => row["GRAI"]);
      const uniqueGrai = [...new Set(graiPalettised)];
      const totalBoxes = uniqueGrai.length;
      console.log(`Total boxes for ${date}: ${totalBoxes}`);
      await updateJob({
        lastRun: new Date(),
        lastLog: `Total boxes for ${date}: ${totalBoxes}`,
      });

      // Insert or update the data in the database
      await db.models.ProductionData.create({
        date: fileToProcess.date.toDate(),
        start: fileToProcess.date.startOf("day").toDate(),
        end: fileToProcess.date.endOf("day").toDate(),
        dayOff: totalBoxes === 0,
        boxTreated: totalBoxes,
      });

      console.log(`Data for ${date} inserted into database.`);
      await updateJob({
        lastRun: new Date(),
        lastLog: `Data for ${date} inserted into database.`,
      });
    }
  } catch (error) {
    console.error(`Failed to process data for date ${date}:`, error);
    await updateJob({
      lastRun: new Date(),
      lastLog: `Failed to process data for date ${date}: ${error.message}`,
      endAt: new Date(),
      actualState: "error",
    });
  }

  console.log("WMS extraction completed.");
  await updateJob({
    lastRun: new Date(),
    lastLog: "WMS extraction completed.",
    endAt: new Date(),
    actualState: "idle",
  });
  // Set the bot to restart
  const bot = await db.models.Users.findOne({
    where: { isBot: true },
  });
  if (bot) {
    bot.update({ needsRestart: true });
  }
};
