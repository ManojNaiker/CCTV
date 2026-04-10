import { Router, type IRouter } from "express";
import { db, settingsTable, devicesTable, auditLogsTable } from "@workspace/db";
import { loginGetSession, type HikCredentials } from "../../lib/hikconnect";
import { logger } from "../../lib/logger";
import { getEmailSettings, createTransporter, sendOfflineAlert, sendBulkOfflineAlert } from "../../lib/emailService";
import { eq } from "drizzle-orm";

async function logAction(action: string, entityType: string, entityId: string, description: string) {
  try {
    await db.insert(auditLogsTable).values({ action, entityType, entityId, description, username: "system" });
  } catch {
    // Non-fatal
  }
}

const router: IRouter = Router();

// GET all settings (masks password)
router.get("/settings", async (req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const result: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.key === "hik_password") {
      result[row.key] = row.value ? "masked" : "";
    } else {
      result[row.key] = row.value ?? "";
    }
  }
  res.json(result);
});

// POST save Hik-Connect settings
router.post("/settings/hikconnect", async (req, res): Promise<void> => {
  const { account, password, passwordType } = req.body as {
    account?: string;
    password?: string;
    passwordType?: "normal" | "encrypted";
  };

  if (!account || !password || !passwordType) {
    res.status(400).json({ error: "account, password, and passwordType are required" });
    return;
  }

  if (!["normal", "encrypted"].includes(passwordType)) {
    res.status(400).json({ error: "passwordType must be 'normal' or 'encrypted'" });
    return;
  }

  try {
    const upsert = async (key: string, value: string) => {
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    };

    await upsert("hik_account", account);
    await upsert("hik_password", password);
    await upsert("hik_password_type", passwordType);
    await upsert("hik_api_domain", ""); // Clear cached domain on credential change

    logger.info({ account, passwordType }, "Hik-Connect settings saved");

    res.json({ message: "Hik-Connect settings saved successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to save Hik-Connect settings");
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// POST test Hik-Connect connection (without saving)
router.post("/settings/hikconnect/test", async (req, res): Promise<void> => {
  const { account, password, passwordType } = req.body as {
    account?: string;
    password?: string;
    passwordType?: "normal" | "encrypted";
  };

  if (!account || !password || !passwordType) {
    res.status(400).json({ error: "account, password, and passwordType are required" });
    return;
  }

  if (!["normal", "encrypted"].includes(passwordType)) {
    res.status(400).json({ error: "passwordType must be 'normal' or 'encrypted'" });
    return;
  }

  try {
    const creds: HikCredentials = {
      account,
      password,
      passwordType: passwordType as "normal" | "encrypted",
    };

    const sessionId = await loginGetSession(creds, { forceNew: true });

    logger.info({ account }, "Hik-Connect test connection successful");
    res.json({
      success: true,
      message: "Connection successful! Hik-Connect credentials are valid.",
      sessionPreview: sessionId.substring(0, 8) + "...",
    });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "Hik-Connect test connection failed");
    res.status(400).json({
      success: false,
      message: `Connection failed: ${msg}`,
    });
  }
});

// GET email settings (masks password)
router.get("/settings/email", async (_req, res): Promise<void> => {
  try {
    const settings = await getEmailSettings();
    res.json({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      password: settings.password ? "masked" : "",
      from: settings.from,
      to: settings.to,
      enabled: settings.enabled,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get email settings");
    res.status(500).json({ error: "Failed to get email settings" });
  }
});

// POST save email settings
router.post("/settings/email", async (req, res): Promise<void> => {
  const { host, port, secure, user, password, from, to, enabled } = req.body as {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    from?: string;
    to?: string;
    enabled?: boolean;
  };

  if (!host || !user || !password) {
    res.status(400).json({ error: "host, user, and password are required" });
    return;
  }

  try {
    const upsert = async (key: string, value: string) => {
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    };

    await upsert("email_host", host);
    await upsert("email_port", String(port ?? 587));
    await upsert("email_secure", String(secure ?? false));
    await upsert("email_user", user);
    await upsert("email_password", password);
    await upsert("email_from", from ?? user);
    await upsert("email_to", to);
    await upsert("email_enabled", String(enabled !== false));

    logger.info({ host, user, to }, "Email settings saved");
    res.json({ message: "Email settings saved successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to save email settings");
    res.status(500).json({ error: "Failed to save email settings" });
  }
});

// POST test email connection
router.post("/settings/email/test", async (req, res): Promise<void> => {
  const { host, port, secure, user, password, from, to } = req.body as {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    from?: string;
    to?: string;
  };

  if (!host || !user || !password || !to) {
    res.status(400).json({ success: false, message: "host, user, password, and to are required" });
    return;
  }

  try {
    const transporter = createTransporter({
      host, port: port ?? 587, secure: secure ?? false,
      user, password, from: from ?? user, to, enabled: true,
    });

    await transporter.verify();

    await transporter.sendMail({
      from: from ?? user,
      to,
      subject: "CCTV Portal — Email Test Successful",
      html: `<p>Your email configuration is working correctly for <strong>Light Finance CCTV Monitoring Portal</strong>.</p>`,
      text: "Your email configuration is working correctly.",
    });

    logger.info({ host, user, to }, "Email test successful");
    res.json({ success: true, message: "Test email sent successfully! Check your inbox." });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "Email test failed");
    res.status(400).json({ success: false, message: `Email test failed: ${msg}` });
  }
});

// GET CC list
router.get("/settings/cc-list", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "email_cc_list"));
    const ccList = rows[0]?.value ?? "";
    const emails = ccList
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    res.json({ emails, raw: ccList });
  } catch (err) {
    logger.error({ err }, "Failed to get CC list");
    res.status(500).json({ error: "Failed to get CC list" });
  }
});

// POST save CC list
router.post("/settings/cc-list", async (req, res): Promise<void> => {
  const { emails } = req.body as { emails?: string[] };

  if (!Array.isArray(emails)) {
    res.status(400).json({ error: "emails array is required" });
    return;
  }

  const cleaned = emails.map((e) => e.trim()).filter(Boolean);
  const raw = cleaned.join(", ");

  try {
    await db
      .insert(settingsTable)
      .values({ key: "email_cc_list", value: raw })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: raw } });

    logger.info({ count: cleaned.length }, "CC list saved");
    res.json({ message: "CC list saved successfully", emails: cleaned });
  } catch (err) {
    logger.error({ err }, "Failed to save CC list");
    res.status(500).json({ error: "Failed to save CC list" });
  }
});

