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
          ? `Offline for ${d.offlineDays} days.`
          : "";
        return `
        <tr style="border-bottom: 1px solid #f3f4f6; ${i % 2 === 1 ? "background:#f9fafb;" : ""}">
          <td style="padding: 8px 12px; text-align: center; color: #6b7280; font-size: 13px;">${i + 1}</td>
          <td style="padding: 8px 12px; color: #111827; font-size: 13px;">${d.stateName}</td>
          <td style="padding: 8px 12px; color: #111827; font-size: 13px; font-weight: 600;">${d.branchName}</td>
          <td style="padding: 8px 12px; text-align: center;">
            <span style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600;">Offline</span>
          </td>
          <td style="padding: 8px 12px; color: #6b7280; font-size: 12px;">${remark}</td>
        </tr>`;
      }
    )
    .join("");

  return `
<div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%); padding: 20px 28px;">
    <h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.3px;">Light Finance — CCTV Monitoring</h2>
    <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 12px;">Offline Device Alert &nbsp;|&nbsp; Generated: ${now} IST</p>
  </div>

  <!-- Body -->
  <div style="padding: 24px 28px; background: #ffffff;">

    <!-- Branch Team message -->
    <div style="margin-bottom: 20px; padding: 16px 18px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #0c4a6e;">Dear Branch Team,</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #1e3a5f; line-height: 1.6;">
        Please find below the CCTV status of your branches; please check your internet cable if any issue persists; and please contact the IT team.
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #374151; line-height: 1.6;">
        कृपया अपनी शाखाओं की सीसीटीवी स्थिति नीचे देखें; कृपया अपना इंटरनेट केबल जांचें; यदि समस्या बनी रहती है तो आईटी टीम से संपर्क करें।
      </p>
      <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.6;">
        કૃપા કરીને તમારી શાખાઓની સીસીટીવી સ્થિતિ નીચે શોધો; કૃપા કરીને તમારી ઇન્ટરનેટ કેબલ તપાસો; જો સમસ્યા ચાલુ રહે તો કૃપા કરીને IT ટીમનો સંપર્ક કરો.
      </p>
    </div>

    <!-- RM message -->
    <div style="margin-bottom: 20px; padding: 16px 18px; background: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #7c2d12;">Dear RM's,</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #1e3a5f; line-height: 1.6;">
        The CCTV cameras at the following branches are showing as offline; please coordinate with your branch BMs to resolve the issue as soon as possible.
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #374151; line-height: 1.6;">
        निम्नलिखित शाखाओं के सीसीटीवी कैमरे ऑफ़लाइन दिख रहे हैं; कृपया समस्या को यथाशीघ्र हल करने के लिए अपनी शाखा के बीएम के साथ समन्वय करें।
      </p>
      <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.6;">
        નીચેની શાખાઓ પરના સીસીટીવી કેમેરા ઑફલાઇન તરીકે દેખાઈ રહ્યા છે; શક્ય તેટલી વહેલી તકે સમસ્યાનો ઉકેલ લાવવા માટે કૃપા કરીને તમારી શાખા BM સાથે સંકલન કરો.
      </p>
    </div>

    ${
      hasLongOffline
        ? `<div style="margin-bottom: 20px; padding: 12px 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px; font-size: 13px; color: #7f1d1d;">
      ⚠️ <strong>Since the branch has been offline for more than 3 days, CBM, DM, SH — please coordinate with your branch urgently.</strong>
    </div>`
        : ""
    }

    <!-- Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background: #1e40af;">
          <th style="padding: 10px 12px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 40px;">NO</th>
          <th style="padding: 10px 12px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">State Name</th>
          <th style="padding: 10px 12px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Branch Name</th>
          <th style="padding: 10px 12px; text-align: center; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">CCTV Status</th>
          <th style="padding: 10px 12px; text-align: left; color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Remark</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- Signature -->
    <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #f3f4f6;">
      <p style="margin: 0 0 2px; font-size: 13px; color: #374151;">Thanks &amp; Regards,</p>
      <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e3a5f;">IT Team</p>
      <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">Light Finance — CCTV Monitoring System</p>
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
