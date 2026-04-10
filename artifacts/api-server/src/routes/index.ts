import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import usersRouter from "./users";
import auditLogsRouter from "./audit-logs";
import settingsRouter from "./settings";
import authRouter from "./auth";
import dvrStorageRouter from "./dvr-storage";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(devicesRouter);
router.use(usersRouter);
router.use(auditLogsRouter);
router.use(settingsRouter);
router.use(dvrStorageRouter);

export default router;
