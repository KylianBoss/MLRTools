import { Router } from "express";
import { getDB } from "../database.js";
import { Op, QueryTypes, Sequelize } from "sequelize";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import "dayjs/locale/fr.js";

dayjs.extend(customParseFormat);
dayjs.locale("fr");

const router = Router();

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
  const { data } = req.body;
  if (!data) {
    res.status(400).json({ error: "No data provided" });
    return;
  }

  const response = {
    recieved: 0,
    parsed: 0,
    inserted: 0,
  };

  try {
    // data is a long CSV string and i want to have it as an array of objects
    const lines = data.split("\n");
    const headers = lines[0]
      .split(";")
      .map((h) => h.replaceAll('"', "").trim())
      .filter((h) => h.length > 0);
    const alarms = lines.slice(1).map((line) => {
      const values = line.split(";").map((v) => v.replaceAll('"', "").trim());
      const alarm = {};
      headers.forEach((header, index) => {
        alarm[header] = values[index];
      });
      return alarm;
    });
    console.log(`Importing ${alarms.length} alarms`);
    response.recieved = alarms.length;

    const formattedAlarms = alarms.map((alarm) => ({
      dbId: alarm["Database ID"] ? parseInt(alarm["Database ID"], 10) : null,
      timeOfOccurence: alarm["Time of occurrence"]
        ? dayjs(
            alarm["Time of occurrence"],
            "D MMM YYYY à HH:mm:ss",
            "fr"
          ).toDate()
        : null,
      timeOfAcknowledge: alarm["Acknowledge instant"]
        ? dayjs(
            alarm["Acknowledge instant"],
            "D MMM YYYY à HH:mm:ss",
            "fr"
          ).toDate()
        : null,
      duration: Math.abs(
        dayjs(alarm["Time of occurrence"], "D MMM YYYY à HH:mm:ss", "fr").diff(
          dayjs(alarm["Acknowledge instant"], "D MMM YYYY à HH:mm:ss", "fr"),
          "second"
        )
      ),
      dataSource: alarm["Data source"] || null,
      alarmArea: alarm["Alarm area"] || null,
      alarmCode: alarm["Alarm code"] || null,
      alarmText: alarm["Alarm text"] || null,
      severity: alarm["Severity"] || null,
      classification: alarm["Classification"] || null,
      assignedUser: alarm["Assigned user"] || null,
      alarmId: `${alarm["Data source"]}.${alarm["Alarm area"]}.${alarm["Alarm code"]}`,
    }));

    const parsedAlarms = formattedAlarms.filter((fa) => {
      if (typeof fa.dbId !== typeof 1) return false; // Don't put in DB the alarms without DBID
      if (fa.alarmCode === "M6009.0306") return false; // Don't put in DB the warning from the shuttle
      if (fa.alarmCode === "M6130.0201") return false; // Don't put in DB the warning from the shuttle
      if (fa.alarmCode === "M6130.0203") return false; // Don't put in DB the warning from the shuttle
      if (fa.alarmCode === "M6130.0202") return false; // Don't put in DB the warning from the shuttle
      if (!fa.timeOfAcknowledge) return false; // Don't put in DB the alarms without acknowledge time
      if (JSON.stringify(fa).includes("undefined")) return false; // Don't put in DB the alarms with undefined values
      if (JSON.stringify(fa).includes("NaN")) return false; // Don't put in DB the alarms with NaN values
      return true;
    });
    console.log(`Parsed ${parsedAlarms.length} alarms (after filtering)`);
    response.parsed = parsedAlarms.length;

    const bulk = await db.models.Datalog.bulkCreate(parsedAlarms, {
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
      validate: true,
    });
    // const bulk = [];
    // const createdAlarms = [];
    // let progress = 0;
    // let lastProgress = 0;
    // for (const alarm of parsedAlarms) {
    //   try {
    //     const [record, created] = await db.models.Datalog.upsert(alarm);
    //     bulk.push(record);
    //     if (created) createdAlarms.push(record);
    //   } catch (error) {
    //     console.error("Error inserting alarm:", error, alarm);
    //   }
    //   progress = Math.round((bulk.length / parsedAlarms.length) * 100);
    //   if (progress != lastProgress) {
    //     lastProgress = progress;
    //     console.log(`${progress}% done`);
    //   }
    // }
    console.log(`Inserted/Updated ${bulk.length} alarms`);
    response.inserted = bulk.length;

    // Keep only unique alarms from the parsed alarms
    const uniqueAlarms = parsedAlarms.filter(
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

    console.log(`Alarm import completed`);
    res.status(201).json(response);
  } catch (error) {
    console.error("Error importing alarms:", error);
    res.status(500).json({ error: error.message });
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
            dayjs().subtract(1, "day").startOf("day").toDate(),
            dayjs().subtract(1, "day").endOf("day").toDate(),
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
router.patch("/update-state", async (req, res) => {
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
});

// Mark alarm as treated
router.patch("/mark-treated", async (req, res) => {
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
});

// Update alarm comment
router.patch("/update-comment", async (req, res) => {
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
});

// Group alarms together
router.post("/group-alarms", async (req, res) => {
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
});

// Ungroup alarm
router.patch("/ungroup-alarm", async (req, res) => {
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
});

export default router;
