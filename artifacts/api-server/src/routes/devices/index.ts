import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, sql, gte, lte, and } from "drizzle-orm";
import { db, devicesTable, auditLogsTable, deviceStatusHistoryTable, settingsTable } from "@workspace/db";
import {
  ListDevicesQueryParams,
  CreateDeviceBody,
  BulkCreateDevicesBody,
  GetDeviceParams,
  UpdateDeviceParams,
  UpdateDeviceBody,
  DeleteDeviceParams,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";
import { runDeviceRefresh } from "../../lib/refreshDevices";

const router: IRouter = Router();

async function logAction(action: string, entityType: string, entityId: string, description: string) {
  try {
    await db.insert(auditLogsTable).values({
      action,
      entityType,
      entityId,
      description,
      username: "system",
    });
  } catch {
    // Non-fatal
  }
}

router.get("/devices", async (req, res): Promise<void> => {
  const parsed = ListDevicesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, state, search } = parsed.data;

  let query = db.select().from(devicesTable).$dynamic();

  const conditions = [];

  if (status && status !== "all") {
    conditions.push(eq(devicesTable.status, status));
  }

  if (state) {
    conditions.push(ilike(devicesTable.stateName, `%${state}%`));
  }

  if (search) {
    conditions.push(
      or(
        ilike(devicesTable.branchName, `%${search}%`),
        ilike(devicesTable.serialNumber, `%${search}%`),
        ilike(devicesTable.stateName, `%${search}%`)
      )
    );
  }

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const devices = await query.orderBy(desc(devicesTable.updatedAt));
  res.json(devices);
});

router.post("/devices", async (req, res): Promise<void> => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [device] = await db.insert(devicesTable).values({
    serialNumber: parsed.data.serialNumber,
    branchName: parsed.data.branchName,
    stateName: parsed.data.stateName,
    remark: parsed.data.remark ?? null,
  }).returning();

  await logAction("CREATE", "device", String(device.id), `Device '${device.branchName}' (${device.serialNumber}) added`);

  res.status(201).json(device);
});

router.post("/devices/bulk", async (req, res): Promise<void> => {
  const parsed = BulkCreateDevicesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { devices } = parsed.data;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const deviceData of devices) {
    try {
      const [device] = await db.insert(devicesTable).values({
        serialNumber: deviceData.serialNumber.trim(),
        branchName: deviceData.branchName.trim(),
        stateName: deviceData.stateName.trim(),
        remark: deviceData.remark ?? null,
        email: deviceData.email ?? null,
      }).returning();

      await logAction("CREATE", "device", String(device.id), `Device '${device.branchName}' (${device.serialNumber}) added via bulk import`);
      created++;
    } catch (err: any) {
      if (err?.code === "23505") {
        skipped++;
      } else {
        errors.push(`${deviceData.serialNumber}: ${err?.message ?? "Unknown error"}`);
      }
    }
  }

  res.status(201).json({ created, skipped, errors });
});

router.post("/devices/refresh", async (req, res): Promise<void> => {
  try {
    const result = await runDeviceRefresh();
    res.json({
      message: "Device status refreshed from Hik-Connect",
      ...result,
    });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "Hik-Connect refresh failed");
    await logAction("REFRESH_ERROR", "device", "all", `Hik-Connect refresh failed: ${msg}`);
    res.status(502).json({ error: `Hik-Connect API error: ${msg}` });
  }
});

router.get("/devices/stats/summary", async (req, res): Promise<void> => {
  const rows = await db.select({
    status: devicesTable.status,
    count: sql<number>`count(*)`,
  }).from(devicesTable).groupBy(devicesTable.status);

  const stats: Record<string, number> = { online: 0, offline: 0, unknown: 0 };
  let total = 0;

  for (const row of rows) {
    const count = Number(row.count);
    stats[row.status] = count;
    total += count;
  }

  const lastRefreshSetting = await db.select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "last_refresh_at"))
    .limit(1);

  res.json({
    total,
    online: stats.online ?? 0,
    offline: stats.offline ?? 0,
    unknown: stats.unknown ?? 0,
    lastRefreshedAt: lastRefreshSetting[0]?.value ?? null,
  });
});

