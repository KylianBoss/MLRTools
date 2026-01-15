import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { Op } from "sequelize";

const router = Router();

router.post("/sync-models", async (req, res) => {
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
    try {
      console.log("Syncing models");
      await db.sync({ alter: true, logging: console.log });
      await db.sync({ logging: false });
      console.log("Models synced");
      res.sendStatus(201);
    } catch (syncError) {
      console.error("Error syncing models:", syncError);
      res.status(500).json({ error: "Failed to sync models" });
    }
  } catch (error) {
    console.error("Error syncing models:", JSON.stringify(error));
    res.status(500).json({ error: error.message });
  }
});
router.post("/empty-day-resume", async (req, res) => {
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
    console.log("Emptying day resume");
    await db.models.DayResume.destroy({
      where: {},
    });
    console.log("Day resume emptied");
    res.sendStatus(201);
  } catch (error) {
    console.error("Error emptying day resume:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/empty-day-resume-at-date", async (req, res) => {
  const { user, date } = req.body;
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
    console.log("Emptying day resume at date", date);
    await db.models.DayResume.destroy({
      where: {
        from: {
          [Op.between]: [
            dayjs(date).startOf("day").format("YYYY-MM-DD HH:mm:ss"),
            dayjs(date).endOf("day").format("YYYY-MM-DD HH:mm:ss"),
          ],
        },
      },
    });
    console.log("Day resume emptied");
    res.sendStatus(201);
  } catch (error) {
    console.error("Error emptying day resume at date:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/execute-code", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ error: "No code provided" });
    return;
  }

  // Validate code - only allow read operations and stored procedures
  const codeToCheck = code.toLowerCase();

  // List of forbidden operations
  const forbiddenPatterns = [
    /\.update\s*\(/,
    /\.destroy\s*\(/,
    /\.delete\s*\(/,
    /\.create\s*\(/,
    /\.bulkCreate\s*\(/,
    /\.bulkUpdate\s*\(/,
    /\.bulkDelete\s*\(/,
    /\.upsert\s*\(/,
    /\.truncate\s*\(/,
    /\.drop\s*\(/,
    /\.sync\s*\(/,
    /insert\s+into/i,
    /update\s+\w+\s+set/i,
    /delete\s+from/i,
    /drop\s+(table|database)/i,
    /truncate\s+table/i,
    /alter\s+table/i,
    /create\s+(table|database)/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(code)) {
      res.status(403).json({
        error:
          "Opération non autorisée. Seules les opérations de lecture et les procédures stockées sont autorisées.",
        details:
          "Les opérations UPDATE, DELETE, CREATE et INSERT sont interdites.",
      });
      return;
    }
  }

  try {
    // Create an async function from the code
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    // Wrap the code with a return statement if it doesn't have one
    const wrappedCode = code.trim().startsWith("return")
      ? code
      : `return (${code})`;

    const fn = new AsyncFunction(
      "db",
      "Op",
      "dayjs",
      wrappedCode.replace(";", "")
    );

    // Execute the function with db, Op, and dayjs in scope
    let result = await fn(db, Op, dayjs);

    // If result is a Promise, wait for it
    if (result && typeof result.then === "function") {
      result = await result;
    }

    // Send the result back
    res.json({ result });
  } catch (error) {
    console.error("Error executing code:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

router.get("/models", async (req, res) => {
  try {
    // Get all model names
    const models = Object.keys(db.models);
    res.json({ models });
  } catch (error) {
    console.error("Error getting models:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
