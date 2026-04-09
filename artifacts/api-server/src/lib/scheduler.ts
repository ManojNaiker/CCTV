import cron from "node-cron";
import { db, devicesTable } from "@workspace/db";
import { sendBulkOfflineAlert } from "./emailService";
import { logger } from "./logger";

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

export function startScheduler(): void {
  // 9:30 AM IST = 04:00 UTC
  cron.schedule("0 4 * * *", () => {
    void sendScheduledOfflineAlert("Morning 9:30 AM IST");
  });

  // 5:30 PM IST = 12:00 UTC
  cron.schedule("0 12 * * *", () => {
    void sendScheduledOfflineAlert("Evening 5:30 PM IST");
  });

  logger.info("Scheduler started — emails scheduled at 9:30 AM and 5:30 PM IST daily");
}
