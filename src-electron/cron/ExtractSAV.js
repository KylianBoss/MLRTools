import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import Sequelize from "sequelize";
import { getDB } from "../database.js";
import { updateJob } from "./utils.js";

const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");
const jobName = "extractSAV";
const MAX_RETRY = 5;
// Première donnée connue dans Datalogs (migration depuis l'ancien export CSV
// OneDrive) : on balaye depuis cette date pour détecter les jours manquants.
const START_DATE = dayjs("2024-06-13");

const getDatesInDB = async () => {
  const db = getDB();
  const results = await db.query(
    "SELECT DISTINCT DATE(timeOfOccurence) AS date FROM Datalogs ORDER BY date ASC",
    { type: Sequelize.QueryTypes.SELECT }
  );
  return results.map((r) => dayjs(r.date).format("YYYY-MM-DD"));
};

const openMvnConnection = () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return new Sequelize(
    config.mvnDatabase,
    config.mvnUsername,
    config.mvnPassword,
    {
      host: config.mvnHost,
      dialect: "oracle",
      dialectOptions: {
        connectString: config.mvnConnectString,
        connectTimeout: 60000,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000,
      },
      logging: false,
      retry: {
        max: 3,
      },
    }
  );
};

// Construit les lignes Datalog à partir des résultats de lnm.sav_export pour
// un jour donné. La colonne DURATION de la table est un encodage Oracle peu
// fiable (vu en exploration : epoch-relatif plutôt qu'une vraie durée) — la
// durée est donc toujours recalculée depuis les deux timestamps, comme le
// faisait l'ancien parsing CSV.
const formatRows = (rows) => {
  return rows
    .map((row) => {
      const dbId = row.DATABASE_ID;
      if (dbId == null) return null;

      const alarmCode = row.ALARM_CODE;
      if (!alarmCode || alarmCode.trim() === "") return null;

      // Alarmes de WarmUp de la navette, exclues de la DB (cf. ancien
      // parsing CSV dans Alarms.routes.js / ce même fichier).
      if (
        alarmCode === "M6009.0306" ||
        alarmCode === "M6130.0201" ||
        alarmCode === "M6130.0203" ||
        alarmCode === "M6130.0202"
      ) {
        return null;
      }

      const startDate = dayjs(row.TIME_OF_OCCURRENCE).format(
        "YYYY-MM-DD HH:mm:ss"
      );
      const endDate = row.ACKNOWLEDGE_INSTANT
        ? dayjs(row.ACKNOWLEDGE_INSTANT).format("YYYY-MM-DD HH:mm:ss")
        : null;
      if (!dayjs(startDate).isValid()) return null;

      const dataSource = row.DATA_SOURCE;
      const alarmArea = row.ALARM_AREA;
      const alarmId = `${dataSource || ""}.${alarmArea || ""}.${
        alarmCode || ""
      }`.toUpperCase();

      return {
        dbId,
        timeOfOccurence: startDate,
        timeOfAcknowledge: endDate,
        duration: endDate
          ? dayjs(endDate).diff(dayjs(startDate), "seconds")
          : 0,
        dataSource,
        dataSourceName: row.DATA_SOURCE_NAME,
        lacName: row.LAC_NAME,
        lac: row.LAC_NUMBER,
        alarmArea,
        layoutPosition: row.LAYOUT_POSITION,
        alarmCode,
        alarmText: row.ALARM_TEXT,
        severity: row.SEVERITY,
        classification: row.CLASSIFICATION,
        timeOfClassification: row.CLASSIFICATION_INSTANT
          ? dayjs(row.CLASSIFICATION_INSTANT).format("YYYY-MM-DD HH:mm:ss")
          : null,
        assignedUser:
          row.ASSIGNED_USER && row.ASSIGNED_USER.trim() !== ""
            ? row.ASSIGNED_USER
            : null,
        timeOfAssignment: row.ASSIGNMENT_INSTANT
          ? dayjs(row.ASSIGNMENT_INSTANT).format("YYYY-MM-DD HH:mm:ss")
          : null,
        timeOfTreatement: row.PROCESSING_INSTANT
          ? dayjs(row.PROCESSING_INSTANT).format("YYYY-MM-DD HH:mm:ss")
          : null,
        alarmId,
      };
    })
    .filter((d) => d !== null);
};

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
    throw new Error(
      `Maximum retry count reached (${MAX_RETRY}), aborting extraction for date ${date}`
    );
  }

  console.log("Starting SAV extraction...");
  await updateJob(
    {
      lastRun: new Date(),
      actualState: "running",
      lastLog: date
        ? `Starting SAV extraction for the ${dayjs(date).format(
            "DD.MM.YYYY"
          )}...`
        : "Starting SAV extraction...",
      startAt: new Date(),
      endAt: null,
    },
    jobName
  );

  const MVNDB = openMvnConnection();

  if (
    !(await MVNDB.authenticate()
      .then(() => true)
      .catch(async (error) => {
        await updateJob(
          {
            lastRun: new Date(),
            lastLog: JSON.stringify(error),
            endAt: new Date(),
            actualState: "error",
          },
          jobName
        );
        return false;
      }))
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

  // Dates déjà présentes en base
  const datesInDB = date ? null : await getDatesInDB();

  // Veille + jours manquants depuis START_DATE
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  const datesToProcess = date
    ? [dayjs(date).format("YYYY-MM-DD")]
    : Array.from(
        { length: dayjs(yesterday).diff(START_DATE, "day") + 1 },
        (_, i) => START_DATE.add(i, "day").format("YYYY-MM-DD")
      ).filter((d) => !datesInDB.includes(d));

  console.log("Dates to process:", datesToProcess);
  await updateJob(
    {
      lastRun: new Date(),
      lastLog: `Dates to process: ${datesToProcess.join(", ")}`,
    },
    jobName
  );

  let currentDate = null;
  try {
    for (const d of datesToProcess) {
      currentDate = d;

      const results = await MVNDB.query(
        `SELECT * FROM lnm.sav_export WHERE TRUNC(TIME_OF_OCCURRENCE) = TO_DATE('${d}', 'YYYY-MM-DD')`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      console.log(`Found ${results.length} SAV records for ${d}`);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Found ${results.length} SAV records for ${d}`,
        },
        jobName
      );

      const formattedData = formatRows(results);
      console.log(
        `Formatted ${formattedData.length} records for ${d}, inserting into database...`
      );
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Formatted ${formattedData.length} records for ${d}, inserting into database...`,
        },
        jobName
      );

      const alarms = await db.models.Datalog.bulkCreate(formattedData, {
        updateOnDuplicate: [
          "timeOfOccurence",
          "timeOfAcknowledge",
          "duration",
          "dataSource",
          "dataSourceName",
          "lacName",
          "lac",
          "alarmArea",
          "layoutPosition",
          "alarmCode",
          "alarmText",
          "severity",
          "classification",
          "timeOfClassification",
          "assignedUser",
          "timeOfAssignment",
          "timeOfTreatement",
          "alarmId",
        ],
      });
      console.log(
        `Data for ${d}: ${formattedData.length} inserted/updated into database.`
      );
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Data for ${d}: ${formattedData.length} inserted/updated into database.`,
        },
        jobName
      );

      // Garde uniquement les alarmes uniques parmi celles insérées
      const uniqueAlarms = new Set([...alarms].map((a) => a.alarmId));
      const uniqueAlarmsData = [...uniqueAlarms].map((alarmId) =>
        alarms.find((a) => a.alarmId === alarmId)
      );
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

      // Flush cache tables pour ce jour
      await db.models.cache_ErrorsByThousand.destroy({ where: { date: d } });
      await db.models.cache_DowntimeMinutesByThousand.destroy({
        where: { date: d },
      });
      await db.models.cache_CustomCharts.destroy({ where: { date: d } });

      console.log(`Data for ${d} processed.`);
      await updateJob(
        {
          lastRun: new Date(),
          lastLog: `Data for ${d} processed.`,
        },
        jobName
      );
    }

    await MVNDB.close();
    console.log("MVN database connection closed.");
  } catch (error) {
    console.error(`Failed to process data for date ${currentDate}:`, error);

    try {
      await MVNDB.close();
      console.log("MVN database connection closed (after error).");
    } catch (closeError) {
      console.error("Error closing MVN connection:", closeError);
    }

    await updateJob(
      {
        lastRun: new Date(),
        lastLog: `Failed to process data for date ${currentDate}: ${error.message}`,
        endAt: new Date(),
        actualState: "error",
      },
      jobName
    );

    const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
    for (const admin of admins) {
      await db.models.Notifications.create({
        userId: admin.id,
        message: `SAV data extraction failed for date ${currentDate}: ${
          error.message
        } (Retry ${retryCount + 1}/${MAX_RETRY})`,
        type: "error",
      });
    }
    // Le retry est géré automatiquement par le processeur de queue (processJobQueue)
    throw error;
  }

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

  const admins = await db.models.Users.findAll({ where: { isAdmin: true } });
  for (const admin of admins) {
    await db.models.Notifications.create({
      userId: admin.id,
      message: date
        ? `SAV data extraction for ${dayjs(date).format(
            "DD.MM.YYYY"
          )} has been completed.`
        : "SAV data extraction has been completed.",
      type: "success",
    });
  }
};
