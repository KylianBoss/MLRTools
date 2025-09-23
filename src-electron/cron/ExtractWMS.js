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

const getFiles = () => {
  const fileNameRegex = /SUIVI_(\d{4})(\d{2})(\d{2})?.csv/;

  const matches = [];
  const content = fs.readdirSync(WMS_HISTORY_PATH);

  content.forEach((filename) => {
    matches.push(filename.match(fileNameRegex));
  });

  const formattedFiles = matches
    .filter((m) => m)
    .map((m) => {
      return {
        file: m[0],
        date: dayjs(`${m[1]}-${m[2]}-${m[3]}`),
        multipart: !!m[4],
      };
    });

  return formattedFiles;
};

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

  const files = getFiles();
  const dispoDates = getFiles().map((f) => f.date.format("YYYY-MM-DD"));
  const datesInDB = await getDatesInDB();

  const datesToProcess = dispoDates.filter((d) => !datesInDB.includes(d));
  console.log("Dates to process:", datesToProcess);
  await updateJob({
    lastRun: new Date(),
    lastLog: `Dates to process: ${datesToProcess.join(", ")}`,
  });

  for (const date of datesToProcess) {
    const fileToProcess = files.find(
      (f) => f.date.format("YYYY-MM-DD") === date
    );
    if (!fileToProcess) {
      console.warn(`No file found for date ${date}, skipping...`);
      await updateJob({
        lastRun: new Date(),
        lastLog: `No file found for date ${date}, skipping...`,
      });
      continue;
    }

    const filePath = path.join(WMS_HISTORY_PATH, fileToProcess.file);
    console.log(`Processing file: ${fileToProcess.file}`);
    await updateJob({
      lastRun: new Date(),
      lastLog: `Processing file: ${fileToProcess.file}`,
    });

    let totalBoxes = 0;

    try {
      let data;
      if (fileToProcess.multipart) {
        for (let part = 0; part < 24; part++) {
          // File parts are with two digits
          const partFileName = fileToProcess.file.replace(
            ".csv",
            `_${part.toString().padStart(2, "0")}.csv`
          );
          const partFilePath = path.join(WMS_HISTORY_PATH, partFileName);
          if (fs.existsSync(partFilePath)) {
            data = fs
              .createReadStream(partFilePath)
              .pipe(csv({ separator: ";" }));
          } else {
            console.warn(
              `Part file ${partFileName} does not exist, skipping...`
            );
            await updateJob({
              lastRun: new Date(),
              lastLog: `Part file ${partFileName} does not exist, skipping...`,
            });
            continue;
          }
        }
      } else {
        data = fs.createReadStream(filePath).pipe(csv({ separator: ";" }));
      }

      const palettisationData = data.filter(
        (row) => row["ACTIVITE"] === "Palettisation"
      );
      const graiPalettised = palettisationData.map((row) =>
        parseInt(row["GRAI"])
      );
      const uniqueGrai = [...new Set(graiPalettised)];
      totalBoxes = uniqueGrai.length;

      console.log(`Total boxes for ${date}: ${totalBoxes}`);
      await updateJob({
        lastRun: new Date(),
        lastLog: `Total boxes for ${date}: ${totalBoxes}`,
      });

      await db.models.ProductionData.create({
        date: fileToProcess.date.toDate(),
        start: null,
        end: null,
        dayOff: totalBoxes === 0,
        boxTreated: totalBoxes,
      });

      console.log(`Data for ${date} inserted into database.`);
      await updateJob({
        lastRun: new Date(),
        lastLog: `Data for ${date} inserted into database.`,
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
    } catch (error) {
      console.error(`Failed to process data for date ${date}:`, error);
      await updateJob({
        lastRun: new Date(),
        lastLog: `Failed to process data for date ${date}: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
      });
    }
  }
};
