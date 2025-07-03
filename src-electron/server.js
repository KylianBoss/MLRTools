import { db } from "./database";
import { QueryTypes, Op } from "sequelize";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import PDFdocument from "pdfkit-table";
import fs from "fs/promises";
import path from "path";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";

dayjs.extend(duration);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// === ROUTES === //
app.use(routes);
// CONFIG
// app.get("/config", async (req, res) => {
//   // Try to find the config file in the user's home directory
//   const configPath = path.join(
//     process.cwd(),
//     "storage",
//     "mlrtools-config.json"
//   );
//   try {
//     const config = await fs.readFile(configPath, "utf-8");
//     db = await initDB(JSON.parse(config));
//     const user = await db.models.Users.findOne({
//       where: {
//         username: process.env.username,
//       },
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     res.json({
//       config: true,
//       user: user.toJSON(),
//     });
//   } catch (error) {
//     res.status(404).json({ error: "Config file not found" });
//   }
// });
// app.post("/config", async (req, res) => {
//   // You'll recieve a file in json format
//   const configPath = path.join(__dirname, "/storage/mlrtools-config.json");
//   try {
//     await fs.mkdir(path.join(__dirname, "/storage"), { recursive: true });
//     await fs.writeFile(configPath, JSON.stringify(req.body));
//     db = await initDB(req.body);
//     let user = await db.models.Users.findOne({
//       where: {
//         username: process.env.username,
//       },
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     if (!user) {
//       await db.models.Users.create({
//         username: process.env.username,
//       });
//       await db.models.UserAccess.create({
//         userId: user.id,
//         menuId: "kpi",
//       });
//       user = await db.models.Users.findOne({
//         where: {
//           username: process.env.username,
//         },
//         include: {
//           model: db.models.UserAccess,
//           attributes: ["menuId"],
//         },
//       });
//     }
//     res.status(201).json({ config: true, user: user.toJSON() });
//   } catch (error) {
//     console.error("Error writing config file:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// DATABASE
// app.post("/db/sync-models", async (req, res) => {
//   const { user } = req.body;
//   if (!user) {
//     res.status(400).json({ error: "No user provided" });
//     return;
//   }
//   try {
//     // Get the user
//     const user_ = await db.models.Users.findOne({
//       where: {
//         username: user,
//       },
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     if (!user_) {
//       res.status(404).json({ error: "User not found" });
//       return;
//     }

//     // Control if the user has access to the admin menu
//     const hasAccess = user_.UserAccesses.find((a) => a.menuId === "admin");
//     if (!hasAccess) {
//       res.status(403).json({ error: "User not authorized" });
//       return;
//     }
//     console.log("Syncing models");
//     await db.sync({ alter: true });
//     console.log("Models synced");
//     res.sendStatus(201);
//   } catch (error) {
//     console.error("Error syncing models:", JSON.stringify(error));
//     res.status(500).json({ error: error.message });
//   }
// });
// app.post("/db/empty-day-resume", async (req, res) => {
//   const { user } = req.body;
//   if (!user) {
//     res.status(400).json({ error: "No user provided" });
//     return;
//   }
//   try {
//     // Get the user
//     const user_ = await db.models.Users.findOne({
//       where: {
//         username: user,
//       },
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     if (!user_) {
//       res.status(404).json({ error: "User not found" });
//       return;
//     }

//     // Control if the user has access to the admin menu
//     const hasAccess = user_.UserAccesses.find((a) => a.menuId === "admin");
//     if (!hasAccess) {
//       res.status(403).json({ error: "User not authorized" });
//       return;
//     }
//     console.log("Emptying day resume");
//     await db.models.DayResume.destroy({
//       where: {},
//     });
//     console.log("Day resume emptied");
//     res.sendStatus(201);
//   } catch (error) {
//     console.error("Error emptying day resume:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.post("/db/empty-day-resume-at-date", async (req, res) => {
//   const { user, date } = req.body;
//   if (!user) {
//     res.status(400).json({ error: "No user provided" });
//     return;
//   }
//   try {
//     // Get the user
//     const user_ = await db.models.Users.findOne({
//       where: {
//         username: user,
//       },
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     if (!user_) {
//       res.status(404).json({ error: "User not found" });
//       return;
//     }

//     // Control if the user has access to the admin menu
//     const hasAccess = user_.UserAccesses.find((a) => a.menuId === "admin");
//     if (!hasAccess) {
//       res.status(403).json({ error: "User not authorized" });
//       return;
//     }
//     console.log("Emptying day resume at date", date);
//     await db.models.DayResume.destroy({
//       where: {
//         from: {
//           [Op.between]: [
//             dayjs(date).startOf("day").format("YYYY-MM-DD HH:mm:ss"),
//             dayjs(date).endOf("day").format("YYYY-MM-DD HH:mm:ss"),
//           ],
//         },
//       },
//     });
//     console.log("Day resume emptied");
//     res.sendStatus(201);
//   } catch (error) {
//     console.error("Error emptying day resume at date:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// USERS
// app.get("/users", async (req, res) => {
//   try {
//     const users = await db.models.Users.findAll({
//       include: {
//         model: db.models.UserAccess,
//         attributes: ["menuId"],
//       },
//     });
//     res.json(
//       users.map((u) => {
//         return {
//           ...u.toJSON(),
//           UserAccesses: u.UserAccesses.map((a) => a.menuId),
//         };
//       })
//     );
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.put("/users", async (req, res) => {
//   const { id, username, fullname, autorised, UserAccesses } = req.body;
//   try {
//     const user = await db.models.Users.update(
//       {
//         username,
//         fullname,
//         autorised,
//       },
//       {
//         where: {
//           id,
//         },
//       }
//     );

//     await db.models.UserAccess.destroy({
//       where: {
//         userId: id,
//       },
//     });

//     await db.models.UserAccess.bulkCreate(
//       UserAccesses.map((a) => ({
//         userId: id,
//         menuId: a,
//       }))
//     );

//     res.json(
//       user.map((u) => {
//         return {
//           ...u,
//           UserAccesses: UserAccesses,
//         };
//       })
//     );
//   } catch (error) {
//     console.error("Error updating user:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// INSERT ALARM MESSAGES
// app.post("/alarms", async (req, res) => {
//   try {
//     const alarms = await db.models.Datalog.bulkCreate(req.body, {
//       updateOnDuplicate: [
//         "timeOfOccurence",
//         "timeOfAcknowledge",
//         "duration",
//         "dataSource",
//         "alarmArea",
//         "alarmCode",
//         "alarmText",
//         "severity",
//         "classification",
//         "assignedUser",
//         "alarmId",
//       ],
//     });

//     // Keep only unique alarms from the inserted alarms
//     const uniqueAlarms = alarms.filter(
//       (alarm, index, self) =>
//         index === self.findIndex((a) => a.alarmId === alarm.alarmId)
//     );
//     console.log("unique alarms:", uniqueAlarms.length);

//     for (const alarm of uniqueAlarms) {
//       await db.models.Alarms.upsert({
//         alarmId: alarm.alarmId,
//         dataSource: alarm.dataSource,
//         alarmArea: alarm.alarmArea,
//         alarmCode: alarm.alarmCode,
//         alarmText: alarm.alarmText,
//       });
//     }
//     res.sendStatus(201);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// ALARMS
// app.get("/alarms", async (req, res) => {
//   const { startRow, count, filter, sortBy, descending, sum } = req.body;
//   try {
//     if (sum) {
//       let query = `
//           SELECT
//             alarmId,
//             MAX(dataSource) as dataSource",
//             MAX(alarmArea) as alarmArea",
//             MAX(alarmCode) as alarmCode",
//             MAX(alarmText) as alarmText",
//             MAX(severity) as severity",
//             MAX(classification) as classification,
//             COUNT(*) as count
//           FROM
//             datalogs
//           WHERE
//             timeOfOccurence BETWEEN :from AND :to
//         `;
//       if (!!!filter.excluded) {
//         query += `
//             AND alarmId NOT IN (SELECT alarmId FROM ExcludedAlarms)
//           `;
//       }
//       query += `
//           GROUP BY
//             alarmId
//           ORDER BY
//             :order
//           LIMIT :count
//           OFFSET :startRow
//         `;

//       const result = await db.query(query, {
//         replacements: {
//           from: filter.date.from,
//           to: filter.date.to,
//           order: `${sortBy} ${descending ? "DESC" : "ASC"}`,
//           count,
//           startRow,
//         },
//         type: QueryTypes.SELECT,
//       });

//       const translations = await db.models.AlarmTranslations.findAll();
//       res.json(
//         result.map((r) => {
//           const translation = translations.find((t) => t.alarmId === r.alarmId);
//           return {
//             ...r,
//             alarmText: translation ? translation.translation : r.alarmText,
//           };
//         })
//       );
//       return;
//     }

//     let where = {
//       timeOfOccurence: {
//         [Op.between]: [filter.date.from, filter.date.to],
//       },
//     };
//     if (!!!filter.excluded) {
//       where.alarmId = {
//         [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
//       };
//     }
//     if (!!!filter.excludedCode) {
//       where.alarmCode = {
//         [Op.notIn]: db.literal(`(SELECT alarmCode FROM ExcludedAlarmCodes)`),
//       };
//     }
//     if (filter.like) {
//       const terms = filter.like.split(" ");
//       where = {
//         ...where,
//         [Op.or]: [
//           {
//             alarmText: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             alarmArea: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             alarmCode: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             dataSource: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//         ],
//       };
//     }

//     const alarms = await db.models.Datalog.findAll({
//       limit: count,
//       offset: startRow,
//       order: [[sortBy, descending ? "DESC" : "ASC"]],
//       where,
//     });
//     const translations = await db.models.AlarmTranslations.findAll();
//     const translatedMessages = alarms.map((m) => {
//       const translation = translations.find((t) => t.alarmId === m.alarmId);
//       return {
//         ...m.toJSON(),
//         alarmText: translation ? translation.translation : m.alarmText,
//       };
//     });

//     res.json(translatedMessages);
//   } catch (error) {
//     console.error("Error fetching alarms:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/count", async (req, res) => {
//   const { date, excluded, like = null, sum = false } = req.body;
//   try {
//     let where = {
//       timeOfOccurence: {
//         [Op.between]: [date.from, date.to],
//       },
//     };
//     if (!!!excluded) {
//       where.alarmId = {
//         [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
//       };
//     }
//     if (!!!filter.excludedCode) {
//       where.alarmCode = {
//         [Op.notIn]: db.literal(`(SELECT alarmCode FROM ExcludedAlarmCodes)`),
//       };
//     }
//     if (like) {
//       const terms = like.split(" ");
//       where = {
//         ...where,
//         [Op.or]: [
//           {
//             alarmText: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             alarmArea: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             alarmCode: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//           {
//             dataSource: {
//               [Op.like]: `%${terms.join("%")}%`,
//             },
//           },
//         ],
//       };
//     }

//     const count = await db.models.Datalog.count({
//       where,
//     });

//     res.json(count);
//   } catch (error) {
//     console.error("Error fetching alarm count:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/day", async (req, res) => {
//   try {
//     const dates = await db.query(
//       "SELECT DISTINCT DATE(timeOfOccurence) as date FROM Datalogs ORDER BY date",
//       {
//         type: QueryTypes.SELECT,
//       }
//     );
//     res.status(200).json(dates.map((d) => d.date));
//   } catch (error) {
//     console.error("Error fetching dates:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/day/:date", async (req, res) => {
//   try {
//     const alarms = await db.models.Datalog.findAll({
//       where: {
//         timeOfOccurence: {
//           [Op.between]: [
//             `${req.params.date} 00:00:00`,
//             `${req.params.date} 23:59:59`,
//           ],
//         },
//       },
//     });
//     res.json(alarms);
//   } catch (error) {
//     console.error("Error fetching alarms:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/by-users/:from/:to", async (req, res) => {
//   const { from, to } = req.params;

//   if (!from || !to) {
//     res.status(400).json({ error: "No dates provided" });
//     return;
//   }

//   try {
//     db.query("CALL getAlarmsByUser(:from, :to)", {
//       replacements: {
//         from,
//         to,
//       },
//     }).then((result) => {
//       res.json(result);
//     });
//   } catch (error) {
//     console.error("Error fetching alarms by users:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// INCLUDE ALARM
// app.get("/alarms/unique", async (req, res) => {
//   const { exclude = true } = req.query;
//   try {
//     const where = {};
//     if (exclude) {
//       where.alarmId = {
//         [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
//       };
//       where.alarmCode = {
//         [Op.notIn]: db.literal(`(SELECT alarmCode FROM ExcludedAlarmCodes)`),
//       };
//     }
//     const alarms = await db.models.Alarms.findAll({
//       attributes: [
//         "alarmId",
//         "dataSource",
//         "alarmArea",
//         "alarmCode",
//         "alarmText",
//       ],
//       // include: {
//       //   model: db.models.alarmZoneTGWReport,
//       //   as: "TGWzone",
//       // },
//       group: ["alarmId", "dataSource", "alarmArea", "alarmCode", "alarmText"],
//       where,
//     });
//     const translations = await db.models.AlarmTranslations.findAll();
//     res.json(
//       alarms.map((a) => {
//         const translation = translations.find((t) => t.alarmId === a.alarmId);
//         // const lastOccurence = db.models.Datalog.findOne({
//         //   where: {
//         //     alarmId: a.alarmId,
//         //   },
//         //   order: [["timeOfOccurence", "DESC"]],
//         //   limit: 1,
//         // });
//         return {
//           ...a.toJSON(),
//           alarmText: translation ? translation.translation : a.alarmText,
//           // lastOccurence: lastOccurence.timeOfOccurence,
//         };
//       })
//     );
//   } catch (error) {
//     console.error("Error fetching unique alarms:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/messages", async (req, res) => {
//   const { from, to, includesExcluded = false } = req.body;
//   try {
//     const where = {
//       timeOfOccurence: {
//         [Op.between]: [from, to],
//       },
//     };
//     if (!!!includesExcluded) {
//       where.alarmId = {
//         [Op.notIn]: db.literal(`(SELECT alarmId FROM ExcludedAlarms)`),
//       };
//     }
//     const messages = await Datalog.findAll({
//       where,
//     });

//     const translations = await db.models.AlarmTranslations.findAll();
//     const translatedMessages = messages.map((m) => {
//       const translation = translations.find((t) => t.alarmId === m.alarmId);
//       return {
//         ...m.toJSON(),
//         alarmText: translation ? translation.translation : m.alarmText,
//       };
//     });

//     res.json(translatedMessages);
//   } catch (error) {
//     console.error("Error fetching messages:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.post("/alarms/translate", async (req, res) => {
//   const { alarmId, translation } = req.body;

//   try {
//     const alarm = await db.models.AlarmTranslations.upsert({
//       alarmId,
//       translation,
//     });
//     res.json(alarm);
//   } catch (error) {
//     console.error("Error translating alarm:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// KPI
// app.get("/alarms/kpi/count", async (req, res) => {
//   const { from, to, includesExcluded = false } = req.query;

//   if (!from || !to) {
//     res.status(400).json({ error: "No dates provided" });
//     return;
//   }

//   try {
//     db.query(
//       "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
//       {
//         replacements: {
//           from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
//           to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
//           dataSource: "*", // All zones
//           includesExcluded,
//           limit: 10,
//         },
//       }
//     ).then((result) => {
//       res.json(result);
//     });
//   } catch (error) {
//     console.error("Error fetching KPI count:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/kpi/count/zone", async (req, res) => {
//   const { from, to, includesExcluded = false, dataSource } = req.query;

//   if (!from || !to) {
//     res.status(400).json({ error: "No dates provided" });
//     return;
//   }

//   try {
//     db.query(
//       "CALL getKPICount(:from, :to, :dataSource, :includesExcluded, :limit)",
//       {
//         replacements: {
//           from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
//           to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
//           dataSource,
//           includesExcluded,
//           limit: 5,
//         },
//       }
//     ).then((result) => {
//       res.json(result);
//     });
//   } catch (error) {
//     console.error("Error fetching KPI count:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/kpi/duration", async (req, res) => {
//   const { from, to, includesExcluded = false } = req.query;

//   if (!from || !to) {
//     res.status(400).json({ error: "No dates provided" });
//     return;
//   }

//   try {
//     db.query(
//       "CALL getKPIDuration(:from, :to, :dataSource, :includesExcluded, :limit)",
//       {
//         replacements: {
//           from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
//           to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
//           dataSource: "*", // All zones
//           includesExcluded,
//           limit: 10,
//         },
//       }
//     ).then((result) => {
//       res.json(result);
//     });
//   } catch (error) {
//     console.error("Error fetching KPI duration:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/alarms/kpi/resume", async (req, res) => {
//   const { from, to, includesExcluded = false, dataSource } = req.query;

//   if (!from || !to) {
//     res.status(400).json({ error: "No dates provided" });
//     return;
//   }

//   try {
//     db.query("CALL getGroupedAlarms(:from, :to, :dataSource)", {
//       replacements: {
//         from: dayjs(from + "00:00:00").format("YYYY-MM-DD HH:mm:ss"),
//         to: dayjs(to + "23:59:59").format("YYYY-MM-DD HH:mm:ss"),
//         dataSource,
//       },
//     })
//       .then((result) => {
//         res.json(result);
//       })
//       .catch((error) => {
//         console.error("Error fetching KPI resume:", error);
//         res.status(500).json({ error: error.message });
//       });
//   } catch (error) {
//     console.error("Error fetching KPI resume:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
app.post("/alarms/zone/:alarmId", async (req, res) => {
  const { zones } = req.body;
  console.log("Updating alarm zone:", req.params.alarmId, zones);
  try {
    const alarm = await db.models.Alarms.findOne({
      where: {
        alarmId: req.params.alarmId,
      },
    });
    if (!alarm) {
      res.status(404).json({ error: "Alarm not found" });
      return;
    }

    // if (
    //   zone === null &&
    //   zone2 === null &&
    //   zone3 === null &&
    //   zone4 === null &&
    //   zone5 === null
    // ) {
    //   await db.models.alarmZoneTGWReport.destroy({
    //     where: {
    //       alarmId: req.params.alarmId,
    //     },
    //   });
    //   res.json(null);
    //   return;
    // }

    // await db.models.alarmZoneTGWReport.destroy({
    //   where: {
    //     alarmId: req.params.alarmId,
    //   },
    // });
    // const newZone = await db.models.alarmZoneTGWReport.create({
    //   alarmId: req.params.alarmId,
    //   zone,
    //   zone2,
    //   zone3,
    //   zone4,
    //   zone5,
    // });

    const newZone = await db.models.alarmZoneTGWReport.upsert({
      alarmId: alarm.alarmId,
      zones,
    });

    console.log("Alarm zone updated");
    res.json(newZone);
  } catch (error) {
    console.error("Error updating alarm zone:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/alarms/:alarmIdCode", async (req, res) => {
  const { alarmIdCode } = req.params;

  if (!alarmIdCode) {
    res.status(400).json({ error: "No alarm ID provided" });
    return;
  }

  try {
    const alarm = await db.models.Alarms.findOne({
      where: {
        [Op.or]: [{ alarmId: alarmIdCode }, { alarmCode: alarmIdCode }],
      },
    });
    res.json(alarm.toJSON());
  } catch (error) {
    console.error("Error fetching alarm:", error);
    res.status(500).json({ error: error.message });
  }
});

// PRODUCTION DATA
app.get("/production/data", async (req, res) => {
  try {
    const data = await db.models.ProductionData.findAll({
      order: [["date", "ASC"]],
      raw: true,
    });
    res.json(data);
  } catch (error) {
    console.error("Error fetching production data:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/production/data", async (req, res) => {
  const { date, start, end, dayOff, boxTreated } = req.body;
  try {
    await db.models.ProductionData.upsert({
      date,
      start,
      end,
      dayOff,
      boxTreated,
    });
    const data = await db.models.ProductionData.findOne({
      where: {
        date,
      },
    });
    res.json(data.dataValues);
  } catch (error) {
    console.error("Error creating production time:", error);
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

// CHARTS
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
          DatalogsWithoutExcluded
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
app.get("/charts/production/volume/:startDate/:endDate", async (req, res) => {
  const { startDate, endDate } = req.params;
  try {
    // Get the number of boxes treated per day between the start and end dates (inclusive)
    const result = await db.query(
      `
        SELECT
          date,
          boxTreated
        FROM
          ProductionData
        WHERE
          date BETWEEN :startDate AND :endDate
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
    console.error("Error fetching production volume:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fonction pour démarrer le serveur
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("Starting server...");
    const server = app.listen(PORT, () => {
      console.log(`API server successfully started on port ${PORT}`);
      resolve(server);
    });
    server.on("error", (error) => {
      console.error("Erreur du serveur:", error);
      reject(error);
    });
  });
}

// Fonction pour fermer le serveur
function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        console.error("Error while closing the server", error);
        reject(error);
      } else {
        console.log("Server closed successfully");
        resolve();
      }
    });
  });
}

module.exports = { startServer, closeServer };
