import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { loginGetSession, type HikCredentials } from "../../lib/hikconnect";
import { logger } from "../../lib/logger";
import { getEmailSettings, createTransporter } from "../../lib/emailService";

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

  if (!host || !user || !password || !to) {
    res.status(400).json({ error: "host, user, password, and to are required" });
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

export default router;
