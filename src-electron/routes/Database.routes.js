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
    console.log("Syncing models");
    await db.sync({ alter: true });
    console.log("Models synced");
    res.sendStatus(201);
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

export default router;
