import { Router } from "express";
import { getDB } from "../database.js";
import dayjs from "dayjs";
import { requirePermission } from "../middlewares/permissions.js";

const router = Router();

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
      order: [["plannedDate", "ASC"], ['startTime', 'ASC']],
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
      // Use exact time range without margin
      const startDateTime = dayjs(`${plannedDate} ${startTime || "00:00:00"}`)
        .subtract(5, "minute")
        .toISOString();
      const endDateTime = dayjs(`${plannedDate} ${endTime || "23:59:59"}`)
        .add(5, "minute")
        .toISOString();

      let whereClause = {
        timeOfOccurence: {
          [db.Sequelize.Op.between]: [startDateTime, endDateTime],
        },
        // Exclude already treated alarms
        [db.Sequelize.Op.or]: [
          { x_treated: { [db.Sequelize.Op.is]: null } },
          { x_treated: false },
        ],
      };

      // If alarmCode is provided, search more intelligently
      if (alarmCode) {
        // Normalize search term (remove spaces, special chars for flexible matching)
        const normalizedCode = alarmCode.replace(/[\s\-_]/g, "").toLowerCase();

        // Build flexible search patterns
        const searchPatterns = [
          alarmCode, // Exact match
          `%${alarmCode}%`, // Substring match
          `%${normalizedCode}%`, // Normalized match
        ];

        // Try to extract numbers for numeric matching (e.g., "X003" -> "003" or "3")
        const numMatch = alarmCode.match(/\d+/);
        if (numMatch) {
          const numPart = numMatch[0];
          searchPatterns.push(`%${numPart}%`);
          // Also try without leading zeros
          const numWithoutZeros = parseInt(numPart, 10).toString();
          if (numWithoutZeros !== numPart) {
            searchPatterns.push(`%${numWithoutZeros}%`);
          }
        }

        const alarms = await db.models.Alarms.findAll({
          where: {
            [db.Sequelize.Op.or]: [
              ...searchPatterns.map((pattern) => ({
                alarmCode: { [db.Sequelize.Op.like]: pattern },
              })),
              ...searchPatterns.map((pattern) => ({
                alarmText: { [db.Sequelize.Op.like]: pattern },
              })),
              // Also search in alarmArea for location-based interventions
              ...searchPatterns.map((pattern) => ({
                alarmArea: { [db.Sequelize.Op.like]: pattern },
              })),
            ],
          },
          attributes: ["alarmId"],
          raw: true,
        });

        const alarmIds = alarms.map((a) => a.alarmId);
        if (alarmIds.length > 0) {
          whereClause.alarmId = { [db.Sequelize.Op.in]: alarmIds };
        } else {
          // No alarms found with this code, but still return time-based matches
          console.log(
            `No alarm codes matched for "${alarmCode}", returning time-based results only`
          );
        }
      }

      const datalogs = await db.models.Datalog.findAll({
        where: whereClause,
        order: [["timeOfOccurence", "ASC"]],
      });

      // Calculate relevance score for each alarm
      const results = datalogs.map((log) => {
        const logData = log.toJSON();
        let score = 0;

        // Score based on alarm code matching
        if (alarmCode && logData) {
          const alarmCodeLower = (logData.alarmCode || "").toLowerCase();
          const alarmTextLower = (logData.alarmText || "").toLowerCase();
          const searchLower = alarmCode.toLowerCase();

          if (alarmCodeLower === searchLower) score += 100; // Exact match
          else if (alarmCodeLower.includes(searchLower))
            score += 50; // Contains
          else if (alarmTextLower.includes(searchLower)) score += 30; // In text
        }

        // Score based on time proximity (closer to intervention time = higher score)
        if (startTime && logData.timeOfOccurence) {
          const interventionStart = dayjs(`${plannedDate} ${startTime}`);
          const alarmTime = dayjs(logData.timeOfOccurence);
          const diffMinutes = Math.abs(
            alarmTime.diff(interventionStart, "minute")
          );

          if (diffMinutes <= 5) score += 20; // Very close (within 5 min)
          else if (diffMinutes <= 15) score += 10; // Close (within 15 min)
          else if (diffMinutes <= 30) score += 5; // Moderate (within 30 min)
        }

        return {
          ...logData,
          relevanceScore: score,
        };
      });

      // Sort by relevance score (descending), then by time
      results.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return new Date(a.timeOfOccurence) - new Date(b.timeOfOccurence);
      });

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

    if (!selectedAlarmIds || selectedAlarmIds.length === 0) {
      return res.status(400).json({ error: "selectedAlarmIds is required" });
    }

    try {
      const intervention = await db.models.Intervention.findByPk(id);

      if (!intervention) {
        return res.status(404).json({ error: "Intervention not found" });
      }

      // Create a new group
      const maxGroup = await db.models.Datalog.max("x_group");
      const groupId = (maxGroup || 0) + 1;

      // Update all selected alarms
      await db.models.Datalog.update(
        {
          x_group: groupId,
          x_comment: comment || intervention.comment,
          x_state:
            isPlanned !== undefined
              ? isPlanned
                ? "planned"
                : "unplanned"
              : intervention.isPlanned
              ? "planned"
              : "unplanned",
          x_treated: true,
        },
        { where: { dbId: selectedAlarmIds } }
      );

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
