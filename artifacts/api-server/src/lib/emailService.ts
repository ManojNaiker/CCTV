import nodemailer from "nodemailer";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface EmailSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
  enabled: boolean;
}

async function getSetting(key: string): Promise<string> {
  const row = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row[0]?.value ?? "";
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const [host, portStr, user, password, from, to, enabledStr, secureStr] = await Promise.all([
    getSetting("email_host"),
    getSetting("email_port"),
    getSetting("email_user"),
    getSetting("email_password"),
    getSetting("email_from"),
    getSetting("email_to"),
    getSetting("email_enabled"),
    getSetting("email_secure"),
  ]);

  return {
    host,
    port: parseInt(portStr || "587", 10),
    secure: secureStr === "true",
    user,
    password,
    from: from || user,
    to,
    enabled: enabledStr !== "false",
  };
}

export function createTransporter(settings: EmailSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendEmail(subject: string, html: string, text?: string, extraTo?: string[]): Promise<void> {
  const settings = await getEmailSettings();

  if (!settings.enabled) {
    logger.info("Email notifications disabled — skipping send");
    return;
  }

  if (!settings.host || !settings.user || !settings.password || !settings.to) {
    logger.warn("Email settings incomplete — skipping send");
    return;
  }

  const transporter = createTransporter(settings);
  const toList = [
    ...settings.to.split(",").map((e) => e.trim()).filter(Boolean),
    ...(extraTo ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  await transporter.sendMail({
    from: settings.from || settings.user,
    to: toList.join(", "),
    subject,
    html,
    text,
  });

  logger.info({ to: toList, subject }, "Email sent successfully");
}

export async function sendUserCreatedEmail(userData: {
  name: string;
  email: string;
  role: string;
  tempPassword?: string;
}): Promise<void> {
  const subject = `New User Account Created — ${userData.name}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1e3a5f; margin: 0; font-size: 20px;">Light Finance — CCTV Portal</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">User Management Notification</p>
      </div>
      
      <h3 style="color: #111827; font-size: 16px; margin: 0 0 16px;">New User Account Created</h3>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280; width: 140px;">Name</td>
          <td style="padding: 10px 0; color: #111827; font-weight: 600;">${userData.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280;">Email</td>
          <td style="padding: 10px 0; color: #111827;">${userData.email}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280;">Role</td>
          <td style="padding: 10px 0; color: #111827;">
            <span style="background: #dbeafe; color: #1d4ed8; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${userData.role}</span>
          </td>
        </tr>
        ${userData.tempPassword ? `
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">Temporary Password</td>
          <td style="padding: 10px 0;">
            <code style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 4px; font-size: 13px; color: #111827;">${userData.tempPassword}</code>
          </td>
        </tr>` : ""}
      </table>
      
      <div style="margin-top: 24px; padding: 12px 16px; background: #fef9c3; border-left: 3px solid #eab308; border-radius: 4px; font-size: 13px; color: #713f12;">
        Please ensure the user changes their password on first login.
      </div>
      
      <div style="margin-top: 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        This is an automated notification from the Light Finance CCTV Monitoring System.
      </div>
    </div>
  `;

  await sendEmail(subject, html);
}

export async function sendOfflineAlert(device: {
  branchName: string;
  serialNumber: string;
  stateName: string;
  offlineDays: number;
  email?: string | null;
  ccEmails?: string | null;
}): Promise<void> {
  const offlineAlertsEnabled = await getSetting("email_offline_alerts");
  if (offlineAlertsEnabled === "false") {
    logger.info("Offline alert emails disabled — skipping");
    return;
  }

  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const subject = `CCTV Offline Alert — ${device.branchName} (${device.stateName})`;

  const extraRecipients: string[] = [];
  if (device.email) {
    extraRecipients.push(...device.email.split(",").map((e) => e.trim()).filter(Boolean));
  }
  if (device.ccEmails) {
    extraRecipients.push(...device.ccEmails.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1e3a5f; margin: 0; font-size: 20px;">Light Finance — CCTV Portal</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">Offline Device Alert</p>
      </div>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex-shrink: 0; width: 32px; height: 32px; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 18px; line-height: 1;">!</span>
        </div>
        <div>
          <p style="margin: 0 0 4px; color: #dc2626; font-weight: 700; font-size: 15px;">CCTV Device Offline</p>
          <p style="margin: 0; color: #7f1d1d; font-size: 13px;">
            ${device.offlineDays === 1
              ? "This device has gone offline today."
              : `This device has been offline for <strong>${device.offlineDays} days</strong>.`}
          </p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280; width: 160px;">Branch</td>
          <td style="padding: 10px 0; color: #111827; font-weight: 600;">${device.branchName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280;">State</td>
          <td style="padding: 10px 0; color: #111827;">${device.stateName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280;">Serial Number</td>
          <td style="padding: 10px 0; color: #111827; font-family: monospace; font-size: 13px;">${device.serialNumber}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 0; color: #6b7280;">Offline Since</td>
          <td style="padding: 10px 0; color: #dc2626; font-weight: 600;">${device.offlineDays} day${device.offlineDays !== 1 ? "s" : ""}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">Detected At</td>
          <td style="padding: 10px 0; color: #111827;">${now} IST</td>
        </tr>
      </table>

      <div style="margin-top: 24px; padding: 12px 16px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #78350f;">
        Please check the device at the branch and ensure connectivity is restored. Log in to the CCTV Portal for more details.
      </div>

      <div style="margin-top: 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        This is an automated offline alert from the Light Finance CCTV Monitoring System.
      </div>
    </div>
  `;

  await sendEmail(subject, html, undefined, extraRecipients);
}
