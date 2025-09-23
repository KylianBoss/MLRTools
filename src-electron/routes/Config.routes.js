import e, { Router } from "express";
import path from "path";
import fs from "fs/promises";
import { initDB } from "../database.js";
import Hooks from "../hooks.js";

const router = Router();

const CONFIG_PATH = path.join(process.cwd(), "storage", "mlrtools-config.json");
const STORAGE_PATH = path.join(process.cwd(), "storage");

router.get("/", async (req, res) => {
  try {
    const config = await fs.readFile(CONFIG_PATH, "utf-8");
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

    const hooks = new Hooks(db, user.fullname);
    hooks.init();

    res.json({
      config: true,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Error reading config file:", error);
    res.status(404).json({ error: "Config file not found" });
  }
});
router.post("/", async (req, res) => {
  try {
    await fs.mkdir(path.join(STORAGE_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(req.body));
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

export default router;
