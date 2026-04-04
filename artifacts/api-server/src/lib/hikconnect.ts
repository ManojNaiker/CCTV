import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const DEFAULT_BASE_URL = "https://www.hik-connect.com";
const LOGIN_PATH = "/v3/users/login/v6";
const DEVICE_LIST_PATH = "/v3/hcweb/devices/list";

const CUSTOMNO = "1000002";
const FEATURECODE = "f0778a92eb09c76139747987a4b83cf8";
const CLIENTTYPE = "48";
const CLIENTSOURCE = "0";
const PAGE_SIZE = 300;

/**
 * Hik-Connect RSA public key used by their web portal for password encryption.
 * Encrypt with PKCS#1 v1.5 padding, then base64-encode.
 */
const HIK_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQHBfmtH6+0STQE3nGABJT4Ifo
rZjxJAzSLRZcQ7OHjlMrVhM7A1P0dImcOkKLJt8+lSe0mNf4mQi4wZ6zZkmC/3
T4Nwl9j6mCLLQfRV2x4A1rQkJCCQf5Bq4s7j7vVZ8yVMsGX0Z3Y/1Z4pqoqk5
nD7L1C+sW+sVq3yz6MQIDAQAB
-----END PUBLIC KEY-----`;

export interface HikCredentials {
  account: string;
  password: string;
  passwordType: "normal" | "encrypted";
}

export interface HikDevice {
  subSerial: string;
  status: number; // 1 = Online, 2 = Offline, else = unknown
  deviceName?: string;
}

// In-memory session cache keyed by account
const sessionCache = new Map<string, { sessionId: string; domain: string; createdAt: number }>();
const SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutes

/**
 * Load Hik-Connect credentials from DB settings.
 * Falls back to environment variables.
 */
export async function loadCredentialsFromDb(): Promise<HikCredentials> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.value) map[r.key] = r.value;
    }

    const account = map.hik_account || process.env.HIK_ACCOUNT || "";
    const password = map.hik_password || process.env.HIK_PASSWORD || "";
    const passwordType = (map.hik_password_type as "normal" | "encrypted") || "encrypted";

    return { account, password, passwordType };
  } catch {
    return {
      account: process.env.HIK_ACCOUNT || "",
      password: process.env.HIK_PASSWORD || "",
      passwordType: "encrypted",
    };
  }
}

/**
 * Save the resolved API domain to DB for future use.
 */
async function saveResolvedDomain(domain: string): Promise<void> {
  try {
    await db
      .insert(settingsTable)
      .values({ key: "hik_api_domain", value: domain })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: domain } });
  } catch {
    // Non-fatal
  }
}

/**
 * RSA encrypt a plain text password using Hik-Connect's public key.
 * Uses PKCS#1 v1.5 padding (publicEncrypt default).
 */
function rsaEncryptPassword(plainPassword: string): string {
  try {
    const encrypted = crypto.publicEncrypt(
      {
        key: HIK_RSA_PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(plainPassword, "utf8")
    );
    return encrypted.toString("base64");
  } catch {
    // If RSA encryption fails (key mismatch), return as-is
    logger.warn("RSA encryption failed, sending password as-is");
    return plainPassword;
  }
}

function buildLoginHeaders(): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/x-www-form-urlencoded",
    appid: "Hik-Connect-Portal",
    clientsource: CLIENTSOURCE,
    clienttype: CLIENTTYPE,
    customno: CUSTOMNO,
    featurecode: FEATURECODE,
    "user-agent": "Mozilla/5.0",
  };
}

function buildLoginBody(account: string, encryptedPassword: string): string {
  return new URLSearchParams({
    checkSign: "false",
    cuName: "d2Vi",
    account,
    password: encryptedPassword,
    imageCode: "",
  }).toString();
}

/**
 * Login to Hik-Connect and return session ID.
 * Handles code 1100 = region redirect to India domain.
 */
export async function loginGetSession(
  creds: HikCredentials,
  options?: { forceNew?: boolean }
): Promise<string> {
  const cacheKey = creds.account;
  const cached = sessionCache.get(cacheKey);
  const isExpired = !cached || Date.now() - cached.createdAt > SESSION_TTL_MS;

  if (!options?.forceNew && cached && !isExpired) {
    return cached.sessionId;
  }

  // Determine the password to send
  const passwordToSend =
    creds.passwordType === "normal"
      ? rsaEncryptPassword(creds.password)
      : creds.password;

  // Try to load previously resolved domain
  let resolvedDomain = cached?.domain || "";
  if (!resolvedDomain) {
    try {
      const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "hik_api_domain"));
      resolvedDomain = rows[0]?.value || "";
    } catch {
      resolvedDomain = "";
    }
  }

  const baseUrl = resolvedDomain ? `https://${resolvedDomain}` : DEFAULT_BASE_URL;
  const loginUrl = `${baseUrl}${LOGIN_PATH}`;

  logger.info({ loginUrl, account: creds.account, passwordType: creds.passwordType }, "Logging into Hik-Connect");

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: buildLoginHeaders(),
    body: buildLoginBody(creds.account, passwordToSend),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Hik-Connect login failed: HTTP ${response.status}`);
  }

  const j = (await response.json()) as Record<string, unknown>;
  logger.info({ loginResponse: j }, "Hik-Connect login raw response");

  const meta = j.meta as { code?: number; message?: string } | undefined;
  const code = meta?.code;

  // Handle code 1100: region redirect to India domain
  if (code === 1100) {
    const loginArea = j.loginArea as { apiDomain?: string } | undefined;
    const apiDomain = loginArea?.apiDomain;
    if (apiDomain) {
      logger.info({ apiDomain }, "Redirecting to regional Hik-Connect domain");
      await saveResolvedDomain(apiDomain);

      // Retry with India domain
      return loginWithUrl(
        `https://${apiDomain}${LOGIN_PATH}`,
        creds.account,
        passwordToSend,
        apiDomain
      );
    }
    throw new Error(`Hik-Connect redirect (1100) but no apiDomain in response`);
  }

  return extractAndCacheSession(j, creds.account, resolvedDomain || "www.hik-connect.com");
}

