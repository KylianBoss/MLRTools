import { Router } from "express";
import { getDB } from "../database.js";
import { Op, QueryTypes, Sequelize } from "sequelize";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import "dayjs/locale/fr.js";
import csv from "csv-parser";
import { Readable } from "stream";
import { requireAnyPermission, requirePermission } from "../middlewares/permissions.js";

dayjs.extend(customParseFormat);
dayjs.locale("fr");

const router = Router();

// --- Suivi en direct de l'import manuel d'alarmes (SSE) ---
// Un client ouvre d'abord le flux SSE avec un importId, puis lance le POST
// d'import en référençant ce même importId. Les logs sont poussés au fil de l'eau.
const importStreams = new Map();

function pushImportLog(importId, level, message) {
  const client = importStreams.get(importId);
  const entry = { level, message, timestamp: new Date().toISOString() };
  console.log(`[import-alarms:${importId}] ${message}`);
  if (client) {
    client.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
}

function endImportStream(importId) {
  const client = importStreams.get(importId);
  if (client) {
    client.end();
    importStreams.delete(importId);
  }
}

router.get("/import-alarms/stream/:importId", (req, res) => {
  const { importId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(
    `data: ${JSON.stringify({
      level: "info",
      message: "Connexion établie, en attente de l'import...",
      timestamp: new Date().toISOString(),
    })}\n\n`
  );
  importStreams.set(importId, res);

  req.on("close", () => {
    importStreams.delete(importId);
  });
});

router.post("/", async (req, res) => {
  const db = getDB();
  try {
    const alarms = await db.models.Datalog.bulkCreate(req.body.data, {
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

    res.sendStatus(201);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/import-alarms", async (req, res) => {
  const db = getDB();
  const { data, importId } = req.body;
  if (!data) {
    res.status(400).json({ error: "No data provided" });
    return;
  }

  const log = (message) => importId && pushImportLog(importId, "info", message);
  const logError = (message) => importId && pushImportLog(importId, "error", message);
  const logSuccess = (message) => importId && pushImportLog(importId, "success", message);

  const response = {
    recieved: 0,
    parsed: 0,
    inserted: 0,
  };

  try {
    log("Lecture du fichier CSV...");
    // Même logique de parsing que le cron d'extraction SAV (extractSAV) :
    // lecture par position de colonne via csv-parser, séparateur ";".
    // Le split maison précédent cassait dès qu'un champ contenait un ";"
    // ou un retour chariot, et le mapping par nom d'en-tête ne correspondait
    // plus aux en-têtes réels de l'export -> toutes les lignes étaient rejetées.
    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from([data])
        .pipe(csv({ separator: ";", headers: false }))
        .on("data", (row) => rows.push(Object.values(row)))
        .on("end", resolve)
        .on("error", reject);
    });
    // La première ligne du fichier est l'en-tête, on l'ignore
    const lines = rows.slice(1);
    log(`Fichier lu : ${lines.length} lignes de données détectées.`);
    response.recieved = lines.length;

    log("Analyse et conversion des lignes...");
    const formattedAlarms = lines.map((line) => {
      const dbId = line[0];
      const startDate = dayjs(line[1], "D MMM YYYY à HH:mm:ss", "fr").format(
        "YYYY-MM-DD HH:mm:ss"
      );
      const endDate = dayjs(line[2], "D MMM YYYY à HH:mm:ss", "fr").format(
        "YYYY-MM-DD HH:mm:ss"
      );
      const dataSource = line[5];
      const dataSourceName = line[6];
      const lacName = line[7];
      const lac = line[8];
      const alarmArea = line[9];
      const layoutPosition = line[10];
      const alarmCode = line[11];
      const alarmText = line[12];
      const severity = line[13];
      const classification = line[14];
      const assignedUser = line[16];
      const alarmId = `${dataSource || ""}.${alarmArea || ""}.${
        alarmCode || ""
      }`.toUpperCase();

      return {
        dbId,
        timeOfOccurence: startDate,
        timeOfAcknowledge: endDate,
        duration:
          dayjs(startDate).isValid() && dayjs(endDate).isValid()
            ? dayjs(endDate).diff(dayjs(startDate), "seconds")
            : null,
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
        assignedUser,
        alarmId,
        _startDateValid: dayjs(startDate).isValid(),
        _endDateValid: dayjs(endDate).isValid(),
      };
    });

    const IGNORED_ALARM_CODES = [
      "M6009.0306",
      "M6130.0201",
      "M6130.0203",
      "M6130.0202",
    ];
    let rejectedNoDbId = 0;
    let rejectedNoAlarmCode = 0;
    let rejectedShuttleWarning = 0;
    let rejectedInvalidDate = 0;
    let rejectedMissingRequired = 0;

    const parsedAlarms = formattedAlarms
      .filter((fa) => {
        if (!fa.dbId || fa.dbId.trim() === "") {
          rejectedNoDbId++;
          return false;
        }
        if (!fa.alarmCode || fa.alarmCode.trim() === "") {
          rejectedNoAlarmCode++;
          return false;
        }
        if (IGNORED_ALARM_CODES.includes(fa.alarmCode)) {
          rejectedShuttleWarning++;
          return false;
        }
        if (!fa._startDateValid || !fa._endDateValid) {
          rejectedInvalidDate++;
          return false;
        }
        if (!fa.dataSource || !fa.alarmText) {
          rejectedMissingRequired++;
          return false;
        }
        return true;
      })
      .map(({ _startDateValid, _endDateValid, ...fa }) => fa);

    if (rejectedNoDbId) log(`${rejectedNoDbId} ligne(s) ignorée(s) : Database ID manquant.`);
    if (rejectedNoAlarmCode) log(`${rejectedNoAlarmCode} ligne(s) ignorée(s) : code d'alarme manquant.`);
    if (rejectedShuttleWarning) log(`${rejectedShuttleWarning} ligne(s) ignorée(s) : avertissements navette exclus.`);
    if (rejectedInvalidDate) log(`${rejectedInvalidDate} ligne(s) ignorée(s) : date d'occurrence ou d'acquittement invalide.`);
    if (rejectedMissingRequired) log(`${rejectedMissingRequired} ligne(s) ignorée(s) : source ou texte d'alarme manquant.`);

    log(`${parsedAlarms.length} alarme(s) valide(s) après filtrage.`);
    response.parsed = parsedAlarms.length;

    if (parsedAlarms.length === 0) {
      logError("Aucune alarme valide à importer. Vérifiez le format du fichier.");
      res.status(400).json({ ...response, error: "Aucune alarme valide à importer" });
      endImportStream(importId);
      return;
    }

    log("Insertion dans la base de données...");
    const bulk = await db.models.Datalog.bulkCreate(parsedAlarms, {
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
        "assignedUser",
        "alarmId",
      ],
      validate: true,
    });
    log(`${bulk.length} alarme(s) insérée(s)/mise(s) à jour dans Datalog.`);
    response.inserted = bulk.length;

    // Keep only unique alarms from the parsed alarms
    const uniqueAlarms = parsedAlarms.filter(
      (alarm, index, self) =>
        index === self.findIndex((a) => a.alarmId === alarm.alarmId)
    );

    log(`Mise à jour du référentiel Alarms (${uniqueAlarms.length} code(s) unique(s))...`);
    for (const alarm of uniqueAlarms) {
      await db.models.Alarms.upsert({
        alarmId: alarm.alarmId,
        dataSource: alarm.dataSource,
        alarmArea: alarm.alarmArea,
        alarmCode: alarm.alarmCode,
        alarmText: alarm.alarmText,
      });
    }

    logSuccess(`Importation terminée : ${response.inserted}/${response.recieved} alarmes insérées.`);
    res.status(201).json(response);
    endImportStream(importId);
  } catch (error) {
    console.error("Error importing alarms:", error);
    logError(`Erreur durant l'importation : ${error.message}`);
    res.status(500).json({ error: error.message });
    endImportStream(importId);
  }
});

router.get("/", async (req, res) => {
  const db = getDB();
  const { startRow, count, filter, sortBy, descending, sum } = req.body;
  try {
    if (sum) {
      let query = `
          SELECT
            alarmId,
            MAX(dataSource) as dataSource",
            MAX(alarmArea) as alarmArea",
            MAX(alarmCode) as alarmCode",
            MAX(alarmText) as alarmText",
            MAX(severity) as severity",
            MAX(classification) as classification,
            COUNT(*) as count
          FROM
            datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
        `;
      if (!!!filter.excluded) {
        query += `
            AND alarmId NOT IN (SELECT alarmId FROM ExcludedAlarms)
          `;
      }
      query += `
          GROUP BY
            alarmId
          ORDER BY
            :order
          LIMIT :count
          OFFSET :startRow
        `;

      const result = await db.query(query, {
        replacements: {
          from: filter.date.from,
          to: filter.date.to,
          order: `${sortBy} ${descending ? "DESC" : "ASC"}`,
          count,
          startRow,
        },
        type: QueryTypes.SELECT,
      });

      const translations = await db.models.AlarmTranslations.findAll();
      res.json(
        result.map((r) => {
          const translation = translations.find((t) => t.alarmId === r.alarmId);
          return {
            ...r,
            alarmText: translation ? translation.translation : r.alarmText,
          };
        })
      );
      return;
    }

    let where = {
      timeOfOccurence: {
        [Op.between]: [filter.date.from, filter.date.to],
      },
    };
    if (!!!filter.excluded) {
      where.alarmId = {
        [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
      };
    }
    if (!!!filter.excludedCode) {
      where.alarmCode = {
        [Op.notIn]: db.literal(`(SELECT alarmCode FROM ExcludedAlarmCodes)`),
      };
    }
    if (filter.like) {
      const terms = filter.like.split(" ");
      where = {
        ...where,
        [Op.or]: [
          {
            alarmText: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            alarmArea: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            alarmCode: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            dataSource: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
        ],
      };
    }

    const alarms = await db.models.Datalog.findAll({
      limit: count,
      offset: startRow,
      order: [[sortBy, descending ? "DESC" : "ASC"]],
      where,
    });
    const translations = await db.models.AlarmTranslations.findAll();
    const translatedMessages = alarms.map((m) => {
      const translation = translations.find((t) => t.alarmId === m.alarmId);
      return {
        ...m.toJSON(),
        alarmText: translation ? translation.translation : m.alarmText,
      };
    });

    res.json(translatedMessages);
  } catch (error) {
    console.error("Error fetching alarms:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/count", async (req, res) => {
  const db = getDB();
  const { date, excluded, like = null, sum = false } = req.body;
  try {
    let where = {
      timeOfOccurence: {
        [Op.between]: [date.from, date.to],
      },
    };
    if (!!!excluded) {
      where.alarmId = {
        [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
      };
    }
    if (!!!filter.excludedCode) {
      where.alarmCode = {
        [Op.notIn]: db.literal(`(SELECT alarmCode FROM ExcludedAlarmCodes)`),
      };
    }
    if (like) {
      const terms = like.split(" ");
      where = {
        ...where,
        [Op.or]: [
          {
            alarmText: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            alarmArea: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            alarmCode: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
          {
            dataSource: {
              [Op.like]: `%${terms.join("%")}%`,
            },
          },
        ],
      };
    }

    const count = await db.models.Datalog.count({
      where,
    });

    res.json(count);
  } catch (error) {
    console.error("Error fetching alarm count:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/day", async (req, res) => {
  const db = getDB();
  try {
    const dates = await db.query(
      "SELECT DISTINCT DATE(timeOfOccurence) as date FROM Datalogs ORDER BY date",
      {
        type: QueryTypes.SELECT,
      }
    );
    res.status(200).json(dates.map((d) => d.date));
  } catch (error) {
    console.error("Error fetching dates:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/day/:date", async (req, res) => {
  const db = getDB();
  try {
    const alarms = await db.models.Datalog.findAll({
      where: {
        timeOfOccurence: {
          [Op.between]: [
            `${req.params.date} 00:00:00`,
            `${req.params.date} 23:59:59`,
          ],
        },
      },
    });
    res.json(alarms);
  } catch (error) {
    console.error("Error fetching alarms:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/by-users/:from/:to", async (req, res) => {
  const db = getDB();
  const { from, to } = req.params;

  if (!from || !to) {
    res.status(400).json({ error: "No dates provided" });
    return;
  }

  try {
    db.query("CALL getAlarmsByUser(:from, :to)", {
      replacements: {
        from,
        to,
      },
    }).then((result) => {
      res.json(result);
    });
  } catch (error) {
    console.error("Error fetching alarms by users:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/unique", async (req, res) => {
  const db = getDB();
  try {
    const alarms = await db.models.Alarms.findAll({
      attributes: [
        "alarmId",
        "dataSource",
        "alarmArea",
        "alarmCode",
        "alarmText",
        "type",
      ],
      order: [["alarmId", "ASC"]],
    });
    const translations = await db.models.AlarmTranslations.findAll();
    res.json(
      alarms.map((a) => {
        const translation = translations.find((t) => t.alarmId === a.alarmId);
        // const lastOccurence = db.models.Datalog.findOne({
        //   where: {
        //     alarmId: a.alarmId,
        //   },
        //   order: [["timeOfOccurence", "DESC"]],
        //   limit: 1,
        // });
        return {
          ...a.toJSON(),
          alarmText: translation ? translation.translation : a.alarmText,
          // lastOccurence: lastOccurence.timeOfOccurence,
        };
      })
    );
  } catch (error) {
    console.error("Error fetching unique alarms:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/messages", async (req, res) => {
  const db = getDB();
  const { from, to, includesExcluded = false } = req.body;
  try {
    const where = {
      timeOfOccurence: {
        [Op.between]: [from, to],
      },
    };
    if (!!!includesExcluded) {
      where.alarmId = {
        [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
      };
    }
    const messages = await Datalog.findAll({
      where,
    });

    const translations = await db.models.AlarmTranslations.findAll();
    const translatedMessages = messages.map((m) => {
      const translation = translations.find((t) => t.alarmId === m.alarmId);
      return {
        ...m.toJSON(),
        alarmText: translation ? translation.translation : m.alarmText,
      };
    });

    res.json(translatedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/translate", async (req, res) => {
  const db = getDB();
  const { alarmId, translation } = req.body;

  if (!alarmId || !translation) {
    res.status(400).json({ error: "Alarm ID and translation are required" });
    return;
  }

  try {
    const alarm = await db.models.AlarmTranslations.upsert({
      alarmId,
      translation,
    });
    res.json(alarm);
  } catch (error) {
    console.error("Error translating alarm:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/primary", async (req, res) => {
  const db = getDB();
  const { alarmId } = req.body;

  if (!alarmId) {
    res.status(400).json({ error: "Alarm ID is required" });
    return;
  }

  try {
    const alarm = await db.models.Alarms.update(
      { type: "primary" },
      {
        where: {
          alarmId,
        },
      }
    );

    // Remove data from the cache
    const a = await db.models.Alarms.findOne({
      where: {
        alarmId,
      },
    });
    if (a && a.dataSource) {
      const groupsToClear = await db.models.ZoneGroups.findAll({
        where: Sequelize.literal(`JSON_CONTAINS(zones, '"${a.dataSource}"')`),
      });
      if (groupsToClear.length > 0) {
        const groupNames = groupsToClear.map((g) => g.zoneGroupName);
        if (db.models.ErrorsByThousandSaved) {
          await db.models.ErrorsByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
        if (db.models.DowntimeMinutesByThousandSaved) {
          await db.models.DowntimeMinutesByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
      }
    }

    res.json(alarm);
  } catch (error) {
    console.error("Error updating primary status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/secondary", async (req, res) => {
  const db = getDB();
  const { alarmId } = req.body;

  if (!alarmId) {
    res.status(400).json({ error: "Alarm ID is required" });
    return;
  }

  try {
    const alarm = await db.models.Alarms.update(
      { type: "secondary" },
      {
        where: {
          alarmId,
        },
      }
    );

    // Remove data from the cache
    const a = await db.models.Alarms.findOne({
      where: {
        alarmId,
      },
    });
    if (a && a.dataSource) {
      const groupsToClear = await db.models.ZoneGroups.findAll({
        where: Sequelize.literal(`JSON_CONTAINS(zones, '"${a.dataSource}"')`),
      });
      if (groupsToClear.length > 0) {
        const groupNames = groupsToClear.map((g) => g.zoneGroupName);
        if (db.models.ErrorsByThousandSaved) {
          await db.models.ErrorsByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
        if (db.models.DowntimeMinutesByThousandSaved) {
          await db.models.DowntimeMinutesByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
      }
    }

    res.json(alarm);
  } catch (error) {
    console.error("Error updating secondary status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/human", async (req, res) => {
  const db = getDB();
  const { alarmId } = req.body;

  if (!alarmId) {
    res.status(400).json({ error: "Alarm ID is required" });
    return;
  }

  try {
    const alarm = await db.models.Alarms.update(
      { type: "human" },
      {
        where: {
          alarmId,
        },
      }
    );

    // Remove data from the cache
    const a = await db.models.Alarms.findOne({
      where: {
        alarmId,
      },
    });
    if (a && a.dataSource) {
      const groupsToClear = await db.models.ZoneGroups.findAll({
        where: Sequelize.literal(`JSON_CONTAINS(zones, '"${a.dataSource}"')`),
      });
      if (groupsToClear.length > 0) {
        const groupNames = groupsToClear.map((g) => g.zoneGroupName);
        if (db.models.ErrorsByThousandSaved) {
          await db.models.ErrorsByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
        if (db.models.DowntimeMinutesByThousandSaved) {
          await db.models.DowntimeMinutesByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
      }
    }

    res.json(alarm);
  } catch (error) {
    console.error("Error updating human status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/other", async (req, res) => {
  const db = getDB();
  const { alarmId } = req.body;
  if (!alarmId) {
    res.status(400).json({ error: "Alarm ID is required" });
    return;
  }
  try {
    const alarm = await db.models.Alarms.update(
      { type: "other" },
      {
        where: {
          alarmId,
        },
      }
    );

    // Remove data from the cache
    const a = await db.models.Alarms.findOne({
      where: {
        alarmId,
      },
    });
    if (a && a.dataSource) {
      const groupsToClear = await db.models.ZoneGroups.findAll({
        where: Sequelize.literal(`JSON_CONTAINS(zones, '"${a.dataSource}"')`),
      });
      if (groupsToClear.length > 0) {
        const groupNames = groupsToClear.map((g) => g.zoneGroupName);
        if (db.models.ErrorsByThousandSaved) {
          await db.models.ErrorsByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
        if (db.models.DowntimeMinutesByThousandSaved) {
          await db.models.DowntimeMinutesByThousandSaved.destroy({
            where: {
              groupName: groupNames,
            },
          });
        }
      }
    }

    res.json(alarm);
  } catch (error) {
    console.error("Error updating other status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/daily-analysis", async (req, res) => {
  try {
    const db = getDB();

    const targetDate = req.query.date
      ? dayjs(req.query.date)
      : dayjs().subtract(1, "day");

    const MIN_ALARM_DURATION = await db.models.Settings.getValue(
      "MIN_ALARM_DURATION"
    );

    const primaryAlarms = await db.models.Alarms.findAll({
      where: {
        type: "primary",
      },
      attributes: ["alarmId"],
    }).then((primaryAlarms) => primaryAlarms.map((a) => a.alarmId));
    const alarms = await db.models.Datalog.findAll({
      where: {
        duration: {
          [Op.gte]: MIN_ALARM_DURATION,
        },
        timeOfOccurence: {
          [Op.between]: [
            targetDate.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
            targetDate.endOf("day").format("YYYY-MM-DD HH:mm:ss"),
          ],
        },
        alarmId: primaryAlarms,
      },
      order: [["timeOfOccurence", "ASC"]],
    });

    res.json(alarms);
  } catch (e) {
    console.error("Error fetching daily analysis alarms:", e);
    res.status(500).json({ error: e.message });
  }
});

// Update alarm state (planned/unplanned)
router.patch(
  "/update-state",
  requireAnyPermission(["canMarkAsPlanned", "canAccessDailyAnalysis"]),
  async (req, res) => {
    try {
      const db = getDB();
      const { dbId, state, updateGroup = false } = req.body;

      if (!dbId || !state) {
        return res.status(400).json({ error: "dbId and state are required" });
      }

      if (!["planned", "unplanned"].includes(state)) {
        return res.status(400).json({ error: "Invalid state value" });
      }

      // Get the alarm to check if it's part of a group
      const alarm = await db.models.Datalog.findOne({ where: { dbId } });

      if (!alarm) {
        return res.status(404).json({ error: "Alarm not found" });
      }

      // Update the alarm state
      await db.models.Datalog.update({ x_state: state }, { where: { dbId } });

      let updatedCount = 1;
      let affectedDbIds = [dbId];

      // If updateGroup is true and alarm is part of a group, update all alarms in the group
      if (updateGroup && alarm.x_group) {
        const groupResult = await db.models.Datalog.update(
          { x_state: state },
          { where: { x_group: alarm.x_group } }
        );

        // Get all affected alarm IDs
        const groupAlarms = await db.models.Datalog.findAll({
          where: { x_group: alarm.x_group },
          attributes: ["dbId"],
        });

        affectedDbIds = groupAlarms.map((a) => a.dbId);
        updatedCount = groupResult[0];
      }

      res.json({ success: true, updatedCount, affectedDbIds });
    } catch (e) {
      console.error("Error updating alarm state:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// Mark alarm as treated
router.patch(
  "/mark-treated",
  requireAnyPermission(["canMarkAsTreated", "canAccessDailyAnalysis"]),
  async (req, res) => {
    try {
      const db = getDB();
      const { dbIds } = req.body;

      if (!dbIds || !Array.isArray(dbIds)) {
        return res.status(400).json({ error: "dbIds array is required" });
      }

      await db.models.Datalog.update(
        { x_treated: true },
        { where: { dbId: dbIds } }
      );

      res.json({ success: true, count: dbIds.length });
    } catch (e) {
      console.error("Error marking alarms as treated:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// Update alarm comment
router.patch(
  "/update-comment",
  requireAnyPermission([
    "canUpdateComment",
    "canAddComment",
    "canAccessDailyAnalysis",
  ]),
  async (req, res) => {
    try {
      const db = getDB();
      const { dbId, comment } = req.body;

      if (!dbId) {
        return res.status(400).json({ error: "dbId is required" });
      }

      // Trouver l'alarme et son groupe
      const alarm = await db.models.Datalog.findOne({ where: { dbId } });

      if (!alarm) {
        return res.status(404).json({ error: "Alarm not found" });
      }

      // Si l'alarme fait partie d'un groupe, mettre à jour toutes les alarmes du groupe
      if (alarm.x_group) {
        await db.models.Datalog.update(
          { x_comment: comment },
          { where: { x_group: alarm.x_group } }
        );

        const count = await db.models.Datalog.count({
          where: { x_group: alarm.x_group },
        });
        res.json({ success: true, updatedCount: count });
      } else {
        // Sinon, mettre à jour seulement cette alarme
        await db.models.Datalog.update(
          { x_comment: comment },
          { where: { dbId } }
        );
        res.json({ success: true, updatedCount: 1 });
      }
    } catch (e) {
      console.error("Error updating alarm comment:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// Group alarms together
router.post(
  "/group-alarms",
  requireAnyPermission(["canGroupAlarms", "canAccessDailyAnalysis"]),
  async (req, res) => {
    try {
      const db = getDB();
      const { dbIds, existingGroupId } = req.body;

      if (!dbIds || !Array.isArray(dbIds) || dbIds.length < 2) {
        return res
          .status(400)
          .json({ error: "At least 2 dbIds are required to group" });
      }

      let groupId;
      let isNewGroup = false;

      if (existingGroupId) {
        // Utiliser le groupe existant
        groupId = existingGroupId;

        // Récupérer le commentaire, x_state et x_treated du groupe existant
        const existingAlarm = await db.models.Datalog.findOne({
          where: { x_group: existingGroupId },
        });

        if (existingAlarm) {
          // Copier les propriétés du groupe sur les nouvelles alarmes
          await db.models.Datalog.update(
            {
              x_group: groupId,
              x_comment: existingAlarm.x_comment,
              x_state: existingAlarm.x_state,
              x_treated: existingAlarm.x_treated,
            },
            { where: { dbId: dbIds } }
          );
        } else {
          // Fallback si pas d'alarme trouvée dans le groupe
          await db.models.Datalog.update(
            { x_group: groupId },
            { where: { dbId: dbIds } }
          );
        }
      } else {
        // Créer un nouveau groupe
        const maxGroup = await db.models.Datalog.max("x_group");
        groupId = (maxGroup || 0) + 1;
        isNewGroup = true;

        // Update all alarms with the group ID
        await db.models.Datalog.update(
          { x_group: groupId },
          { where: { dbId: dbIds } }
        );
      }

      res.json({ success: true, groupId, count: dbIds.length, isNewGroup });
    } catch (e) {
      console.error("Error grouping alarms:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// Ungroup alarm
router.patch(
  "/ungroup-alarm",
  requireAnyPermission(["canUngroupAlarms", "canAccessDailyAnalysis"]),
  async (req, res) => {
    try {
      const db = getDB();
      const { dbId } = req.body;

      if (!dbId) {
        return res.status(400).json({ error: "dbId is required" });
      }

      await db.models.Datalog.update({ x_group: null }, { where: { dbId } });

      res.json({ success: true });
    } catch (e) {
      console.error("Error ungrouping alarm:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

// --- AutoGroupRules CRUD ---

router.get(
  "/auto-group-rules",
  requireAnyPermission(["canGroupAlarms", "canManageAutoGroupRules"]),
  async (req, res) => {
    try {
      const db = getDB();
      const rules = await db.models.AutoGroupRules.findAll({
        order: [["id", "ASC"]],
      });
      res.json(rules);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.post(
  "/auto-group-rules/test-regex",
  requirePermission("canManageAutoGroupRules"),
  async (req, res) => {
    try {
      const db = getDB();
      const { alarmCodePattern, keyword, dataSourceFilter } = req.body;

      if (!alarmCodePattern && !keyword && !dataSourceFilter) {
        return res.status(400).json({ error: "Au moins un critère est requis" });
      }

      const normalizeRegex = (pattern) => pattern.replace(/\\d/g, "[0-9]");

      if (alarmCodePattern) {
        try { new RegExp(normalizeRegex(alarmCodePattern)); } catch {
          return res.status(400).json({ error: "Regex invalide" });
        }
      }

      const where = {};
      if (keyword) where.alarmText = { [Op.like]: `%${keyword}%` };
      if (dataSourceFilter) where.dataSource = dataSourceFilter;
      if (alarmCodePattern) where.alarmArea = { [Op.regexp]: normalizeRegex(alarmCodePattern) };

      const matches = await db.models.Alarms.findAll({
        where,
        order: [["alarmCode", "ASC"]],
      });

      res.json(matches);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.post(
  "/auto-group-rules",
  requirePermission("canManageAutoGroupRules"),
  async (req, res) => {
    try {
      const db = getDB();
      const { name, keyword, comment, action, groupBy, zone, alarmCodePattern, dataSourceFilter } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Le nom est requis" });
      }
      if (!keyword && !alarmCodePattern && !dataSourceFilter) {
        return res.status(400).json({ error: "Au moins un critère de filtre est requis (keyword, alarmCodePattern ou dataSourceFilter)" });
      }
      const resolvedAction = action || "group";
      const rule = await db.models.AutoGroupRules.create({
        name,
        keyword,
        alarmCodePattern: alarmCodePattern ? alarmCodePattern.replace(/\\d/g, "[0-9]") : null,
        dataSourceFilter: dataSourceFilter || null,
        action: resolvedAction,
        comment: comment || null,
        groupBy: resolvedAction === "group" ? (groupBy || "location") : null,
        zone: resolvedAction === "group" && groupBy === "zone" ? (zone || null) : null,
        updatedBy: req.userId,
      });
      res.status(201).json(rule);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.put(
  "/auto-group-rules/:id",
  requirePermission("canManageAutoGroupRules"),
  async (req, res) => {
    try {
      const db = getDB();
      const rule = await db.models.AutoGroupRules.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: "Règle introuvable" });
      const { name, keyword, comment, action, groupBy, zone, alarmCodePattern, dataSourceFilter, enabled } = req.body;
      const resolvedAction = action || rule.action || "group";
      await rule.update({
        name,
        keyword,
        alarmCodePattern: alarmCodePattern ? alarmCodePattern.replace(/\\d/g, "[0-9]") : null,
        dataSourceFilter: dataSourceFilter || null,
        action: resolvedAction,
        comment: comment || null,
        groupBy: resolvedAction === "group" ? (groupBy || "location") : null,
        zone: resolvedAction === "group" && groupBy === "zone" ? (zone || null) : null,
        enabled,
        updatedBy: req.userId,
      });
      res.json(rule);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.delete(
  "/auto-group-rules/:id",
  requirePermission("canManageAutoGroupRules"),
  async (req, res) => {
    try {
      const db = getDB();
      const rule = await db.models.AutoGroupRules.findByPk(req.params.id);
      if (!rule) return res.status(404).json({ error: "Règle introuvable" });
      await rule.destroy();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Marquer la journée J-1 comme traitée manuellement (empêche le cron autoGroupAlarms de s'exécuter)
router.patch(
  "/mark-daily-done",
  requirePermission("canMarkAsTreated"),
  async (req, res) => {
    try {
      const db = getDB();
      const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      await db.models.Settings.upsert({
        key: "dailyAnalysisDoneDate",
        value: yesterday,
        description: "Date de la dernière analyse quotidienne traitée manuellement",
        updatedAt: new Date(),
      });
      res.json({ success: true, date: yesterday });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Récupérer si la journée J-1 a déjà été traitée manuellement
router.get("/daily-done-status", async (req, res) => {
  try {
    const db = getDB();
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    const setting = await db.models.Settings.findByPk("dailyAnalysisDoneDate");
    res.json({
      done: setting?.value === yesterday,
      date: setting?.value || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
