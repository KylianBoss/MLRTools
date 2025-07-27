import { Router } from "express";
import { db } from "../database.js";

const router = Router();

router.post("/active", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const user = await db.models.User.findByPk(userId);
    if (!user || !user.isBot) {
      return res.status(404).json({ error: "Bot not found or not a bot user" });
    }

    user.isBotActive = new Date();
    await user.save();

    return res.json({ message: "Bot activity updated successfully" });
  } catch (error) {
    console.error("Error updating bot activity:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
