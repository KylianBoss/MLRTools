import fs from "fs";
import path from "path";
import os from "os";
import dayjs from "dayjs";
import csv from "csv-parser";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";

const ONEDRIVE_BUSINESS_PATH = path.join(os.homedir(), "OneDrive - Migros");
const SAV_EXPORT_PATH = path.join(
  ONEDRIVE_BUSINESS_PATH,
  "MLR Export WMS - SAV-Export-AlarmLog"
);
const jobName = "extractSAV";
const MAX_RETRY = 5;

export const extractSAV = async (date = null, retryCount = 0) => {
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
      const dbId = line[0];
      if (!dbId || dbId.trim() === "") return null; // Skip if no DB ID
      const startDate = dayjs(line[1], "D MMM YYYY à HH:mm:ss", "fr").format(
        "YYYY-MM-DD HH:mm:ss"
      );
      const endDate = dayjs(line[2], "D MMM YYYY à HH:mm:ss", "fr").format(
        "YYYY-MM-DD HH:mm:ss"
      );
      if (!startDate.isValid() || !endDate.isValid()) return null;
      const duration = line[3] || 0;
      const acknowledged = line[4];
      const dataSource = line[5];
      const dataSourceName = line[6];
      const lacName = line[7];
      const lac = line[8];
      const alarmArea = line[9];
      const layoutPosition = line[10];
      const alarmCode = line[11];
      if (!alarmCode || alarmCode.trim() === "") return null; // Skip if no
      const alarmText = line[12];
      const severity = line[13];
      const classification = line[14];
      const timeOfClassification = dayjs(
        line[15],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      ).format("YYYY-MM-DD HH:mm:ss");
      const assignedUser = line[16];
      const timeOfAssignment = dayjs(
        line[17],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      ).format("YYYY-MM-DD HH:mm:ss");
      const timeOfTreatement = dayjs(
        line[18],
        "D MMM YYYY à HH:mm:ss",
        "fr"
      ).format("YYYY-MM-DD HH:mm:ss");
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
        startDate,
        endDate,
        duration,
        acknowledged,
        dataSource,
        dataSourceName,
        lacName,
        lac,
        alarmArea,
        layoutPosition,
        alarmCode,
        alarmText,
        severity,
        classification,
        timeOfClassification,
        assignedUser,
        timeOfAssignment,
        timeOfTreatement,
        alarmId
      );
      return {
        dbId,
        timeOfOccurence: startDate,
        timeOfAcknowledge: endDate,
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
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD"),
      },
    });
    await db.models.cache_DowntimeMinutesByThousand.destroy({
      where: {
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD"),
      },
    });
    await db.models.cache_CustomCharts.destroy({
      where: {
        date: dayjs(dateToGet).subtract(1, "day").format("YYYY-MM-DD"),
      },
    });

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
    // Send notification to admins
    const admins = await db.models.Users.findAll({
      where: { isAdmin: true },
    });

    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `SAV data extraction for ${dayjs(dateToGet)
          .subtract(1, "day")
          .format("DD.MM.YYYY")} has been completed.`,
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
        message: `SAV data extraction failed: ${error.message} (Retry ${
          retryCount + 1
        }/${MAX_RETRY})`,
        type: "error",
      });
    }
    // Le retry est géré automatiquement par le processeur de queue (processJobQueue)
    return Promise.reject(error);
  }
};
