import { logger } from "./logger";

const DEFAULT_BASE_URL = "https://www.hik-connect.com";
const LOGIN_PATH = "/v3/users/login/v6";
const DEVICE_LIST_PATH = "/v3/hcweb/devices/list";

const ACCOUNT = process.env.HIK_ACCOUNT || "light_rajasthan";
const PASSWORD = process.env.HIK_PASSWORD || "";

const CUSTOMNO = "1000002";
const FEATURECODE = "f0778a92eb09c76139747987a4b83cf8";
const CLIENTTYPE = "48";
const CLIENTSOURCE = "0";
const PAGE_SIZE = 300;

// After redirect, this stores the resolved India-specific domain
let resolvedApiDomain: string | null = null;
let cachedSessionId: string | null = null;
let sessionCreatedAt: number = 0;
const SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutes

export interface HikDevice {
  subSerial: string;
  status: number; // 1 = Online, 2 = Offline, else = unknown
  deviceName?: string;
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

function buildLoginBody(): string {
  return new URLSearchParams({
    checkSign: "false",
    cuName: "d2Vi",
    account: ACCOUNT,
    password: PASSWORD,
    imageCode: "",
  }).toString();
}

/**
 * Login to Hik-Connect and return session ID.
 * Handles code 1100 = region redirect to India domain (iindia.hik-connect.com).
 */
export async function loginGetSession(): Promise<string> {
  const baseUrl = resolvedApiDomain
    ? `https://${resolvedApiDomain}`
    : DEFAULT_BASE_URL;

  const loginUrl = `${baseUrl}${LOGIN_PATH}`;
  logger.info({ loginUrl }, "Logging into Hik-Connect...");

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: buildLoginHeaders(),
    body: buildLoginBody(),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Hik-Connect login failed: HTTP ${response.status}`);
  }

  const j = (await response.json()) as Record<string, unknown>;
  logger.info({ loginResponse: j }, "Hik-Connect login raw response");

  const meta = j.meta as { code?: number; message?: string } | undefined;
  const code = meta?.code;

  // Handle code 1100: region redirect
  if (code === 1100) {
    const loginArea = j.loginArea as { apiDomain?: string } | undefined;
    const apiDomain = loginArea?.apiDomain;
    if (apiDomain) {
      logger.info({ apiDomain }, "Redirecting to regional Hik-Connect domain");
      resolvedApiDomain = apiDomain;
      // Retry with the India domain
      return await loginWithDomain(`https://${apiDomain}`);
    }
    throw new Error(`Hik-Connect redirect (1100) but no apiDomain in response`);
  }

  return extractSessionId(j);
}

async function loginWithDomain(baseUrl: string): Promise<string> {
  const loginUrl = `${baseUrl}${LOGIN_PATH}`;
  logger.info({ loginUrl }, "Retrying Hik-Connect login with regional domain");

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: buildLoginHeaders(),
    body: buildLoginBody(),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Hik-Connect regional login failed: HTTP ${response.status}`);
  }

  const j = (await response.json()) as Record<string, unknown>;
  logger.info({ loginResponse: j }, "Hik-Connect regional login response");

  return extractSessionId(j);
}

function extractSessionId(j: Record<string, unknown>): string {
  const sessionId =
    (j.loginSession as Record<string, string> | undefined)?.sessionId ||
    (j.data as Record<string, string> | undefined)?.token ||
    (j.sessionid as string | undefined);

  if (!sessionId) {
    const meta = j.meta as { code?: number; message?: string } | undefined;
    const keys = Object.keys(j).join(", ");
    throw new Error(
      `Session ID not found in Hik-Connect response. Code: ${meta?.code}, Message: ${meta?.message}, Keys: ${keys}`
    );
  }

  logger.info("Hik-Connect login successful");
  cachedSessionId = sessionId;
  sessionCreatedAt = Date.now();
  return sessionId;
}

async function fetchDevicePage(sessionId: string, offset: number, limit: number): Promise<HikDevice[]> {
  const baseUrl = resolvedApiDomain ? `https://${resolvedApiDomain}` : DEFAULT_BASE_URL;
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

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 401) {
    throw new Error("401 - session expired");
  }

  if (!response.ok) {
    throw new Error(`Fetch device list failed: HTTP ${response.status}`);
  }

  const j = (await response.json()) as { data?: { data?: HikDevice[] } };
  return j?.data?.data || [];
}

export async function fetchAllDevices(sessionId: string): Promise<Map<string, HikDevice>> {
  const allDevices = new Map<string, HikDevice>();
  let offset = 0;

  while (true) {
    const devices = await fetchDevicePage(sessionId, offset, PAGE_SIZE);
    if (!devices.length) break;

    for (const dev of devices) {
      if (dev.subSerial) {
        allDevices.set(dev.subSerial, dev);
      }
    }

    offset += PAGE_SIZE;

    if (devices.length < PAGE_SIZE) break;

    await new Promise((r) => setTimeout(r, 250));
  }

  return allDevices;
}

/**
 * Get or refresh session, with caching and auto-retry on 401.
 */
export async function getSession(): Promise<string> {
  const isExpired = Date.now() - sessionCreatedAt > SESSION_TTL_MS;
  if (!cachedSessionId || isExpired) {
    cachedSessionId = await loginGetSession();
  }
  return cachedSessionId;
}

/**
 * Fetch all devices, re-login on session expiry.
 */
export async function fetchAllDevicesWithRetry(): Promise<Map<string, HikDevice>> {
  let sessionId = await getSession();

  try {
    return await fetchAllDevices(sessionId);
  } catch (err) {
    const msg = String((err as Error).message);
    if (msg.includes("401") || msg.includes("session expired")) {
      logger.warn("Session expired, re-logging in...");
      cachedSessionId = null;
      sessionId = await loginGetSession();
      return await fetchAllDevices(sessionId);
    }
    throw err;
  }
}

/**
 * Map Hik-Connect status number to our string status.
 * From Python code: status==1 => Online, status==2 => Offline, else => unknown
 */
export function mapHikStatus(hikStatus: number | undefined): "online" | "offline" | "unknown" {
  if (hikStatus === 1) return "online";
  if (hikStatus === 2) return "offline";
  return "unknown";
}
