import nodemailer from "nodemailer";
import { db, settingsTable, devicesTable } from "@workspace/db";
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

type OfflineDevice = {
  branchName: string;
  serialNumber: string;
  stateName: string;
  offlineDays: number;
  remark?: string | null;
  email?: string | null;
  ccEmails?: string | null;
};

function buildOfflineAlertHtml(devices: OfflineDevice[]): string {
  const now = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasLongOffline = devices.some((d) => d.offlineDays >= 3);

  const tableRows = devices
    .map(
      (d, i) => {
        const remark = d.remark
          ? d.remark
          : d.offlineDays >= 3
          ? `Has been offline for ${d.offlineDays} days.`
          : "";
        return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 1 ? "background:#f8fafc;" : "background:#ffffff;"}">
          <td style="padding: 10px 14px; text-align: center; color: #64748b; font-size: 13px; font-weight: 500;">${i + 1}</td>
          <td style="padding: 10px 14px; color: #334155; font-size: 13px; font-weight: 400;">${d.stateName}</td>
          <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 600;">${d.branchName}</td>
          <td style="padding: 10px 14px; text-align: center;">
            <span style="display:inline-block; background:#fef2f2; color:#b91c1c; padding:3px 12px; border-radius:4px; font-size:12px; font-weight:600; letter-spacing:0.3px; border: 1px solid #fecaca;">Offline</span>
          </td>
          <td style="padding: 10px 14px; color: #64748b; font-size: 13px; font-style: ${remark ? "normal" : "italic"};">${remark || "—"}</td>
        </tr>`;
      }
    )
    .join("");

  return `
<div style="font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 0; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); padding: 22px 32px;">
    <h2 style="color: #ffffff; margin: 0; font-size: 19px; font-weight: 700; letter-spacing: 0.2px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Light Finance &mdash; CCTV Monitoring</h2>
    <p style="color: #bfdbfe; margin: 5px 0 0; font-size: 12px; letter-spacing: 0.3px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Offline Device Alert &nbsp;&bull;&nbsp; Generated: ${now} IST</p>
  </div>

  <!-- Body -->
  <div style="padding: 28px 32px; background: #ffffff;">

    <!-- Branch Team message -->
    <div style="margin-bottom: 18px; padding: 16px 20px; background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 6px;">
      <p style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0c4a6e; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Dear Branch Team,</p>
      <p style="margin: 0 0 8px; font-size: 13.5px; color: #1e3a5f; line-height: 1.7; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
        Please find below the CCTV status of your branches; please check your internet cable if any issue persists; and please contact the IT team.
      </p>
      <p style="margin: 0 0 8px; font-size: 13.5px; color: #334155; line-height: 1.7; font-family: Arial, sans-serif;">
        कृपया अपनी शाखाओं की सीसीटीवी स्थिति नीचे देखें; कृपया अपना इंटरनेट केबल जांचें; यदि समस्या बनी रहती है तो आईटी टीम से संपर्क करें।
      </p>
      <p style="margin: 0; font-size: 13.5px; color: #334155; line-height: 1.7; font-family: Arial, sans-serif;">
        કૃપા કરીને તમારી શાખાઓની સીસીટીવી સ્થિતિ નીચે શોધો; કૃપા કરીને તમારી ઇન્ટરનેટ કેબલ તપાસો; જો સમસ્યા ચાલુ રહે તો કૃપા કરીને IT ટીમનો સંપર્ક કરો.
      </p>
    </div>

    <!-- RM message -->
    <div style="margin-bottom: 18px; padding: 16px 20px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 6px;">
      <p style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #7c2d12; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Dear RM's,</p>
      <p style="margin: 0 0 8px; font-size: 13.5px; color: #1e3a5f; line-height: 1.7; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
        The CCTV cameras at the following branches are showing as offline; please coordinate with your branch BMs to resolve the issue as soon as possible.
      </p>
      <p style="margin: 0 0 8px; font-size: 13.5px; color: #334155; line-height: 1.7; font-family: Arial, sans-serif;">
        निम्नलिखित शाखाओं के सीसीटीवी कैमरे ऑफ़लाइन दिख रहे हैं; कृपया समस्या को यथाशीघ्र हल करने के लिए अपनी शाखा के बीएम के साथ समन्वय करें।
      </p>
      <p style="margin: 0; font-size: 13.5px; color: #334155; line-height: 1.7; font-family: Arial, sans-serif;">
        નીચેની શાખાઓ પરના સીસીટીવી કેમેરા ઑફલાઇન તરીકે દેખાઈ રહ્યા છે; શક્ય તેટલી વહેલી તકે સમસ્યાનો ઉકેલ લાવવા માટે કૃપા કરીને તમારી શાખા BM સાથે સંકલન કરો.
      </p>
    </div>

    ${
      hasLongOffline
        ? `<div style="margin-bottom: 22px; padding: 13px 18px; background: #fff1f2; border-left: 4px solid #e11d48; border-radius: 6px; font-size: 13px; color: #881337; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6;">
      ⚠️ &nbsp;<strong>Since the branch has been offline for more than 3 days, CBM, DM, SH &mdash; please coordinate with your branch urgently.</strong>
    </div>`
        : ""
    }

    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
      <thead>
        <tr style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);">
          <th style="padding: 11px 14px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; width: 44px;">NO</th>
          <th style="padding: 11px 14px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">State Name</th>
          <th style="padding: 11px 14px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">Branch Name</th>
          <th style="padding: 11px 14px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">CCTV Status</th>
          <th style="padding: 11px 14px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px;">Remark</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Signature -->
    <div style="margin-top: 30px; padding-top: 18px; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 2px; font-size: 13px; color: #475569; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Thanks &amp; Regards,</p>
      <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #1e3a5f; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">IT Team</p>
      <p style="margin: 3px 0 0; font-size: 11.5px; color: #94a3b8; letter-spacing: 0.2px; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">Light Finance &mdash; CCTV Monitoring System</p>
    </div>

  </div>
</div>
  `;
}

export async function sendOfflineAlert(device: {
  branchName: string;
  serialNumber: string;
  stateName: string;
  offlineDays: number;
  remark?: string | null;
  email?: string | null;
  ccEmails?: string | null;
}): Promise<void> {
  const offlineAlertsEnabled = await getSetting("email_offline_alerts");
  if (offlineAlertsEnabled === "false") {
    logger.info("Offline alert emails disabled — skipping");
    return;
  }

  const subject = `CCTV Offline Alert — ${device.branchName} (${device.stateName})`;

  const extraRecipients: string[] = [];
  if (device.email) {
    extraRecipients.push(...device.email.split(",").map((e) => e.trim()).filter(Boolean));
  }
  if (device.ccEmails) {
    extraRecipients.push(...device.ccEmails.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const globalCcList = await getSetting("email_cc_list");
  if (globalCcList) {
    extraRecipients.push(...globalCcList.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const html = buildOfflineAlertHtml([device]);
  await sendEmail(subject, html, undefined, extraRecipients);
}

export async function sendBulkOfflineAlert(devices: OfflineDevice[]): Promise<void> {
  if (devices.length === 0) return;

  const offlineAlertsEnabled = await getSetting("email_offline_alerts");
  if (offlineAlertsEnabled === "false") {
    logger.info("Offline alert emails disabled — skipping");
    return;
  }

  const count = devices.length;
  const subject = `CCTV Offline Alert — ${count} Branch${count !== 1 ? "es" : ""} Offline`;

  const extraRecipients: string[] = [];
  for (const d of devices) {
    if (d.email) extraRecipients.push(...d.email.split(",").map((e) => e.trim()).filter(Boolean));
    if (d.ccEmails) extraRecipients.push(...d.ccEmails.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const globalCcList = await getSetting("email_cc_list");
  if (globalCcList) {
    extraRecipients.push(...globalCcList.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const uniqueRecipients = extraRecipients.filter((v, i, arr) => arr.indexOf(v) === i);

  const html = buildOfflineAlertHtml(devices);
  await sendEmail(subject, html, undefined, uniqueRecipients);
}
