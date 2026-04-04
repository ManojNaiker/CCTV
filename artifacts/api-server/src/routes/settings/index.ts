import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { loginGetSession, type HikCredentials } from "../../lib/hikconnect";
import { logger } from "../../lib/logger";

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

export default router;
