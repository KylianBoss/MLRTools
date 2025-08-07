import { Router } from "express";
import { db } from "../database.js";
import { Op } from "sequelize";

const router = Router();

router.get("/planned", async (req, res) => {
  try {
    const scheduledMaintenances = await db.models.MaintenanceSchedule.findAll({
      where: {
        status: ["scheduled", "assigned", "in_progress"],
      },
      order: [["scheduledTime", "ASC"]],
    });

    // Get the plan details for each scheduled maintenance
    const scheduledWithPlans = await Promise.all(
      scheduledMaintenances.map(async (maintenance) => {
        const plan = await db.models.MaintenancePlan.findByPk(
          maintenance.maintenancePlanId
        );
        return {
          ...maintenance.toJSON(),
          plan: plan ? plan.toJSON() : null,
        };
      })
    );

    // Get the assigned users for each scheduled maintenance
    const scheduledWithUsers = await Promise.all(
      scheduledWithPlans.map(async (maintenance) => {
        const users = await db.models.Users.findAll({
          where: { id: maintenance.assignedTo },
        });
        return {
          ...maintenance,
          assignedTo: users.length > 0 ? users[0].toJSON() : null,
        };
      })
    );

    res.json(scheduledWithUsers);
  } catch (error) {
    console.error("Error fetching scheduled maintenances:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/resume/:maintenanceId", async (req, res) => {
  const { maintenanceId } = req.params;
  try {
    const maintenance = await db.models.MaintenanceSchedule.findByPk(
      maintenanceId
    );
    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance not found" });
    }

    const maintenanceLog = await db.models.Maintenance.findByPk(
      maintenance.actualMaintenanceLogId
    );

    if (!maintenanceLog) {
      return res.status(404).json({ error: "Maintenance log not found" });
    }

    res.json({
      ...maintenance.toJSON(),
      report: maintenanceLog.report,
    });
  } catch (error) {
    console.error("Error fetching maintenance resume:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/start", async (req, res) => {
  const { id, userId } = req.body;
  try {
    const maintenance = await db.models.MaintenanceSchedule.findByPk(id);
    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance not found" });
    }

    const maintenanceLog = await db.models.Maintenance.create({
      maintenancePlanId: maintenance.maintenancePlanId,
      performedBy: userId,
      startTime: new Date(),
    });

    maintenance.status = "in_progress";
    maintenance.assignedTo = userId;
    maintenance.actualMaintenanceLogId = maintenanceLog.id;
    await maintenance.save();

    res.json({
      success: true,
      message: "Maintenance started successfully",
      maintenance: maintenance.toJSON(),
    });
  } catch (error) {
    console.error("Error starting maintenance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/save", async (req, res) => {
  const { id, report } = req.body;
  try {
    const maintenance = await db.models.MaintenanceSchedule.findByPk(id);
    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance not found" });
    }
    const maintenanceLog = await db.models.Maintenance.findByPk(
      maintenance.actualMaintenanceLogId
    );
    if (!maintenanceLog) {
      return res.status(404).json({ error: "Maintenance log not found" });
    }
    maintenanceLog.report = report;
    await maintenanceLog.save();
    res.json({
      success: true,
      message: "Maintenance report saved successfully",
      maintenance: maintenance.toJSON(),
    });
  } catch (error) {
    console.error("Error saving maintenance report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/complete", async (req, res) => {
  const { id, report } = req.body;
  try {
    const maintenance = await db.models.MaintenanceSchedule.findByPk(id);
    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance not found" });
    }

    const maintenanceLog = await db.models.Maintenance.findByPk(
      maintenance.actualMaintenanceLogId
    );
    if (!maintenanceLog) {
      return res.status(404).json({ error: "Maintenance log not found" });
    }

    const maintenancePlan = await db.models.MaintenancePlan.findByPk(
      maintenance.maintenancePlanId
    );
    if (!maintenancePlan) {
      return res.status(404).json({ error: "Maintenance plan not found" });
    }

    maintenancePlan.lastMaintenance = new Date();
    await maintenancePlan.save();

    maintenanceLog.endTime = new Date();
    maintenanceLog.duration =
      (maintenanceLog.endTime - maintenanceLog.startTime) / 1000; // Duration in seconds
    maintenanceLog.report = report;
    await maintenanceLog.save();

    maintenance.status = "completed";
    maintenance.actualMaintenanceLogId = null;
    await maintenance.save();

    res.json({
      success: true,
      message: "Maintenance completed successfully",
      maintenance: maintenance.toJSON(),
    });
  } catch (error) {
    console.error("Error completing maintenance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/plans", async (req, res) => {
  try {
    const plans = await db.models.MaintenancePlan.findAll({
      order: [["location", "ASC"]],
    });
    res.json(plans.map((plan) => plan.toJSON()));
  } catch (error) {
    console.error("Error fetching maintenance plans:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/plans/:planId", async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await db.models.MaintenancePlan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({ error: "Maintenance plan not found" });
    }

    const steps = await db.models.MaintenancePlanSteps.findAll({
      where: { maintenancePlanId: planId },
      order: [["order", "ASC"]],
    });

    const stepDetails = await Promise.all(
      steps.map(async (step) => {
        const stepDetail = await db.models.MaintenanceSteps.findByPk(
          step.stepId
        );
        return {
          ...stepDetail.toJSON(),
          order: step.order,
        };
      })
    );

    res.json({
      ...plan.toJSON(),
      steps: stepDetails.filter((step) => step !== null),
    });
  } catch (error) {
    console.error("Error fetching maintenance plan:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/plans/:planId/duplicate", async (req, res) => {
  const { planId } = req.params;
  const { location } = req.body;

  if (!planId || !location) {
    return res.status(400).json({ error: "Plan ID and location are required" });
  }

  try {
    const originalPlan = await db.models.MaintenancePlan.findByPk(planId);
    if (!originalPlan) {
      return res.status(404).json({ error: "Maintenance plan not found" });
    }
    const newPlan = await db.models.MaintenancePlan.create({
      location: location,
      type: originalPlan.type,
      description: originalPlan.description,
    });

    const originalSteps = await db.models.MaintenancePlanSteps.findAll({
      where: { maintenancePlanId: originalPlan.id },
      order: [["order", "ASC"]],
    });

    for (const step of originalSteps) {
      await db.models.MaintenancePlanSteps.create({
        maintenancePlanId: newPlan.id,
        stepId: step.stepId,
        order: step.order,
      });
    }

    res.json({
      success: true,
      message: "Maintenance plan duplicated successfully",
      newPlan: newPlan.toJSON(),
    });
  } catch (error) {
    console.error("Error duplicating maintenance plan:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/plans/steps-reorder", async (req, res) => {
  const { newStepData } = req.body;
  console.log(newStepData);

  try {
    for (const step of newStepData) {
      const existingStep = await db.models.MaintenancePlanSteps.findOne({
        where: {
          maintenancePlanId: step.maintenancePlanId,
          stepId: step.stepId,
        },
      });
      if (existingStep) {
        existingStep.order = step.order;
        await existingStep.save();
      } else {
        await db.models.MaintenancePlanSteps.create({
          maintenancePlanId: step.maintenancePlanId,
          stepId: step.stepId,
          order: step.order,
        });
      }
    }
    res.json({ success: true, message: "Steps reordered successfully" });
  } catch (error) {
    console.error("Error reordering maintenance steps:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/plans/steps", async (req, res) => {
  try {
    const step = await db.models.MaintenanceSteps.create(req.body);
    if (!step) {
      return res.status(400).json({ error: "Failed to create step" });
    }

    const planStep = await db.models.MaintenancePlanSteps.create({
      maintenancePlanId: req.body.maintenancePlanId,
      stepId: step.id,
      order: req.body.order || 0, // Default order to 0 if not provided
    });

    res.json({
      success: true,
      message: "Step created successfully",
      step: {
        ...step.toJSON(),
        order: planStep.order,
      },
    });
  } catch (error) {
    console.error("Error creating maintenance step:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.put("/plans/steps/:stepId", async (req, res) => {
  const { stepId } = req.params;
  try {
    const step = await db.models.MaintenanceSteps.findByPk(stepId);
    if (!step) {
      return res.status(404).json({ error: "Step not found" });
    }
    await step.update(req.body);

    res.json({
      success: true,
      message: "Step updated successfully",
      step: step.toJSON(),
    });
  } catch (error) {
    console.error("Error updating maintenance step:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.delete("/plans/steps/:stepId", async (req, res) => {
  const { stepId } = req.params;
  try {
    const step = await db.models.MaintenanceSteps.findByPk(stepId);
    if (!step) {
      return res.status(404).json({ error: "Step not found" });
    }

    // Delete the step from the MaintenancePlanSteps table
    await db.models.MaintenancePlanSteps.destroy({
      where: { stepId: step.id },
    });

    // Delete the step itself
    await step.destroy();

    res.json({
      success: true,
      message: "Step deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting maintenance step:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/reports", async (req, res) => {
  try {
    const reports = await db.models.Maintenance.findAll({
      order: [["startTime", "DESC"]],
      attributes: [
        "id",
        "maintenancePlanId",
        "performedBy",
        "startTime",
        "endTime",
        "duration",
      ],
      where: {
        endTime: {
          [Op.ne]: null, // Only fetch completed reports
        }
      },
    });
    const reportDetails = await Promise.all(
      reports.map(async (report) => {
        const plan = await db.models.MaintenancePlan.findByPk(
          report.maintenancePlanId
        );
        const user = await db.models.Users.findByPk(report.performedBy, {
          attributes: ["id", "fullname"],
        });
        return {
          ...report.toJSON(),
          plan: plan ? plan.toJSON() : null,
          performedBy: user ? user.toJSON() : null,
        };
      })
    );
    res.json(reportDetails);
  } catch (error) {
    console.error("Error fetching maintenance reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/reports/:reportId", async (req, res) => {
  const { reportId } = req.params;
  try {
    const report = await db.models.Maintenance.findByPk(reportId);
    if (!report) {
      return res.status(404).json({ error: "Maintenance report not found" });
    }
    const plan = await db.models.MaintenancePlan.findByPk(
      report.maintenancePlanId
    );
    const user = await db.models.Users.findByPk(report.performedBy, {
      attributes: ["id", "fullname"],
    });
    res.json({
      ...report.toJSON(),
      plan: plan ? plan.toJSON() : null,
      performedBy: user ? user.toJSON() : null,
    });
  } catch (error) {
    console.error("Error fetching maintenance report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/:maintenanceId", async (req, res) => {
  const { maintenanceId } = req.params;
  try {
    const maintenanceSchedule = await db.models.MaintenanceSchedule.findByPk(
      maintenanceId
    );
    if (!maintenanceSchedule) {
      return res.status(404).json({ error: "Maintenance schedule not found" });
    }

    const maintenance = await db.models.MaintenancePlan.findByPk(
      maintenanceSchedule.maintenancePlanId
    );
    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance not found" });
    }

    const s = await db.models.MaintenancePlanSteps.findAll({
      where: { maintenancePlanId: maintenance.id },
      order: [["order", "ASC"]],
    });

    const steps = s.map(async (step) => {
      const stepDetails = await db.models.MaintenanceSteps.findByPk(
        step.stepId
      );
      return stepDetails ? stepDetails.toJSON() : null;
    });

    res.json({
      ...maintenance.toJSON(),
      steps: await Promise.all(steps),
    });
  } catch (error) {
    console.error("Error fetching maintenance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