router.get("/devices/offline-streak", async (req, res): Promise<void> => {
  const offlineDevices = await db.select().from(devicesTable)
    .where(eq(devicesTable.status, "offline"))
    .orderBy(desc(devicesTable.offlineDays));

  res.json(offlineDevices.map(d => ({
    id: d.id,
    serialNumber: d.serialNumber,
    branchName: d.branchName,
    stateName: d.stateName,
    offlineDays: d.offlineDays ?? 0,
    remark: d.remark,
  })));
});

router.get("/devices/status-timeline", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    res.status(400).json({ error: "from and to query params are required (YYYY-MM-DD)" });
    return;
  }

  const fromDate = new Date(`${from}T00:00:00+05:30`);
  const toDate = new Date(`${to}T23:59:59+05:30`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  const records = await db.select().from(deviceStatusHistoryTable)
    .where(and(
      gte(deviceStatusHistoryTable.recordedAt, fromDate),
      lte(deviceStatusHistoryTable.recordedAt, toDate)
    ))
    .orderBy(deviceStatusHistoryTable.recordedAt);

  // Group by device+date, accumulate events with minuteOfDay
  const groupMap = new Map<string, {
    deviceId: number;
    serialNumber: string;
    branchName: string;
    stateName: string;
    date: string;
    events: { minuteOfDay: number; status: string }[];
  }>();

  for (const r of records) {
    const dateIST = r.recordedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const key = `${r.serialNumber}::${dateIST}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        deviceId: r.deviceId,
        serialNumber: r.serialNumber,
        branchName: r.branchName,
        stateName: r.stateName,
        date: dateIST,
        events: [],
      });
    }

    // Compute minute-of-day in IST
    const istMs = r.recordedAt.getTime() + (5.5 * 60 * 60 * 1000);
    const minuteOfDay = Math.floor((istMs % (24 * 60 * 60 * 1000)) / (60 * 1000));

    const entry = groupMap.get(key)!;
    const lastEvent = entry.events[entry.events.length - 1];
    // Only add if status changed (avoids duplicates)
    if (!lastEvent || lastEvent.status !== r.status) {
      entry.events.push({ minuteOfDay, status: r.status });
    }
  }

  res.json(Array.from(groupMap.values()));
});

router.get("/devices/status-history", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    res.status(400).json({ error: "from and to query params are required (YYYY-MM-DD)" });
    return;
  }

  const fromDate = new Date(`${from}T00:00:00+05:30`);
  const toDate = new Date(`${to}T23:59:59+05:30`);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    return;
  }

  const records = await db.select().from(deviceStatusHistoryTable)
    .where(and(
      gte(deviceStatusHistoryTable.recordedAt, fromDate),
      lte(deviceStatusHistoryTable.recordedAt, toDate)
    ))
    .orderBy(deviceStatusHistoryTable.recordedAt);

  // Aggregate: for each device+day, keep the last status recorded that day
  const dayMap = new Map<string, { deviceId: number; serialNumber: string; branchName: string; stateName: string; date: string; status: string; recordedAt: Date }>();

  for (const r of records) {
    const dateIST = r.recordedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const key = `${r.serialNumber}::${dateIST}`;
    const existing = dayMap.get(key);
    if (!existing || r.recordedAt > existing.recordedAt) {
      dayMap.set(key, {
        deviceId: r.deviceId,
        serialNumber: r.serialNumber,
        branchName: r.branchName,
        stateName: r.stateName,
        date: dateIST,
        status: r.status,
        recordedAt: r.recordedAt,
      });
    }
  }

  res.json(Array.from(dayMap.values()).map(({ recordedAt: _r, ...rest }) => rest));
});

router.get("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  res.json(device);
});

router.patch("/devices/bulk-update", async (req, res): Promise<void> => {
  const rows = req.body as Array<{
    branchName: string;
    stateName?: string;
    serialNumber?: string;
    email?: string;
    remark?: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Expected a non-empty array of device rows" });
    return;
  }

  const allDevices = await db.select({ id: devicesTable.id, branchName: devicesTable.branchName })
    .from(devicesTable);
  const nameToId = new Map(allDevices.map(d => [d.branchName.trim().toLowerCase(), d.id]));

  let updated = 0;
  const notFound: string[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.branchName?.trim()) continue;
    const id = nameToId.get(row.branchName.trim().toLowerCase());
    if (!id) {
      notFound.push(row.branchName);
      continue;
    }
    try {
      const fields: Record<string, unknown> = {};
      if (row.stateName != null && row.stateName.trim()) fields.stateName = row.stateName.trim();
      if (row.serialNumber != null && row.serialNumber.trim()) fields.serialNumber = row.serialNumber.trim();
      if (row.email != null) fields.email = row.email.trim() || null;
      if (row.remark != null) fields.remark = row.remark.trim() || null;

      if (Object.keys(fields).length === 0) continue;

      await db.update(devicesTable).set(fields).where(eq(devicesTable.id, id));
      await logAction("UPDATE", "device", String(id), `Device '${row.branchName}' bulk-updated — ${Object.keys(fields).join(", ")}`);
      updated++;
    } catch (err: any) {
      errors.push(`${row.branchName}: ${err?.message ?? "Unknown error"}`);
    }
  }

  res.json({ updated, notFound, errors });
});

router.patch("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.branchName != null) updateData.branchName = parsed.data.branchName;
  if (parsed.data.stateName != null) updateData.stateName = parsed.data.stateName;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.remark !== undefined) updateData.remark = parsed.data.remark;

  const [device] = await db.update(devicesTable).set(updateData).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  const changes = Object.entries(parsed.data).map(([k, v]) => `${k}: '${v}'`).join(", ");
  await logAction("UPDATE", "device", String(device.id), `Device '${device.branchName}' updated — ${changes}`);

  res.json(device);
});

router.patch("/devices/cc/bulk", async (req, res): Promise<void> => {
  const rows = req.body as Array<{ branchName: string; ccEmails: string | null }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Expected a non-empty array of { branchName, ccEmails }" });
    return;
  }

  const allDevices = await db.select({ id: devicesTable.id, branchName: devicesTable.branchName }).from(devicesTable);
  const nameToId = new Map(allDevices.map(d => [d.branchName.trim().toLowerCase(), d.id]));

  let updated = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    if (!row.branchName) continue;
    const id = nameToId.get(row.branchName.trim().toLowerCase());
    if (!id) {
      notFound.push(row.branchName);
      continue;
    }
    await db.update(devicesTable)
      .set({ ccEmails: row.ccEmails || null })
      .where(eq(devicesTable.id, id));
    updated++;
  }

  await logAction("UPDATE", "device", "bulk", `Bulk CC list update — ${updated} branches updated`);
  res.json({ success: true, updated, notFound });
});

router.patch("/devices/:id/cc", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid device id" });
    return;
  }

  const { ccEmails } = req.body as { ccEmails?: string };

  const [device] = await db.update(devicesTable)
    .set({ ccEmails: ccEmails ?? null })
    .where(eq(devicesTable.id, id))
    .returning();

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  await logAction("UPDATE", "device", String(device.id), `Device '${device.branchName}' CC email list updated`);
  res.json(device);
});

router.delete("/devices/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDeviceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  await logAction("DELETE", "device", String(device.id), `Device '${device.branchName}' (${device.serialNumber}) deleted`);

  res.sendStatus(204);
});

export default router;