// GET scheduler settings
router.get("/settings/scheduler", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? "";

    const enabled = map["scheduler_enabled"] !== "false";
    const rawTimes = map["scheduler_times"] ?? '["09:30","17:30"]';
    let times: string[] = [];
    try { times = JSON.parse(rawTimes) as string[]; } catch { times = ["09:30", "17:30"]; }

    res.json({ enabled, times });
  } catch (err) {
    logger.error({ err }, "Failed to get scheduler settings");
    res.status(500).json({ error: "Failed to get scheduler settings" });
  }
});

// POST save scheduler settings
router.post("/settings/scheduler", async (req, res): Promise<void> => {
  const { enabled, times } = req.body as { enabled?: boolean; times?: string[] };

  if (!Array.isArray(times)) {
    res.status(400).json({ error: "times array is required" });
    return;
  }

  const validTimes = times
    .map((t) => String(t).trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t));

  try {
    const upsert = async (key: string, value: string) => {
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    };

    await upsert("scheduler_enabled", String(enabled !== false));
    await upsert("scheduler_times", JSON.stringify(validTimes));

    logger.info({ enabled, times: validTimes }, "Scheduler settings saved");
    res.json({ message: "Scheduler settings saved successfully", times: validTimes });
  } catch (err) {
    logger.error({ err }, "Failed to save scheduler settings");
    res.status(500).json({ error: "Failed to save scheduler settings" });
  }
});

// POST send offline alert email for a specific device
router.post("/devices/:id/send-alert", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid device id" });
    return;
  }

  try {
    const rows = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
    const device = rows[0];
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }

    await sendOfflineAlert({
      branchName: device.branchName,
      serialNumber: device.serialNumber,
      stateName: device.stateName,
      offlineDays: device.offlineDays ?? 1,
      remark: device.remark,
      email: device.email,
      ccEmails: device.ccEmails,
    });

    await logAction("EMAIL_SENT", "device", String(id), `Manual offline alert email sent for '${device.branchName}' (${device.serialNumber})`);
    logger.info({ id, branchName: device.branchName }, "Manual offline alert sent");
    res.json({ success: true, message: `Alert email sent for ${device.branchName}` });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err, id }, "Failed to send manual offline alert");
    res.status(500).json({ success: false, error: `Failed to send alert: ${msg}` });
  }
});

// POST send bulk offline alert email for all currently offline devices
router.post("/devices/send-bulk-alert", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(devicesTable);
    const offlineDevices = rows.filter((d) => d.status === "offline");

    if (offlineDevices.length === 0) {
      res.json({ success: true, message: "No offline devices found — nothing to send.", count: 0 });
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

    await logAction("EMAIL_SENT", "device", "bulk", `Manual bulk offline alert email sent — ${offlineDevices.length} offline device(s)`);
    logger.info({ count: offlineDevices.length }, "Bulk offline alert sent");
    res.json({ success: true, message: `Bulk alert sent for ${offlineDevices.length} offline device(s).`, count: offlineDevices.length });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "Failed to send bulk offline alert");
    res.status(500).json({ success: false, error: `Failed to send bulk alert: ${msg}` });
  }
});

export default router;
