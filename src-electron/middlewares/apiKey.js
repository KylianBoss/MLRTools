import { getDB } from "../database.js";

/**
 * Middleware to check a shared-secret API key for external callers (e.g. Power Automate)
 */
export const checkApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "x-api-key header is required" });
  }

  try {
    const db = getDB();
    const botApiKey = await db.models.Settings.getValue("botApiKey");

    if (!botApiKey || apiKey !== botApiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    next();
  } catch (error) {
    console.error("Error checking API key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
