import fs from "fs";
import path from "path";
import os from "os";
import dayjs from "dayjs";
import csv from "csv-parser";
import { db } from "../database.js";
import { updateJob } from "./utils.js";

const ONEDRIVE_BUSINESS_PATH = path.join(os.homedir(), "OneDrive - Migros");
const SAV_EXPORT_PATH = path.join(
  ONEDRIVE_BUSINESS_PATH,
  "MLR Export WMS - SAV-Export-AlarmLog"
);
const jobName = "extractSAV";

export const extractSAV = async () => {
  console.log("Starting SAV extraction...");
  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: "Starting SAV extraction...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  try {
    const dateToGet = dayjs().format("YYYY-MM-DD");
    const fileName = `SAV-Export-AlarmLog_${dayjs(dateToGet).format(
      "YYYYMMDD"
    )}_000000.csv`;
    const filePath = path.join(SAV_EXPORT_PATH, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`File ${fileName} does not exist, skipping...`);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `File ${fileName} does not exist, skipping...`,
          endAt: new Date(),
          actualState: "error",
        },
        jobName
      );
      return;
    }

    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Downloading file: ${fileName}`,
      },
      jobName
    );
    const data = [];
    await new Promise((resolve) => {
      fs.createReadStream(filePath, "utf8")
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => data.push(row))
        .on("end", async () => {
          console.log(`Downloaded file: ${fileName}`);
          await updateJob(
            {
              lastRun: new Date(),
              lastLog: `Downloaded file: ${fileName}`,
            },
            jobName
          );
          resolve();
        });
    });

    const formattedData = data.map((line) => {
      const startDate = dayjs(
        line["Time of occurence"],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      );
      const endDate = dayjs(
        line["Acknowledge instant"],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      );
      if (!startDate.isValid() || !endDate.isValid()) return null;
      if (line["Alarm code"] === "M6009.0306") return null; // Don't put in DB the warning from the shuttle
      if (line["Alarm code"] === "M6130.0201") return null; // Don't put in DB the warning from the shuttle
      if (line["Alarm code"] === "M6130.0203") return null; // Don't put in DB the warning from the shuttle
      if (line["Alarm code"] === "M6130.0202") return null; // Don't put in DB the warning from the shuttle
      return {
        dbId: line["Database ID"],
        timeOfOccurence: startDate.format("YYYY-MM-DD HH:mm:ss"),
        timeOfAcknowledge: endDate.format("YYYY-MM-DD HH:mm:ss"),
        duration: dayjs.duration(endDate.diff(startDate)).asSeconds(),
        dataSource: line["Data source"],
        alarmArea: line["Alarm area"],
        alarmCode: line["Alarm code"],
        alarmText: line["Alarm text"],
        severity: line["Severity"],
        classification: line["Classification"],
        assignedUser: line["Assigned user"],
        alarmId:
          `${line["Data source"]}.${line["Alarm area"]}.${line["Alarm code"]}`.toLowerCase(),
      };
    });

    const alarms = await db.models.Datalog.bulkCreate(formattedData, {
      updateOnDuplicate: [
        "timeOfOccurence",
        "timeOfAcknowledge",
        "duration",
        "dataSource",
        "alarmArea",
        "alarmCode",
        "alarmText",
        "severity",
        "classification",
        "assignedUser",
        "alarmId",
      ],
    });
    console.log(
      `Data for ${dateToGet} ${alarms.length} inserted/updated into database.`
    );
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Data for ${dateToGet} ${alarms.length} inserted/updated into database.`,
      },
      jobName
    );

    // Keep only unique alarms from the inserted alarms
    const uniqueAlarms = alarms.filter(
      (alarm, index, self) =>
        index === self.findIndex((a) => a.alarmId === alarm.alarmId)
    );

    for (const alarm of uniqueAlarms) {
      await db.models.Alarms.upsert({
        alarmId: alarm.alarmId,
        dataSource: alarm.dataSource,
        alarmArea: alarm.alarmArea,
        alarmCode: alarm.alarmCode,
        alarmText: alarm.alarmText,
      });
    }
    console.log(
      `Alarms table updated with ${uniqueAlarms.length} unique alarms.`
    );
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Alarms table updated with ${uniqueAlarms.length} unique alarms.`,
      },
      jobName
    );

    console.log("SAV extraction completed.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "SAV extraction completed.",
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
  } catch (error) {
    console.error("Error during SAV extraction:", error);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Error during SAV extraction: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );
  }
};
