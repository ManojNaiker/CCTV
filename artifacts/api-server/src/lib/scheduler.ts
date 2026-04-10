import cron from "node-cron";
import { db, devicesTable, settingsTable } from "@workspace/db";
import { sendBulkOfflineAlert } from "./emailService";
import { runDeviceRefresh } from "./refreshDevices";
import { logger } from "./logger";

async function getSchedulerSettings(): Promise<{ enabled: boolean; times: string[] }> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? "";

    const enabled = map["scheduler_enabled"] !== "false";
    let times: string[] = ["09:30", "17:30"];
    if (map["scheduler_times"]) {
      try { times = JSON.parse(map["scheduler_times"]) as string[]; } catch { /* use default */ }
    }
    return { enabled, times };
  } catch {
    return { enabled: true, times: ["09:30", "17:30"] };
  }
}

async function sendScheduledOfflineAlert(label: string): Promise<void> {
  logger.info(`Scheduled email job triggered: ${label}`);
  try {
    const rows = await db.select().from(devicesTable);
    const offlineDevices = rows.filter((d) => d.status === "offline");

    if (offlineDevices.length === 0) {
      logger.info(`${label}: No offline devices — skipping email`);
      return;
    }

    await sendBulkOfflineAlert(
      offlineDevices.map((d) => ({
        branchName: d.branchName,
        serialNumber: d.serialNumber,
        stateName: d.stateName,
        offlineDays: d.offlineDays ?? 1,
        remark: d.remark,
        email: d.email,
        ccEmails: d.ccEmails,
      }))
    );

    logger.info(`${label}: Scheduled email sent for ${offlineDevices.length} offline device(s)`);
  } catch (err) {
    logger.error({ err }, `${label}: Scheduled email job failed`);
  }
}

async function autoRefreshDevices(): Promise<void> {
  try {
    logger.info("Auto-refresh: pulling latest device statuses from Hik-Connect...");
    const result = await runDeviceRefresh();
    logger.info(result, "Auto-refresh complete");
  } catch (err) {
    logger.error({ err }, "Auto-refresh failed");
  }
}

export function startScheduler(): void {
  // Auto-refresh device statuses every 1 minute
  cron.schedule("* * * * *", () => {
    autoRefreshDevices();
  });

  // Run every minute and check if current IST time matches a configured email schedule
  cron.schedule("* * * * *", async () => {
    const { enabled, times } = await getSchedulerSettings();
    if (!enabled || times.length === 0) return;

    const now = new Date();
    const istTime = now.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(/\s/g, "");

    if (times.includes(istTime)) {
      await sendScheduledOfflineAlert(`Scheduled (${istTime} IST)`);
    }
  });

  // Also run one refresh immediately on startup so the dashboard is fresh right away
  setTimeout(() => autoRefreshDevices(), 5000);

  logger.info("Scheduler started — device auto-refresh every 15 min, email alerts at configured IST times");
}
