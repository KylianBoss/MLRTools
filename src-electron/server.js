import { initDB } from "./database";
import { QueryTypes, Op } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import PDFdocument from "pdfkit-table";
import fs from "fs/promises";
import path from "path";

dayjs.extend(duration);
const __dirname = path.resolve();
let db = null;

export function setupServer(app) {
  // CONFIG
  app.get("/config", async (req, res) => {
    // Try to find the config file in the user's home directory
    const configPath = path.join(__dirname, "/storage/mlrtools-config.json");
    try {
      const config = await fs.readFile(configPath, "utf-8");
      db = await initDB(JSON.parse(config));
      const user = await db.models.Users.findOne({
        where: {
          username: process.env.username,
        },
        include: {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
      });
      res.json({
        config: true,
        user: user.toJSON(),
      });
    } catch (error) {
      console.log(error);
      res.status(404).json(false);
    }
  });
  app.post("/config", async (req, res) => {
    // You'll recieve a file in json format
    const configPath = path.join(__dirname, "/storage/mlrtools-config.json");
    try {
      await fs.mkdir(path.join(__dirname, "/storage"), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(req.body));
      db = await initDB(req.body);
      let user = await db.models.Users.findOne({
        where: {
          username: process.env.username,
        },
        include: {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
      });
      if (!user) {
        await db.models.Users.create({
          username: process.env.username,
        });
        await db.models.UserAccess.create({
          userId: user.id,
          menuId: "kpi",
        });
        user = await db.models.Users.findOne({
          where: {
            username: process.env.username,
          },
          include: {
            model: db.models.UserAccess,
            attributes: ["menuId"],
          },
        });
      }
      res.status(201).json({ config: true, user: user.toJSON() });
    } catch (error) {
      console.error("Error writing config file:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DATABASE
  app.post("/db/sync-models", async (req, res) => {
    const { user } = req.body;
    if (!user) {
      res.status(400).json({ error: "No user provided" });
      return;
    }
    try {
      // Get the user
      const user_ = await db.models.Users.findOne({
        where: {
          username: user,
        },
        include: {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
      });
      if (!user_) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Control if the user has access to the admin menu
      const hasAccess = user_.UserAccesses.find((a) => a.menuId === "admin");
      if (!hasAccess) {
        res.status(403).json({ error: "User not authorized" });
        return;
      }

      await db.sync({ alter: true });
      res.sendStatus(201);
    } catch (error) {
      console.error("Error syncing models:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/alarms", async (req, res) => {
    try {
      const alarm = await db.models.Datalog.upsert(req.body);
      await db.models.Alarms.upsert({
        alarmId: req.body.alarmId,
        dataSource: req.body.dataSource,
        alarmArea: req.body.alarmArea,
        alarmCode: req.body.alarmCode,
        alarmText: req.body.alarmText,
      });
      res.status(201).json(alarm);
    } catch (error) {
      console.error("Error creating alarm:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms", async (req, res) => {
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
            Datalogs
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
            const translation = translations.find(
              (t) => t.alarmId === r.alarmId
            );
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

      const alarms = await Datalog.findAll({
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

  app.get("/alarms/count", async (req, res) => {
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

  app.get("/alarms/day", async (req, res) => {
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

  app.get("/alarms/day/:date", async (req, res) => {
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

  app.post("/alarms/exclude", async (req, res) => {
    try {
      const excludedAlarm = await db.models.ExcludedAlarms.upsert({
        alarmId: req.body,
      });
      res.sendStatus(201);
    } catch (error) {
      console.error("Error excluding alarm:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/exclude", async (req, res) => {
    try {
      const excludedAlarms = await db.models.ExcludedAlarms.findAll();
      res.json(excludedAlarms.map((a) => a.alarmId));
    } catch (error) {
      console.error("Error fetching excluded alarms:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/alarms/include", async (req, res) => {
    try {
      const excludedAlarm = await db.models.ExcludedAlarms.destroy({
        where: {
          alarmId: req.body,
        },
      });
      res.sendStatus(201);
    } catch (error) {
      console.error("Error including alarm:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/unique", async (req, res) => {
    const { exclude = true } = req.query;
    try {
      const where = {};
      if (exclude) {
        where.alarmId = {
          [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
        };
      }
      const alarms = await db.models.Alarms.findAll({
        attributes: [
          "alarmId",
          "dataSource",
          "alarmArea",
          "alarmCode",
          "alarmText",
        ],
        group: ["alarmId", "dataSource", "alarmArea", "alarmCode", "alarmText"],
        where,
      });
      const translations = await db.models.AlarmTranslations.findAll();
      res.json(
        alarms.map((a) => {
          const translation = translations.find((t) => t.alarmId === a.alarmId);
          return {
            ...a.toJSON(),
            alarmText: translation ? translation.translation : a.alarmText,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching unique alarms:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/messages", async (req, res) => {
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

  app.post("/alarms/translate", async (req, res) => {
    const { alarmId, translation } = req.body;

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

  app.get("/alarms/kpi/count", async (req, res) => {
    const { from, to, includesExcluded = false } = req.body;

    try {
      let query;
      if (!!!includesExcluded) {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(alarmArea) as alarmArea,
            MAX(alarmCode) as alarmCode,
            MAX(dataSource) as "dataSource",
            COUNT(*) as count
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
            AND alarmId NOT IN (SELECT alarmId FROM ExcludedAlarms)
          GROUP BY
            alarmId
          ORDER BY
            count DESC
          LIMIT 3
        `;
      } else {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(dataSource) as dataSource,
            COUNT(*) as count
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
          GROUP BY
            alarmId
          ORDER BY
            count DESC
          LIMIT 3
        `;
      }
      const result = await db.query(query, {
        replacements: { from, to },
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
    } catch (error) {
      console.error("Error fetching KPI count:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/kpi/count/:dataSource", async (req, res) => {
    const { from, to, includesExcluded = false } = req.body;
    const { dataSource } = req.params;

    try {
      let query;
      if (!!!includesExcluded) {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(alarmArea) as alarmArea,
            MAX(alarmCode) as alarmCode,
            MAX(dataSource) as dataSource,
            COUNT(*) as count
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
            AND alarmId NOT IN (SELECT alarmId FROM ExcludedAlarms)
            AND dataSource = :dataSource
          GROUP BY
            alarmId
          ORDER BY
            count DESC
          LIMIT 3
        `;
      } else {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(dataSource) as dataSource,
            COUNT(*) as count
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
            AND dataSource = :dataSource
          GROUP BY
            alarmId
          ORDER BY
            count DESC
          LIMIT 3
        `;
      }
      const result = await db.query(query, {
        replacements: { from, to, dataSource },
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
    } catch (error) {
      console.error("Error fetching KPI count:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/kpi/duration", async (req, res) => {
    const { from, to, includesExcluded = false } = req.body;

    try {
      let query;
      if (!!!includesExcluded) {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(alarmArea) as alarmArea,
            MAX(alarmCode) as alarmCode,
            MAX(dataSource) as dataSource,
            SUM(duration) as duration
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
            AND alarmId NOT IN (SELECT alarmId FROM ExcludedAlarms)
          GROUP BY
            alarmId
          ORDER BY
            duration DESC
          LIMIT 3
        `;
      } else {
        query = `
          SELECT
            alarmId,
            MAX(alarmText) as alarmText,
            MAX(dataSource) as dataSource,
            SUM(duration) as duration
          FROM
            Datalogs
          WHERE
            timeOfOccurence BETWEEN :from AND :to
          GROUP BY
            alarmId
          ORDER BY
            duration DESC
          LIMIT 3
        `;
      }
      const result = await db.query(query, {
        replacements: { from, to },
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
    } catch (error) {
      console.error("Error fetching KPI duration:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/kpi/resume/:dataSource", async (req, res) => {
    const { from, to, includesExcluded = false } = req.body;
    const { dataSource } = req.params;

    try {
      const where = {
        timeOfOccurence: {
          [Op.between]: [from, to],
        },
        dataSource,
      };
      if (!!!includesExcluded) {
        where.alarmId = {
          [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
        };
      }

      const rawData = await db.models.Datalog.findAll({
        where,
        order: [["timeOfOccurence", "ASC"]],
        attributes: [
          "dbId",
          "timeOfOccurence",
          "timeOfAcknowledge",
          "duration",
          "dataSource",
          "alarmArea",
          "alarmText",
        ],
      });

      const result = [];
      const totalMinutes = 1440;
      let lastEndTime = dayjs(rawData[0].timeOfAcknowledge);
      const endOfDay = dayjs(rawData[0].lastEndTime).add(1, "day");

      rawData.forEach((event) => {
        const startTime = dayjs(event.timeOfOccurence);
        const endTime = dayjs(event.timeOfAcknowledge);

        if (startTime.isAfter(lastEndTime)) {
          const runningDuration = dayjs
            .duration(startTime.diff(lastEndTime))
            .asMinutes();
          result.push({
            time: (runningDuration / totalMinutes).toFixed(8),
            state: "running",
            message: null,
          });
        }

        const errorDuration = dayjs
          .duration(endTime.diff(startTime))
          .asMinutes();
        result.push({
          time: (errorDuration / totalMinutes).toFixed(8),
          state: "error",
          message: event.alarmText,
        });

        lastEndTime = endTime;
      });

      if (lastEndTime.isBefore(endOfDay)) {
        const runningDuration = dayjs
          .duration(endOfDay.diff(lastEndTime))
          .asMinutes();
        result.push({
          time: (runningDuration / totalMinutes).toFixed(8),
          state: "running",
          message: null,
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching KPI resume:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/alarms/:alarmId", async (req, res) => {
    try {
      const alarm = await db.models.Alarms.findOne({
        where: {
          alarmId: req.params.alarmId,
        },
      });
      res.json(alarm.toJSON());
    } catch (error) {
      console.error("Error fetching alarm:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/print/suspicious-places", async (req, res) => {
    const { places } = req.body;
    const doc = new PDFdocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      // Send base64 encoded PDF to the renderer
      const pdfBuffer = Buffer.concat(chunks).toString("base64");
      res.json(pdfBuffer);
    });
    doc
      .fontSize(20)
      .text("Emplacements suspects dans le Shuttle", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text("Liste des emplacements suspects");
    doc.moveDown();
    doc.fontSize(12);
    // Make a table with the place data
    // {
    //  aisle: 1,
    //  side: Gauche,
    //  level: 10,
    //  maintenanceLevel: 5,
    //  rack: 10,
    //  x: 3,
    //  z: 2,
    //  trayNumber: 0000023564,
    // }
    const table = {
      headers: [
        "Allée",
        "Côté",
        "Maintenance Level",
        "Étagère",
        "Compartiment",
        "Place",
        "Profondeur",
        "Numéro du tray",
        "Actuel",
      ],
      rows: places.map((p) => [
        p.aisle,
        p.side,
        p.maintenanceLevel,
        p.level,
        p.rack,
        p.x,
        p.z,
        p.trayNumber,
        "",
      ]),
    };
    doc
      .table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold"),
        prepareRow: (row, i) => doc.font("Helvetica").fontSize(12),
      })
      .then(() => doc.end());
  });

  app.get("/charts/messages-count/:startDate/:endDate", async (req, res) => {
    const { startDate, endDate } = req.params;
    try {
      // Get the number of messages per day between the start and end dates (inclusive) and separate WARNING and ERROR messages
      const result = await db.query(
        `
        SELECT
          DATE(timeOfOccurence) as date,
          SUM(CASE WHEN severity = 'Warning' THEN 1 ELSE 0 END) as warning,
          SUM(CASE WHEN severity = 'Error' THEN 1 ELSE 0 END) as error,
          COUNT(*) as total
        FROM
          Datalogs
        WHERE
          timeOfOccurence BETWEEN :startDate AND :endDate
        GROUP BY
          date
        ORDER BY
          date
      `,
        {
          replacements: { startDate, endDate },
          type: QueryTypes.SELECT,
        }
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching message count:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/charts/messages-per-zone/:startDate/:endDate", async (req, res) => {
    const { startDate, endDate } = req.params;
    try {
      // Get the number of messages per zone between the start and end dates (inclusive)
      const result = await db.query(
        `
        SELECT
          dataSource,
          SUM(CASE WHEN severity = 'Error' THEN 1 ELSE 0 END) as count
        FROM
          Datalogs
        WHERE
          timeOfOccurence BETWEEN :startDate AND :endDate
        GROUP BY
          dataSource
        ORDER BY
          count DESC
      `,
        {
          replacements: { startDate, endDate },
          type: QueryTypes.SELECT,
        }
      );
      res.json(result);
    } catch (error) {
      console.error("Error fetching message count:", error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log("Server setup complete");
}
