import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import usersRouter from "./users";
import auditLogsRouter from "./audit-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devicesRouter);
router.use(usersRouter);
router.use(auditLogsRouter);

export default router;
