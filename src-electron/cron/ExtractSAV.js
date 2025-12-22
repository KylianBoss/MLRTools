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

export const extractSAV = async (date = null) => {
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
    const dateToGet =
      date != null
        ? dayjs(date).add(1, "day").format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD");
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
      throw new Error(`File ${fileName} does not exist.`);
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

    const fd = data.map(async (line) => {
      const startDate = dayjs(
        line["Time of occurrence"],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      );
      const endDate = dayjs(
        line["Acknowledge instant"],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      );
      if (!startDate.isValid() || !endDate.isValid()) return null;

      const alarmCode = line["Alarm code"];
      if (!alarmCode || alarmCode.trim() === "") return null; // Skip if no

      const dbId = line["Database ID"];
      if (!dbId || dbId.trim() === "") return null; // Skip if no DB ID

      const dataSource = line["Data source"];
      const alarmArea = line["Alarm area"];
      const alarmText = line["Alarm text"];
      const severity = line["Severity"];
      const classification = line["Classification"];
      const assignedUser = line["Assigned user"];
      const alarmId = `${dataSource || ""}.${alarmArea || ""}.${
        alarmCode || ""
      }`.toUpperCase();

      if (alarmCode === "M6009.0306") return null; // Don't put in DB the warning from the shuttle
      if (alarmCode === "M6130.0201") return null; // Don't put in DB the warning from the shuttle
      if (alarmCode === "M6130.0203") return null; // Don't put in DB the warning from the shuttle
      if (alarmCode === "M6130.0202") return null; // Don't put in DB the warning from the shuttle

      console.log(
        "ALARM",
        dbId,
        dataSource,
        alarmArea,
        alarmCode,
        alarmText,
        severity,
        classification,
        assignedUser,
        alarmId
      );
      return {
        dbId,
        timeOfOccurence: startDate.format("YYYY-MM-DD HH:mm:ss"),
        timeOfAcknowledge: endDate.format("YYYY-MM-DD HH:mm:ss"),
        duration: dayjs.duration(endDate.diff(startDate)).asSeconds(),
        dataSource,
        alarmArea,
        alarmCode,
        alarmText,
        severity,
        classification,
        assignedUser,
        alarmId,
      };
    });
    const formattedData = (await Promise.all(fd)).filter((d) => d !== null);
    console.log("Formatted data prepared, inserting into database...");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "Formatted data prepared, inserting into database...",
      },
      jobName
    );

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
      `Data for ${dateToGet} ${formattedData.length} inserted/updated into database.`
    );
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Data for ${dateToGet} ${formattedData.length} inserted/updated into database.`,
      },
      jobName
    );

    // Keep only unique alarms from the inserted alarms
    const uniqueAlarms = new Set([...alarms].map((a) => a.alarmId));
    const uniqueAlarmsData = [...uniqueAlarms].map((alarmId) => {
      return alarms.find((a) => a.alarmId === alarmId);
    });
    console.log(
      `Updating Alarms table with ${uniqueAlarmsData.length} unique alarms...`
    );
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Updating Alarms table with ${uniqueAlarmsData.length} unique alarms...`,
      },
      jobName
    );

    for (const alarm of uniqueAlarmsData) {
      await db.models.Alarms.upsert({
        alarmId: alarm.alarmId,
        dataSource: alarm.dataSource,
        alarmArea: alarm.alarmArea,
        alarmCode: alarm.alarmCode,
        alarmText: alarm.alarmText,
      });
    }
    console.log(
      `Alarms table updated with ${uniqueAlarmsData.length} unique alarms.`
    );
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Alarms table updated with ${uniqueAlarmsData.length} unique alarms.`,
      },
      jobName
    );

    // Flush cache tables
    await db.models.cache_ErrorsByThousand.destroy({
      where: {
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD")
      }
    });
    await db.models.cache_DowntimeMinutesByThousand.destroy({
      where: {
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD")
      }
    });
    await db.models.cache_CustomCharts.destroy({
      where: {
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD")
      }
    });

    console.log("SAV extraction completed.");
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: "SAV extraction completed.",
        endAt: new Date(),
        actualState: "idle",
        cronExpression: "15 5 * * *",
        args: null,
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
        message: `SAV data extraction for ${dayjs(dateToGet).subtract(1, 'day').format("DD.MM.YYYY")} has been completed.`,
        type: "success",
      });
    }
  } catch (error) {
    console.error("Error during SAV extraction:", error);
    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Error during SAV extraction: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
        cronExpression: "15 5 * * *",
        args: null,
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
        message: `SAV data extraction failed: ${error.message}`,
        type: "error",
      });
    }
  }
};
