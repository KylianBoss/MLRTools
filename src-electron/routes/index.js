import { Router } from "express";

import ConfigRouter from "./Config.routes.js";
import DatabaseRouter from "./Database.routes.js";
import UsersRouter from "./Users.routes.js";
import AlarmsRouter from "./Alarms.routes.js";
import KPIRouter from "./KPI.routes.js";
import CronRouter from "./Cron.routes.js";
import BotRouter from "./Bot.routes.js";
// MaintenanceRouter retiré le 2026-10-07 : fonctionnalité "maintenance" (plans/étapes)
// abandonnée — ne reste en usage que les rapports d'intervention (Interventions.routes.js).
// Toutes les routes de Maintenance.routes.js référencent des modèles Sequelize inexistants
// (db.models.MaintenanceSteps etc.) et plantaient en 500 ; fichier gardé sur disque, non monté.
import ImageRouter from "./Image.routes.js";
import LocationRouter from "./Locations.routes.js";
import ChartsRouter from "./Charts.routes.js";
import NotificationsRouter from "./Notifications.routes.js";
import AuthRouter from "./Auth.routes.js";
import InterventionsRouter from "./Interventions.routes.js";
import SettingsRouter from "./Settings.routes.js";
import CaseCrashesRouter from "./CaseCrashes.routes.js";
import StingraysRouter from "./Stingrays.routes.js";
import ReportsRouter from "./Reports.routes.js";

const router = Router();

router.use("/config", ConfigRouter);
router.use("/db", DatabaseRouter);
router.use("/users", UsersRouter);
router.use("/alarms", AlarmsRouter);
router.use("/kpi", KPIRouter);
router.use("/cron", CronRouter);
router.use("/bot", BotRouter);
router.use("/images", ImageRouter);
router.use("/locations", LocationRouter);
router.use("/charts", ChartsRouter);
router.use("/notifications", NotificationsRouter);
router.use("/auth", AuthRouter);
router.use("/interventions", InterventionsRouter);
router.use("/settings", SettingsRouter);
router.use("/case-crashes", CaseCrashesRouter);
router.use("/stingrays", StingraysRouter);
router.use("/reports", ReportsRouter);

export default router;
