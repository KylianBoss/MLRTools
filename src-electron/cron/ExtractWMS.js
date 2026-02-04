import fs from "fs";
import path from "path";
import os from "os";
import dayjs from "dayjs";
import csv from "csv-parser";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";
import Sequelize from "sequelize";

const ONEDRIVE_BUSINESS_PATH = path.join(os.homedir(), "OneDrive - Migros");
const WMS_HISTORY_PATH = path.join(
  ONEDRIVE_BUSINESS_PATH,
  "MLR Export WMS - Export_WMS_Suivi"
);
const START_DATE = dayjs("2025-06-30");
const jobName = "extractWMS";
const MAX_RETRY = 5;
const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");

const getDatesInDB = async () => {
  const results = await db.models.ProductionData.findAll({
    attributes: ["date"],
    order: [["date", "ASC"]],
    raw: true,
  });
  return results.map((r) => dayjs(r.date).format("YYYY-MM-DD"));
};

export const extractWMS = async (manualDate = null, retryCount = 0) => {
  // Obtenir l'instance de la base de données
  const db = getDB();

  if (retryCount >= MAX_RETRY) {
    console.warn(
      `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
    );
    await updateJob(
      {
        actualState: "error",
        lastRun: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        lastLog: `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`,
        endAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        cronExpression: "30 0 * * *",
        args: null,
      },
      jobName
    );
    return reject(
      new Error(
        `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
      )
    );
  }

  console.log("Starting WMS extraction...");
  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: manualDate
        ? `Starting WMS extraction for the ${dayjs(manualDate).format(
            "DD.MM.YYYY"
          )}...`
        : "Starting WMS extraction...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  // Récupération de al configuration
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

  // Create the DB connection to MVN
  const MVNDB = new Sequelize(
    config.mvnDatabase,
    config.mvnUsername,
    config.mvnPassword,
    {
      host: config.mvnHost,
      dialect: "oracle",
      dialectOptions: {
        connectString: config.mvnConnectString,
      },
      logging: false,
    }
  );

  // Verify the connection with MVNDB
  if (
    !(await MVNDB.authenticate()
      .then(() => true)
      .catch(() => false))
  ) {
    const errorMsg = "Unable to connect to the MVN database.";
    console.error(errorMsg);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: errorMsg,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );
    throw new Error(errorMsg);
  }

  // Get dates already in the database
  const datesInDB = manualDate ? null : await getDatesInDB();

  // Dates to process since the START_DATE and to yesterday
  const datesToProcess = manualDate
    ? [manualDate]
    : Array.from({ length: dayjs().diff(START_DATE, "day") }, (_, i) =>
        START_DATE.add(i, "day").format("YYYY-MM-DD")
      ).filter((date) => !datesInDB.includes(date));
  console.log("Dates to process:", datesToProcess);
  await updateJob(
    {
      lastRun: new Date(),
      lastLog: `Dates to process: ${datesToProcess.join(", ")}`,
    },
    jobName
  );

  // Process each date
  let currentDate = null;
  try {
    for (const date of datesToProcess) {
      currentDate = date;
      // const data = [];
      // let getFile = false;
      // for (let i = 0; i < 24; i++) {
      //   const fileName = `SUIVI_${dayjs(date).format("YYYYMMDD")}_${i
      //     .toString()
      //     .padStart(2, "0")}.csv`;

      //   if (!fs.existsSync(path.join(WMS_HISTORY_PATH, fileName))) {
      //     console.warn(`File ${fileName} does not exist, skipping...`);
      //     await updateJob(
      //       {
      //         lastRun: new Date(),
      //         lastLog: `File ${fileName} does not exist, skipping...`,
      //       },
      //       jobName
      //     );
      //     continue;
      //   }
      //   getFile = true;

      //   await new Promise((resolve) => {
      //     fs.createReadStream(path.join(WMS_HISTORY_PATH, fileName), "utf8")
      //       .pipe(csv({ separator: ";" }))
      //       .on("data", (row) => data.push(row))
      //       .on("end", async () => {
      //         console.log(`Processed file: ${fileName}`);
      //         await updateJob(
      //           {
      //             lastRun: new Date(),
      //             lastLog: `Processed file: ${fileName}`,
      //           },
      //           jobName
      //         );
      //         resolve();
      //       });
      //   });
      // }

      // if (!getFile) {
      //   console.warn(
      //     `No files found for date ${date}, trying to get only one file...`
      //   );
      //   await updateJob(
      //     {
      //       lastRun: new Date(),
      //       lastLog: `No files found for date ${date}, trying to get only one file...`,
      //     },
      //     jobName
      //   );
      //   const fileName = `SUIVI_${dayjs(date).format("YYYYMMDD")}.csv`;
      //   if (fs.existsSync(path.join(WMS_HISTORY_PATH, fileName))) {
      //     await new Promise((resolve) => {
      //       fs.createReadStream(path.join(WMS_HISTORY_PATH, fileName), "utf8")
      //         .pipe(csv({ separator: ";" }))
      //         .on("data", (row) => data.push(row))
      //         .on("end", async () => {
      //           console.log(`Processed file: ${fileName}`);
      //           await updateJob(
      //             {
      //               lastRun: new Date(),
      //               lastLog: `Processed file: ${fileName}`,
      //             },
      //             jobName
      //           );
      //           resolve();
      //         });
      //     });
      //   }
      // }

      const data = await MVNDB.query(
        "SELECT * FROM lnm.ACTIVITY_DATA LIMIT 10"
      );
      console.log(data);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: JSON.stringify(data),
        },
        jobName
      );

      const palettisationData = data.filter(
        (row) => row["ACTIVITE"] === "Palettisation"
      );
      const graiPalettised = palettisationData.map((row) => row["GRAI"]);
      const uniqueGrai = [...new Set(graiPalettised)];
      const totalBoxes = uniqueGrai.length;
      console.log(`Total boxes for ${date}: ${totalBoxes}`);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Total boxes for ${date}: ${totalBoxes}`,
        },
        jobName
      );

      // Insert or update the data in the database
      const d = await db.models.ProductionData.findOrCreate({
        where: { date: dayjs(date).toDate() },
      });
      if (d[1] === false) {
        console.log(`Data for ${date} already exists, updating...`);
        await updateJob(
          {
            lastRun: new Date(),
            lastLog: `Data for ${date} already exists, updating...`,
          },
          jobName
        );
        d[0].boxTreated = totalBoxes;
        d[0].dayOff = totalBoxes === 0;
        await d[0].save();
        continue;
      } else {
        console.log(`Inserting data for ${date}...`);
        await updateJob(
          {
            lastRun: new Date(),
            lastLog: `Inserting data for ${date}...`,
          },
          jobName
        );
        const schedule = await db.models.ScheduleProduction.findOne({
          where: { day: dayjs(date).format("d") },
        });
        const startTime = schedule
          ? `${date} ${schedule.startTime}`
          : `${date} 00:00:00`;
        const endTime = schedule
          ? `${date} ${schedule.endTime}`
          : `${date} 23:59:59`;
        await db.models.ProductionData.upsert({
          date: date,
          boxTreated: totalBoxes,
          dayOff: totalBoxes === 0,
          start: dayjs(startTime).toDate(),
          end: dayjs(endTime).toDate(),
        });
      }

      console.log(`Data for ${date} inserted into database.`);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Data for ${date} inserted into database.`,
        },
        jobName
      );
    }
  } catch (error) {
    console.error(`Failed to process data for date ${currentDate}:`, error);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Failed to process data for date ${currentDate}: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );
    // Send notification to admins
    const admins = await db.models.Users.findAll({
      where: { isAdmin: true },
    });

    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `WMS data extraction failed for date ${currentDate}: ${
          error.message
        } (Retry ${retryCount + 1}/${MAX_RETRY})`,
        type: "error",
      });
    }
    throw error; // Permet au système de retry automatique de fonctionner
  }

  console.log("WMS extraction completed.");
  await updateJob(
    {
      lastRun: new Date(),
      lastLog: "WMS extraction completed.",
      endAt: new Date(),
      actualState: "idle",
    },
    jobName
  );
  // Set the bot to restart
  const bot = await db.models.Users.findOne({
    where: { isBot: true },
  });
  if (bot) {
    bot.update({ needsRestart: true });
  }

  // Send notification to admins
  const admins = await db.models.Users.findAll({
    where: { isAdmin: true },
  });

  for (const admin of admins) {
    await db.models.Notifications.create({
      userId: admin.id,
      message: manualDate
        ? `WMS data extraction for ${dayjs(manualDate).format(
            "DD.MM.YYYY"
          )} has been completed.`
        : "WMS data extraction has been completed.",
      type: "success",
    });
  }
};
