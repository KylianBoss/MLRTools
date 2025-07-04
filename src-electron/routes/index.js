import { Router } from "express";

import ConfigRouter from "./Config.routes.js";
import DatabaseRouter from "./Database.routes.js";
import UsersRouter from "./Users.routes.js";
import AlarmsRouter from "./Alarms.routes.js";
import KPIRouter from "./KPI.routes.js";
import CronRouter from "./Cron.routes.js";

const router = Router();

router.use("/config", ConfigRouter);
router.use("/db", DatabaseRouter);
router.use("/users", UsersRouter);
router.use("/alarms", AlarmsRouter);
router.use("/kpi", KPIRouter);
router.use("/cron", CronRouter);

export default router;
