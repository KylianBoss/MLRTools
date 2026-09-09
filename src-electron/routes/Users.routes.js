import { Router } from "express";
import { getDB } from "../database.js";
import { requirePermission } from "../middlewares/permissions.js";

const router = Router();

router.get("/", requirePermission("canAccessAdminUser"), async (req, res) => {
  const db = getDB();
  try {
    const users = await db.models.Users.findAll({
      include: [
        {
          model: db.models.UserAccess,
          attributes: ["menuId"],
        },
        {
          model: db.models.UserReports,
          attributes: ["reportId"],
        },
      ],
    });
    res.json(
      users.map((u) => {
        return {
          ...u.toJSON(),
          UserAccesses: u.UserAccesses.map((a) => a.menuId),
          reportIds: u.UserReports.map((r) => r.reportId),
        };
      })
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: error.message });
  }
});
router.put("/", requirePermission("canAccessAdminUser"), async (req, res) => {
  const db = getDB();
  const {
    id,
    username,
    fullname,
    initials,
    autorised,
    UserAccesses,
    reportIds,
    isBot,
    recieveDailyAlarmsByUser,
    isTechnician,
  } = req.body;
  try {
    const user = await db.models.Users.update(
      {
        username,
        fullname,
        initials,
        autorised,
        isBot,
        recieveDailyAlarmsByUser,
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

    // Abonnements aux rapports KPI (many-to-many, remplace recieveDailyReport).
    // Transaction : si le bulkCreate échoue (ex: reportIds dupliqués, viole
    // l'index unique userId+reportId), on ne veut pas laisser l'utilisateur
    // sans aucun abonnement — trouvé en revue adversariale.
    const uniqueReportIds = Array.isArray(reportIds)
      ? [...new Set(reportIds)]
      : [];

    await db.transaction(async (transaction) => {
      await db.models.UserReports.destroy({
        where: { userId: id },
        transaction,
      });

      if (uniqueReportIds.length > 0) {
        await db.models.UserReports.bulkCreate(
          uniqueReportIds.map((reportId) => ({
            userId: id,
            reportId,
          })),
          { transaction }
        );
      }
    });

    res.json(
      user.map((u) => {
        return {
          ...u,
          UserAccesses: UserAccesses,
          reportIds: uniqueReportIds,
        };
      })
    );
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

