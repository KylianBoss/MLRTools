import { Router } from "express";
import { getDB } from "../database.js";

const router = Router();

router.post("/", async (req, res) => {
  const db = getDB();
  const { userId, message, type } = req.body;

  if (!userId || !message || !type) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const newNotification = await db.models.Notifications.create({
      userId,
      message,
      type,
      read: false,
    });

    res.status(201).json(newNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: error.message });
  }
});
router.get("/:userId", async (req, res) => {
  const db = getDB();
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ error: "No user ID provided" });
    return;
  }

  try {
    const notifications = await db.models.Notifications.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
});
router.post("/read/:notificationId", async (req, res) => {
  const db = getDB();
  const { notificationId } = req.params;

  if (!notificationId) {
    res.status(400).json({ error: "No notification ID provided" });
    return;
  }

  try {
    const notification = await db.models.Notifications.findByPk(
      notificationId
    );

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: error.message });
  }
});
router.delete("/:notificationId", async (req, res) => {
  const db = getDB();
  const { notificationId } = req.params;

  if (!notificationId) {
    res.status(400).json({ error: "No notification ID provided" });
    return;
  }

  try {
    const notification = await db.models.Notifications.findByPk(
      notificationId
    );

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    await notification.destroy();

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