async function loginWithUrl(
  loginUrl: string,
  account: string,
  passwordToSend: string,
  domain: string
): Promise<string> {
  logger.info({ loginUrl }, "Retrying Hik-Connect login with regional domain");

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: buildLoginHeaders(),
    body: buildLoginBody(account, passwordToSend),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Hik-Connect regional login failed: HTTP ${response.status}`);
  }

  const j = (await response.json()) as Record<string, unknown>;
  logger.info({ loginResponse: j }, "Hik-Connect regional login response");

  return extractAndCacheSession(j, account, domain);
}

function extractAndCacheSession(j: Record<string, unknown>, account: string, domain: string): string {
  const sessionId =
    (j.loginSession as Record<string, string> | undefined)?.sessionId ||
    (j.data as Record<string, string> | undefined)?.token ||
    (j.sessionid as string | undefined);

  if (!sessionId) {
    const meta = j.meta as { code?: number; message?: string } | undefined;
    const keys = Object.keys(j).join(", ");
    throw new Error(
      `Session ID not found. Code: ${meta?.code}, Message: ${meta?.message}, Keys: ${keys}`
    );
  }

  logger.info("Hik-Connect login successful");
  sessionCache.set(account, { sessionId, domain, createdAt: Date.now() });
  return sessionId;
}

async function fetchDevicePage(
  sessionId: string,
  domain: string,
  offset: number,
  limit: number
): Promise<HikDevice[]> {
  const baseUrl = domain ? `https://${domain}` : DEFAULT_BASE_URL;
  const url = `${baseUrl}${DEVICE_LIST_PATH}?limit=${limit}&offset=${offset}`;

  const headers: Record<string, string> = {
    accept: "application/json, text/plain, */*",
    clientsource: CLIENTSOURCE,
    clienttype: CLIENTTYPE,
    customno: CUSTOMNO,
    featurecode: FEATURECODE,
    sessionid: sessionId,
    "user-agent": "Mozilla/5.0",
    referer: `${baseUrl}/views/main/index.html`,
  };

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

  if (response.status === 401) throw new Error("401 - session expired");
  if (!response.ok) throw new Error(`Fetch device list failed: HTTP ${response.status}`);

  const j = (await response.json()) as { data?: { data?: HikDevice[] } };
  return j?.data?.data || [];
}

export async function fetchAllDevices(sessionId: string, domain: string): Promise<Map<string, HikDevice>> {
  const allDevices = new Map<string, HikDevice>();
  let offset = 0;

  while (true) {
    const devices = await fetchDevicePage(sessionId, domain, offset, PAGE_SIZE);
    if (!devices.length) break;

    for (const dev of devices) {
      if (dev.subSerial) allDevices.set(dev.subSerial, dev);
    }

    offset += PAGE_SIZE;
    if (devices.length < PAGE_SIZE) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  return allDevices;
}

/**
 * Full refresh: load credentials from DB, login, fetch all devices.
 */
export async function fetchAllDevicesWithRetry(): Promise<Map<string, HikDevice>> {
  const creds = await loadCredentialsFromDb();

  if (!creds.account || !creds.password) {
    throw new Error(
      "Hik-Connect credentials not configured. Please set them in Settings → Hik-Connect."
    );
  }

  const sessionId = await loginGetSession(creds);
  const cached = sessionCache.get(creds.account);
  const domain = cached?.domain || "www.hik-connect.com";

  try {
    return await fetchAllDevices(sessionId, domain);
  } catch (err) {
    const msg = String((err as Error).message);
    if (msg.includes("401") || msg.includes("session expired")) {
      logger.warn("Session expired, re-logging in...");
      const newSessionId = await loginGetSession(creds, { forceNew: true });
      const newCached = sessionCache.get(creds.account);
      return await fetchAllDevices(newSessionId, newCached?.domain || domain);
    }
    throw err;
  }
}

/**
 * Map Hik-Connect status number to our string status.
 * Python code: status==1 => Online, status==2 => Offline, else => unknown
 */
export function mapHikStatus(hikStatus: number | undefined): "online" | "offline" | "unknown" {
  if (hikStatus === 1) return "online";
  if (hikStatus === 2) return "offline";
  return "unknown";
}
