import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/audit-logs", async (req, res): Promise<void> => {
  const parsed = ListAuditLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, action, limit = 50, offset = 0 } = parsed.data;

  const conditions = [];

  if (userId != null) {
    conditions.push(eq(auditLogsTable.userId, userId));
  }

  if (action) {
    conditions.push(eq(auditLogsTable.action, action));
  }

  let query = db.select().from(auditLogsTable).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(auditLogsTable).$dynamic();

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
    countQuery = countQuery.where(and(...conditions));
  }

  const [countResult, items] = await Promise.all([
    countQuery,
    query.orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset),
  ]);

  res.json({
    items: items.map(log => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(countResult[0]?.count ?? 0),
    limit,
    offset,
  });
});

router.get("/audit-logs/recent", async (req, res): Promise<void> => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(20);
  res.json(logs.map(log => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  })));
});

export default router;
