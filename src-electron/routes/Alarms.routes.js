import { Router } from "express";
import { db } from "../database.js";
import { Op, QueryTypes } from "sequelize";

const router = Router();

router.post("/", async (req, res) => {
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
router.get("/", async (req, res) => {
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
    res.json(alarm);
  } catch (error) {
    console.error("Error updating primary status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/secondary", async (req, res) => {
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
    res.json(alarm);
  } catch (error) {
    console.error("Error updating secondary status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/human", async (req, res) => {
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
    res.json(alarm);
  } catch (error) {
    console.error("Error updating human status:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/other", async (req, res) => {
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
    res.json(alarm);
  } catch (error) {
    console.error("Error updating other status:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
