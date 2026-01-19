import { Router } from "express";
import { db } from "../database.js";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { require2FA } from "./Auth.routes.js";

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
        requires2FA: true,
        error:
          "Opération non autorisée. Seules les opérations de lecture et les procédures stockées sont autorisées.",
        details:
          "Les opérations UPDATE, DELETE, CREATE et INSERT sont interdites. Utilisez la vérification 2FA pour override.",
      });
      return;
    }
  }

  try {
    const MAX_RESULTS = 5000;

    // Créer un proxy de db qui ajoute automatiquement un limit aux requêtes
    const dbProxy = new Proxy(db, {
      get(target, prop) {
        if (prop === "models") {
          // Créer un proxy pour chaque model
          return new Proxy(target.models, {
            get(modelsTarget, modelName) {
              const model = modelsTarget[modelName];
              if (!model) return model;

              // Créer un proxy pour le model qui intercepte les méthodes
              return new Proxy(model, {
                get(modelTarget, methodName) {
                  const originalMethod = modelTarget[methodName];

                  // Intercepter les méthodes de lecture
                  if (["findAll", "findAndCountAll"].includes(methodName)) {
                    return function (options = {}) {
                      // Ajouter un limit par défaut si non spécifié
                      if (!options.limit) {
                        options.limit = MAX_RESULTS;
                      } else if (options.limit > MAX_RESULTS) {
                        // Limiter même si un limit supérieur est spécifié
                        options.limit = MAX_RESULTS;
                      }
                      return originalMethod.call(modelTarget, options);
                    };
                  }

                  return originalMethod;
                },
              });
            },
          });
        }
        return target[prop];
      },
    });

    // Create an async function from the code
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    // Détecter si le code contient plusieurs instructions (séparées par des points-virgules)
    const codeLines = code
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Toujours exécuter et retourner un tableau de résultats
    const resultsCode = codeLines
      .map((line, index) => `const result${index} = await (${line});`)
      .join("\n");
    const returnCode = `return [${codeLines
      .map((_, index) => `result${index}`)
      .join(", ")}];`;
    const wrappedCode = `${resultsCode}\n${returnCode}`;

    const fn = new AsyncFunction("db", "Op", "dayjs", wrappedCode);

    // Execute the function with db proxy, Op, and dayjs in scope
    let result = await fn(dbProxy, Op, dayjs);

    // If result is a Promise, wait for it
    if (result && typeof result.then === "function") {
      result = await result;
    }

    // Vérifier si les résultats ont été limités (pour information)
    let truncated = false;
    if (Array.isArray(result) && result.length === MAX_RESULTS) {
      truncated = true;
    }

    // Send the result back
    res.json({
      result,
      truncated,
      message: truncated
        ? `Résultats limités à ${MAX_RESULTS} entrées`
        : undefined,
    });
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

// Route protégée par 2FA pour override les forbiddenPatterns
router.post("/execute-code-override", require2FA, async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ error: "Aucun code fourni" });
    return;
  }

  try {
    const MAX_RESULTS = 5000;

    // Créer un proxy de db qui ajoute automatiquement un limit aux requêtes
    const dbProxy = new Proxy(db, {
      get(target, prop) {
        if (prop === "models") {
          // Créer un proxy pour chaque model
          return new Proxy(target.models, {
            get(modelsTarget, modelName) {
              const model = modelsTarget[modelName];
              if (!model) return model;

              // Créer un proxy pour le model qui intercepte les méthodes
              return new Proxy(model, {
                get(modelTarget, methodName) {
                  const originalMethod = modelTarget[methodName];

                  // Intercepter les méthodes de lecture
                  if (
                    typeof originalMethod === "function" &&
                    (methodName === "findAll" ||
                      methodName === "findAndCountAll")
                  ) {
                    return function (...args) {
                      const options = args[0] || {};
                      // Ajouter un limit s'il n'y en a pas ou s'il est supérieur à MAX_RESULTS
                      if (!options.limit || options.limit > MAX_RESULTS) {
                        options.limit = MAX_RESULTS;
                      }
                      args[0] = options;
                      return originalMethod.apply(this, args);
                    };
                  }

                  return originalMethod;
                },
              });
            },
          });
        }
        return target[prop];
      },
    });

    // Si le code contient plusieurs instructions (séparées par ;)
    const statements = code
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Créer une fonction asynchrone
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    // Si plusieurs instructions, les exécuter séquentiellement
    const resultsCode =
      statements.length > 1
        ? statements
            .map((stmt, index) => `const result${index} = await (${stmt});`)
            .join("\n")
        : `const result0 = await (${code});`;

    const returnCode =
      statements.length > 1
        ? `return [${statements
            .map((_, index) => `result${index}`)
            .join(", ")}];`
        : "return result0;";

    const wrappedCode = `${resultsCode}\n${returnCode}`;

    const fn = new AsyncFunction("db", "Op", "dayjs", wrappedCode);

    // Execute the function with db proxy, Op, and dayjs in scope
    let result = await fn(dbProxy, Op, dayjs);

    // If result is a Promise, wait for it
    if (result && typeof result.then === "function") {
      result = await result;
    }

    // Vérifier si les résultats ont été limités (pour information)
    let truncated = false;
    if (Array.isArray(result) && result.length === MAX_RESULTS) {
      truncated = true;
    }

    // Send the result back
    res.json({
      result,
      truncated,
      message: truncated
        ? `Résultats limités à ${MAX_RESULTS} entrées`
        : undefined,
    });
  } catch (error) {
    console.error("Error executing code with override:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

export default router;
