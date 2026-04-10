import { db, devicesTable, deviceStatusHistoryTable, settingsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fetchAllDevicesWithRetry, mapHikStatus } from "./hikconnect";
import { sendOfflineAlert } from "./emailService";
import { logger } from "./logger";

function toISTDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function isSameDayIST(a: Date, b: Date): boolean {
  return toISTDateStr(a) === toISTDateStr(b);
}

function isAutoRemark(remark: string | null | undefined): boolean {
  if (!remark || remark.trim() === "" || remark === "-") return true;
  return remark.startsWith("CCTV has been offline");
}

export interface RefreshResult {
  devicesChecked: number;
  devicesUpdated: number;
  hikDevicesFetched: number;
  updatedAt: string;
  stats: { online: number; offline: number; unknown: number };
}

export async function runDeviceRefresh(): Promise<RefreshResult> {
  logger.info("Starting Hik-Connect device status refresh...");

  const hikDeviceMap = await fetchAllDevicesWithRetry();
  logger.info({ count: hikDeviceMap.size }, "Fetched devices from Hik-Connect");

  const allDevices = await db.select().from(devicesTable);
  const now = new Date();

  let updatedCount = 0;
  let onlineCount = 0;
  let offlineCount = 0;
  let unknownCount = 0;

  for (const device of allDevices) {
    const hikDevice = hikDeviceMap.get(device.serialNumber);
    const newStatus = hikDevice ? mapHikStatus(hikDevice.status) : "unknown";

    let newOfflineDays = device.offlineDays ?? 0;
    let newRemark = device.remark;

    if (newStatus === "offline") {
      const alreadyCountedToday =
        device.status === "offline" &&
        device.updatedAt != null &&
        isSameDayIST(new Date(device.updatedAt), now);

      if (!alreadyCountedToday) {
        newOfflineDays = (device.offlineDays ?? 0) + 1;
      }

      if (isAutoRemark(newRemark)) {
        if (newOfflineDays === 1) {
          newRemark = "CCTV has been offline since today.";
        } else {
          newRemark = `CCTV has been offline from last ${newOfflineDays} day${newOfflineDays !== 1 ? "s" : ""}.`;
        }
      }

      const justWentOffline = device.status !== "offline";
      if (justWentOffline) {
        sendOfflineAlert({
          branchName: device.branchName,
          serialNumber: device.serialNumber,
          stateName: device.stateName,
          offlineDays: newOfflineDays,
          email: device.email,
          ccEmails: device.ccEmails,
        }).catch((err) => logger.warn({ err, serial: device.serialNumber }, "Failed to send offline alert email"));
      }

      offlineCount++;
    } else if (newStatus === "online") {
      newOfflineDays = 0;
      if (isAutoRemark(newRemark)) newRemark = null;
      onlineCount++;
    } else {
      unknownCount++;
    }

    const remarkChanged = newRemark !== device.remark;
    if (newStatus !== device.status || newOfflineDays !== device.offlineDays || remarkChanged) {
      await db.update(devicesTable)
        .set({ status: newStatus, offlineDays: newOfflineDays, remark: newRemark, updatedAt: now })
        .where(eq(devicesTable.id, device.id));
      updatedCount++;
    }

    await db.insert(deviceStatusHistoryTable).values({
      deviceId: device.id,
      serialNumber: device.serialNumber,
      branchName: device.branchName,
      stateName: device.stateName,
      status: newStatus,
      recordedAt: now,
    });
  }

  const totalDevices = allDevices.length;
  const description = `Hik-Connect refresh: ${totalDevices} devices checked. Online: ${onlineCount}, Offline: ${offlineCount}, Unknown: ${unknownCount}`;
  await db.insert(auditLogsTable).values({
    action: "REFRESH",
    entityType: "device",
    entityId: "all",
    description,
    username: "system",
  }).catch(() => {});

  await db.insert(settingsTable)
    .values({ key: "last_refresh_at", value: now.toISOString() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: now.toISOString() } });

  logger.info({ updatedCount, onlineCount, offlineCount, unknownCount }, "Refresh complete");

  return {
    devicesChecked: totalDevices,
    devicesUpdated: updatedCount,
    hikDevicesFetched: hikDeviceMap.size,
    updatedAt: now.toISOString(),
    stats: { online: onlineCount, offline: offlineCount, unknown: unknownCount },
  };
}
