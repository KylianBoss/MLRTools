import { Router } from "express";
import { getDB } from "../database.js";
import dayjs from "dayjs";
import { requirePermission } from "../middlewares/permissions.js";
import { Op } from "sequelize";
import isBetween from "dayjs/plugin/isBetween.js";

const router = Router();
dayjs.extend(isBetween);

// Get all interventions
router.get("/journal", async (req, res) => {
  const db = getDB();

  try {
    const interventions = await db.models.Intervention.findAll({
      include: [
        {
          model: db.models.Users,
          as: "creator",
          attributes: ["fullname"],
        },
      ],
      order: [
        ["plannedDate", "ASC"],
        ["startTime", "ASC"],
      ],
    });

    // Format data to include fullname at root level
    const formattedInterventions = interventions.map((i) => {
      const data = i.toJSON();
      return {
        ...data,
        creatorFullname: data.creator?.fullname || data.createdBy,
        creator: undefined,
      };
    });

    res.json(formattedInterventions);
  } catch (error) {
    console.error("Error fetching interventions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get interventions for a specific date
router.get(
  "/journal/:date",
  requirePermission("canAccessJournal"),
  async (req, res) => {
    const db = getDB();
    const { date } = req.params;

    try {
      const interventions = await db.models.Intervention.findAll({
        where: {
          plannedDate: date,
        },
        include: [
          {
            model: db.models.Users,
            as: "creator",
            attributes: ["fullname"],
          },
        ],
        order: [
          ["createdAt", "DESC"],
          ["startTime", "ASC"],
        ],
      });

      // Format data to include fullname at root level
      const formattedInterventions = interventions.map((i) => {
        const data = i.toJSON();
        return {
          ...data,
          creatorFullname: data.creator?.fullname || data.createdBy,
          creator: undefined,
        };
      });

      res.json(formattedInterventions);
    } catch (error) {
      console.error("Error fetching interventions:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get pending interventions for a specific date (for DailyAnalysis modal)
router.get(
  "/pending/:date",
  requirePermission("canValidateInterventions"),
  async (req, res) => {
    const db = getDB();
    const { date } = req.params;

    try {
      const interventions = await db.models.Intervention.findAll({
        where: {
          plannedDate: date,
          status: "pending",
        },
        include: [
          {
            model: db.models.Users,
            as: "creator",
            attributes: ["fullname"],
          },
        ],
        order: [["startTime", "ASC"]],
      });

      // Format data to include fullname at root level
      const formattedInterventions = interventions.map((i) => {
        const data = i.toJSON();
        return {
          ...data,
          creatorFullname: data.creator?.fullname || data.createdBy,
          creator: undefined,
        };
      });

      res.json(formattedInterventions);
    } catch (error) {
      console.error("Error fetching pending interventions:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Create a new intervention
router.post(
  "/journal",
  requirePermission("canAccessJournal"),
  async (req, res) => {
    const db = getDB();
    const {
      plannedDate,
      alarmCode,
      description,
      startTime,
      endTime,
      comment,
      isPlanned,
    } = req.body;

    if (!plannedDate) {
      return res.status(400).json({ error: "plannedDate is required" });
    }

    try {
      const intervention = await db.models.Intervention.create({
        plannedDate,
        alarmCode,
        description,
        startTime,
        endTime,
        comment,
        isPlanned: isPlanned !== undefined ? isPlanned : false,
        createdBy: req.userId,
        status: "pending",
      });

      res.status(201).json(intervention);
    } catch (error) {
      console.error("Error creating intervention:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Update an intervention (only by creator)
router.patch(
  "/journal/:id",
  requirePermission("canAccessJournal"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { ...updateData } = req.body;

    try {
      const intervention = await db.models.Intervention.findByPk(id);

      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }

      // Check if user is the creator
      if (intervention.createdBy !== req.userId) {
        return res
          .status(403)
          .json({ error: "Only the creator can modify this intervention" });
      }

      // Don't allow updating certain fields
      delete updateData.createdBy;
      delete updateData.createdAt;
      delete updateData.status;
      delete updateData.validatedAt;
      delete updateData.validatedBy;

      await intervention.update(updateData);

      res.json(intervention);
    } catch (error) {
      console.error("Error updating intervention:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete an intervention (only by creator)
router.delete(
  "/journal/:id",
  requirePermission("canAccessJournal"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    try {
      const intervention = await db.models.Intervention.findByPk(id);

      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }

      // Check if user is the creator
      if (intervention.createdBy !== req.userId) {
        return res
          .status(403)
          .json({ error: "Only the creator can delete this intervention" });
      }

      await intervention.destroy();

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting intervention:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Find matching alarms for an intervention
router.post(
  "/find-matching-alarms",
  requirePermission("canValidateInterventions"),
  async (req, res) => {
    const db = getDB();
    const { alarmCode, startTime, endTime, plannedDate } = req.body;

    if (!plannedDate) {
      return res.status(400).json({ error: "plannedDate is required" });
    }

    try {
      // Use exact time range with 5 minutes margin
      const startDateTime = dayjs(`${plannedDate} ${startTime || "00:00:00"}`)
        .subtract(5, "minute")
        .toISOString();
      const endDateTime = dayjs(`${plannedDate} ${endTime || "23:59:59"}`)
        .add(5, "minute")
        .toISOString();

      // Get all alarms for the day
      const MIN_ALARM_DURATION = await db.models.Settings.getValue(
        "MIN_ALARM_DURATION"
      );

      const primaryAlarms = await db.models.Alarms.findAll({
        where: {
          type: "primary",
        },
        attributes: ["alarmId"],
      }).then((primaryAlarms) => primaryAlarms.map((a) => a.alarmId));
      let alarms = await db.models.Datalog.findAll({
        where: {
          duration: {
            [Op.gte]: MIN_ALARM_DURATION,
          },
          timeOfOccurence: {
            [Op.between]: [
              dayjs().subtract(1, "day").startOf("day").toDate(),
              dayjs().subtract(1, "day").endOf("day").toDate(),
            ],
          },
          alarmId: primaryAlarms,
        },
        order: [["timeOfOccurence", "ASC"]],
      });

      // If time difference between start and end dateTime is equal to 0 minutes, continue, otherwise filter alarms ba date and time
      if (dayjs(endDateTime).diff(dayjs(startDateTime), "minute") > 0) {
        console.log(
          "Looking for alarms between ",
          startDateTime,
          " and ",
          endDateTime
        );
        alarms = alarms.filter(
          (a) =>
            dayjs(a.timeOfOccurence).isBetween(startDateTime, endDateTime) ||
            dayjs(a.timeOfOccurence).isSame(startDateTime) ||
            dayjs(a.timeOfOccurence).isSame(endDateTime) ||
            dayjs(a.timeOfAcknowledge).isBetween(startDateTime, endDateTime) ||
            dayjs(a.timeOfAcknowledge).isSame(startDateTime) ||
            dayjs(a.timeOfAcknowledge).isSame(endDateTime)
        );
      }

      // Check for the alarmCode
      if (alarmCode !== "*") {
        const [dataSource, layoutPosition] = alarmCode
          .split(".")
          .map((part) => part.trim());

        if (/stingray.\d/i.test(alarmCode)) {
          const [_, number] = alarmCode.split(".");
          alarms = alarms.filter((a) =>
            a.alarmText.toLowerCase().includes(`Shuttle ${number}`)
          );
        } else {
          alarms = alarms.filter((a) =>
            a.dataSource.toLowerCase().includes(dataSource.toLowerCase())
          );
        }

        if (layoutPosition) {
          alarms = alarms.filter((a) =>
            a.alarmArea.toLowerCase().includes(layoutPosition.toLowerCase())
          );
        }
      }

      // Sort  by time
      alarms.sort(
        (a, b) => new Date(a.timeOfOccurence) - new Date(b.timeOfOccurence)
      );

      const results = alarms.map((log) => log.toJSON());

      res.json(results);
    } catch (error) {
      console.error("Error finding matching alarms:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Validate an intervention and group alarms
router.post(
  "/journal/:id/validate",
  requirePermission("canValidateInterventions"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { selectedAlarmIds, comment, isPlanned } = req.body;

    if (!selectedAlarmIds) {
      return res.status(400).json({ error: "selectedAlarmIds is required" });
    }

    try {
      const intervention = await db.models.Intervention.findByPk(id);

      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }

      const alarmsQty = selectedAlarmIds.length;

      // Create a new group
      const maxGroup = await db.models.Datalog.max("x_group");
      const groupId = (maxGroup || 0) + 1;

      // Get all alarms by dbId
      const alarmsToUpdate = await db.models.Datalog.findAll({
        where: { dbId: selectedAlarmIds },
      });

      // Check if the number of found alarms matches the number of selected IDs
      if (alarmsToUpdate.length !== alarmsQty) {
        console.warn(
          `Warning: Number of alarms found (${alarmsToUpdate.length}) does not match number of selected IDs (${alarmsQty})`
        );
        return res.status(400).json({
          error: `Mismatch in selected alarms. Found ${alarmsToUpdate.length} alarms for ${selectedAlarmIds.length} IDs.`,
        });
      }

      // Update all selected alarms in a transaction
      const t = await db.transaction();
      try {
        for (const alarm of alarmsToUpdate) {
          await alarm.update(
            {
              x_treated: true,
              x_comment: comment || "",
              x_group: groupId,
              x_state: isPlanned ? "planned" : "unplanned",
            },
            { transaction: t }
          );
        }
        await t.commit();
      } catch (error) {
        await t.rollback();
        console.error("Error updating alarms:", error);
        return res.status(500).json({ error: "Failed to update alarms" });
      }

      // Mark intervention as validated
      await intervention.update({
        status: "validated",
        validatedAt: new Date(),
        validatedBy: req.userId,
      });

      res.json({
        success: true,
        groupId,
        count: selectedAlarmIds.length,
      });
    } catch (error) {
      console.error("Error validating intervention:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Ignore an intervention
router.post(
  "/journal/:id/ignore",
  requirePermission("canValidateInterventions"),
  async (req, res) => {
    const db = getDB();
    const { id } = req.params;

    try {
      const intervention = await db.models.Intervention.findByPk(id);

      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }

      await intervention.update({
        status: "ignored",
        validatedAt: new Date(),
        validatedBy: req.userId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error ignoring intervention:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
