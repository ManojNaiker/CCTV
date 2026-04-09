import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { db, devicesTable, auditLogsTable } from "@workspace/db";
import {
  ListDevicesQueryParams,
  CreateDeviceBody,
  BulkCreateDevicesBody,
  GetDeviceParams,
  UpdateDeviceParams,
  UpdateDeviceBody,
  DeleteDeviceParams,
} from "@workspace/api-zod";
import { fetchAllDevicesWithRetry, mapHikStatus } from "../../lib/hikconnect";
import { logger } from "../../lib/logger";

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
    logger.info("Starting Hik-Connect device status refresh...");

    // Fetch all devices from Hik-Connect API
    const hikDeviceMap = await fetchAllDevicesWithRetry();
    logger.info({ count: hikDeviceMap.size }, "Fetched devices from Hik-Connect");

    // Load all devices from our DB
    const allDevices = await db.select().from(devicesTable);

    const now = new Date();
    let updatedCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let unknownCount = 0;

    // Returns the IST calendar date string (YYYY-MM-DD) for reliable same-day comparison
    function toISTDateStr(d: Date): string {
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    }

    function isSameDayIST(a: Date, b: Date): boolean {
      return toISTDateStr(a) === toISTDateStr(b);
    }

    // Auto-remark patterns we generated — these can be safely overwritten
    function isAutoRemark(remark: string | null | undefined): boolean {
      if (!remark || remark.trim() === "" || remark === "-") return true;
      return remark.startsWith("CCTV has been offline");
    }

    for (const device of allDevices) {
      const hikDevice = hikDeviceMap.get(device.serialNumber);
      const newStatus = hikDevice ? mapHikStatus(hikDevice.status) : "unknown";

      let newOfflineDays = device.offlineDays ?? 0;
      let newRemark = device.remark;

      if (newStatus === "offline") {
        // Only increment offlineDays once per calendar day (IST).
        const alreadyCountedToday =
          device.status === "offline" &&
          device.updatedAt != null &&
          isSameDayIST(new Date(device.updatedAt), now);

        if (!alreadyCountedToday) {
          newOfflineDays = (device.offlineDays ?? 0) + 1;
        }

        // Auto-remark: update if empty OR if it was previously auto-generated.
        // Manual remarks (set by a user) are preserved as-is.
        if (isAutoRemark(newRemark)) {
          if (newOfflineDays === 1) {
            newRemark = "CCTV has been offline since today.";
          } else {
            newRemark = `CCTV has been offline from last ${newOfflineDays} day${newOfflineDays !== 1 ? "s" : ""}.`;
          }
        }
        offlineCount++;
      } else if (newStatus === "online") {
        // Clear offline tracking when device comes back online
        newOfflineDays = 0;
        if (isAutoRemark(newRemark)) newRemark = null; // Clear auto-remarks; preserve manual ones
        onlineCount++;
      } else {
        unknownCount++;
      }

      // Update if status, offlineDays, OR remark changed
      const remarkChanged = newRemark !== device.remark;
      if (newStatus !== device.status || newOfflineDays !== device.offlineDays || remarkChanged) {
        await db.update(devicesTable)
          .set({
            status: newStatus,
            offlineDays: newOfflineDays,
            remark: newRemark,
            updatedAt: now,
          })
          .where(eq(devicesTable.id, device.id));
        updatedCount++;
      }
    }

    const totalDevices = allDevices.length;
    const description = `Hik-Connect refresh: ${totalDevices} devices checked. Online: ${onlineCount}, Offline: ${offlineCount}, Unknown: ${unknownCount}`;
    await logAction("REFRESH", "device", "all", description);

    logger.info({ updatedCount, onlineCount, offlineCount, unknownCount }, "Refresh complete");

    res.json({
      message: "Device status refreshed from Hik-Connect",
      updatedAt: now.toISOString(),
      devicesChecked: totalDevices,
      devicesUpdated: updatedCount,
      hikDevicesFetched: hikDeviceMap.size,
      stats: { online: onlineCount, offline: offlineCount, unknown: unknownCount },
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

  const lastDevice = await db.select({ updatedAt: devicesTable.updatedAt }).from(devicesTable).orderBy(desc(devicesTable.updatedAt)).limit(1);

  res.json({
    total,
    online: stats.online ?? 0,
    offline: stats.offline ?? 0,
    unknown: stats.unknown ?? 0,
    lastRefreshedAt: lastDevice[0]?.updatedAt?.toISOString() ?? null,
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
