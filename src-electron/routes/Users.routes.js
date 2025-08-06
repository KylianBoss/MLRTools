import { Router } from "express";
import { db } from "../database.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const users = await db.models.Users.findAll({
      include: {
        model: db.models.UserAccess,
        attributes: ["menuId"],
      },
    });
    res.json(
      users.map((u) => {
        return {
          ...u.toJSON(),
          UserAccesses: u.UserAccesses.map((a) => a.menuId),
        };
      })
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: error.message });
  }
});
router.put("/", async (req, res) => {
  const {
    id,
    username,
    fullname,
    autorised,
    UserAccesses,
    isBot,
    recieveDailyReport,
    isTechnician,
  } = req.body;
  try {
    const user = await db.models.Users.update(
      {
        username,
        fullname,
        autorised,
        isBot,
        recieveDailyReport,
        isTechnician,
      },
      {
        where: {
          id,
        },
      }
    );

    await db.models.UserAccess.destroy({
      where: {
        userId: id,
      },
    });

    await db.models.UserAccess.bulkCreate(
      UserAccesses.map((a) => ({
        userId: id,
        menuId: a,
      }))
    );

    res.json(
      user.map((u) => {
        return {
          ...u,
          UserAccesses: UserAccesses,
        };
      })
    );
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
