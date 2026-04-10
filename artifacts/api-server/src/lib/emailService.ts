import nodemailer from "nodemailer";
import { db, settingsTable, devicesTable, dvrStorageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

type EmailAttachment = { filename: string; content: Buffer; contentType: string };

export async function sendEmail(
  subject: string,
  html: string,
  text?: string,
  extraTo?: string[],
  extraCc?: string[],
  attachments?: EmailAttachment[]
): Promise<void> {
  const settings = await getEmailSettings();

  if (!settings.enabled) {
    logger.info("Email notifications disabled — skipping send");
    return;
  }

  if (!settings.host || !settings.user || !settings.password) {
    logger.warn("Email settings incomplete — skipping send");
    return;
  }

  const transporter = createTransporter(settings);
  const toList = [...(extraTo ?? [])].filter((v, i, arr) => arr.indexOf(v) === i);
  const ccList = [...(extraCc ?? [])].filter((v, i, arr) => arr.indexOf(v) === i && !toList.includes(v));

  if (toList.length === 0) {
    logger.warn("No recipients defined — skipping send");
    return;
  }

  await transporter.sendMail({
    from: settings.from || settings.user,
    to: toList.join(", "),
    cc: ccList.length > 0 ? ccList.join(", ") : undefined,
    subject,
    html,
    text,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  logger.info({ to: toList, cc: ccList, subject }, "Email sent successfully");
}

function buildOfflinePDF(devices: OfflineDevice[], dateStr: string): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Light Finance — CCTV Offline Report", pageW / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${dateStr}`, pageW / 2, 20, { align: "center" });

  autoTable(doc, {
    startY: 26,
    head: [["#", "State", "Branch", "Status", "Offline Days", "Remark"]],
    body: devices.map((d, i) => [
      String(i + 1),
      d.stateName,
      d.branchName,
      "Offline",
      String(d.offlineDays),
      d.remark || (d.offlineDays >= 3 ? `Offline for ${d.offlineDays} days` : ""),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [255, 192, 0], textColor: [0, 0, 0], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 250, 235] },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "center", cellWidth: 26 },
    },
  });

  return Buffer.from(doc.output("arraybuffer"));
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
        <tr>
          <td style="padding: 6px 10px; text-align: center; border: 1px solid #000000; font-size: 13px;">${i + 1}</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 13px;">${d.stateName}</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 13px; font-weight: 600;">${d.branchName}</td>
          <td style="padding: 6px 10px; text-align: center; border: 1px solid #000000; font-size: 13px;">Offline</td>
          <td style="padding: 6px 10px; border: 1px solid #000000; font-size: 13px;">${remark}</td>
        </tr>`;
      }
    )
    .join("");

  return `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #000000; max-width: 700px;">

  <p style="margin: 0 0 6px 0;"><strong>Dear Branch Team,</strong></p>
  <p style="margin: 0 0 4px 0; line-height: 1.6;">Please find below the CCTV status of your branches; please check your internet cable if any issue persists; and please contact the IT team.</p>
  <p style="margin: 0 0 4px 0; line-height: 1.6;">कृपया अपनी शाखाओं की सीसीटीवी स्थिति नीचे देखें; कृपया अपना इंटरनेट केबल जांचें; यदि समस्या बनी रहती है तो आईटी टीम से संपर्क करें।</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">કૃપા કરીને તમારી શાખાઓની સીસીટીવી સ્થિતિ નીચે શોધો; કૃપા કરીને તમારી ઇન્ટરનેટ કેબલ તપાસો; જો સમસ્યા ચાલુ રહે તો કૃપા કરીને IT ટીમનો સંપર્ક કરો.</p>

  <p style="margin: 0 0 6px 0;"><strong>Dear RM's,</strong></p>
  <p style="margin: 0 0 4px 0; line-height: 1.6;">The CCTV cameras at the following branches are showing as offline; please coordinate with your branch BMs to resolve the issue as soon as possible.</p>
  <p style="margin: 0 0 4px 0; line-height: 1.6;">निम्नलिखित शाखाओं के सीसीटीवी कैमरे ऑफ़लाइन दिख रहे हैं; कृपया समस्या को यथाशीघ्र हल करने के लिए अपनी शाखा के बीएम के साथ समन्वय करें।</p>
  <p style="margin: 0 0 16px 0; line-height: 1.6;">નીચેની શાખાઓ પરના સીસીટીવી કેમેરા ઑફલાઇન તરીકે દેખાઈ રહ્યા છે; શક્ય તેટલી વહેલી તકે સમસ્યાનો ઉકેલ લાવવા માટે કૃપા કરીને તમારી શાખા BM સાથે સંકલન કરો.</p>

  ${hasLongOffline ? `<p style="margin: 0 0 16px 0; font-weight: bold;">Since the branch has been offline for more than 3 days, CBM, DM, SH, please coordinate with your branch.</p>` : ""}

  <table style="border-collapse: collapse; width: auto; min-width: 500px; font-size: 13px;">
    <thead>
      <tr style="background-color: #FFC000;">
        <th style="padding: 7px 10px; border: 1px solid #000000; text-align: center; font-weight: bold; width: 40px;">NO</th>
        <th style="padding: 7px 10px; border: 1px solid #000000; text-align: center; font-weight: bold;">State Name</th>
        <th style="padding: 7px 10px; border: 1px solid #000000; text-align: center; font-weight: bold;">Branch Name</th>
        <th style="padding: 7px 10px; border: 1px solid #000000; text-align: center; font-weight: bold;">CCTV Status</th>
        <th style="padding: 7px 10px; border: 1px solid #000000; text-align: center; font-weight: bold;">Remark</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <br/>
  <p style="margin: 0 0 2px 0;">Thanks &amp; Regards,</p>
  <p style="margin: 0 0 2px 0;"><strong>IT Team</strong></p>
  <p style="margin: 0; color: #555555; font-size: 12px;">Light Finance &mdash; CCTV Monitoring System</p>

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

  const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const subject = `CCTV Offline Status | ${dateStr}`;

  const toPrimary: string[] = [];
  if (device.email) {
    toPrimary.push(...device.email.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const ccRecipients: string[] = [];
  if (device.ccEmails) {
    ccRecipients.push(...device.ccEmails.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const globalCcList = await getSetting("email_cc_list");
  if (globalCcList) {
    ccRecipients.push(...globalCcList.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const html = buildOfflineAlertHtml([device]);
  const pdfBuffer = buildOfflinePDF([device], dateStr);
  await sendEmail(subject, html, undefined, toPrimary, ccRecipients, [
    { filename: `CCTV_Offline_Report_${dateStr}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
  ]);
}

export async function sendBulkOfflineAlert(devices: OfflineDevice[]): Promise<void> {
  if (devices.length === 0) return;

  const offlineAlertsEnabled = await getSetting("email_offline_alerts");
  if (offlineAlertsEnabled === "false") {
    logger.info("Offline alert emails disabled — skipping");
    return;
  }

  const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const subject = `CCTV Offline Status | ${dateStr}`;

  const toPrimary: string[] = [];
  const ccRecipients: string[] = [];

  for (const d of devices) {
    if (d.email) toPrimary.push(...d.email.split(",").map((e) => e.trim()).filter(Boolean));
    if (d.ccEmails) ccRecipients.push(...d.ccEmails.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const globalCcList = await getSetting("email_cc_list");
  if (globalCcList) {
    ccRecipients.push(...globalCcList.split(",").map((e) => e.trim()).filter(Boolean));
  }

  const uniqueTo = toPrimary.filter((v, i, arr) => arr.indexOf(v) === i);
  const uniqueCc = ccRecipients.filter((v, i, arr) => arr.indexOf(v) === i);

  const html = buildOfflineAlertHtml(devices);
  const pdfBuffer = buildOfflinePDF(devices, dateStr);
  await sendEmail(subject, html, undefined, uniqueTo, uniqueCc, [
    { filename: `CCTV_Offline_Report_${dateStr}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
  ]);
}

function buildDvrReportPDF(
  records: { state: string; branch: string; branchCameraCount: number | null; noOfRecordingCamera: number | null; noOfNotWorkingCamera: number | null; lastRecording: string | null; activityDate: string; totalRecordingDay: number | null; remark: string | null; status: string }[],
  dateStr: string,
  periodLabel: string
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Light Finance — DVR Storage Activity Report", 14, 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${periodLabel}   |   Activity Date: ${dateStr}   |   Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, 14, 16);

  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => r.status === "pending");

  autoTable(doc, {
    startY: 26,
    head: [["#", "State", "Branch", "Branch Camera Count", "Recording Cameras", "Not Working", "Last Recording", "Activity Date", "Recording Days", "Remark", "Status"]],
    body: records.map((r, i) => [
      i + 1,
      r.state,
      r.branch,
      r.branchCameraCount ?? "—",
      r.noOfRecordingCamera ?? "—",
      r.noOfNotWorkingCamera ?? "—",
      r.lastRecording || "—",
      r.activityDate,
      r.totalRecordingDay ?? "—",
      r.remark || "—",
      r.status === "completed" ? "✓ Done" : "Pending",
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20 },
      6: { cellWidth: 26 },
      7: { cellWidth: 22 },
      8: { cellWidth: 18 },
      9: { cellWidth: 28 },
      10: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.column.index === 10 && data.section === "body") {
        const val = String(data.cell.raw);
        if (val.includes("Done")) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 26;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Total Branches: ${records.length}  |  Completed: ${completed.length}  |  Pending: ${pending.length}`,
    14,
    finalY + 8
  );

  return Buffer.from(doc.output("arraybuffer"));
}

function buildDvrReportHtml(
  records: { state: string; branch: string; noOfRecordingCamera: number | null; noOfNotWorkingCamera: number | null; lastRecording: string | null; activityDate: string; totalRecordingDay: number | null; remark: string | null; status: string }[],
  dateStr: string,
  periodLabel: string
): string {
  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => r.status === "pending");

  const rows = records
    .map(
      (r, i) => `
      <tr>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;">${i + 1}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:13px;">${r.state}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:13px;font-weight:600;">${r.branch}</td>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;">${r.noOfRecordingCamera ?? "—"}</td>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;">${r.noOfNotWorkingCamera ?? "—"}</td>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;">${r.lastRecording || "—"}</td>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;">${r.totalRecordingDay ?? "—"}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-size:13px;">${r.remark || "—"}</td>
        <td style="padding:6px 10px;text-align:center;border:1px solid #d1d5db;font-size:13px;font-weight:600;color:${r.status === "completed" ? "#16a34a" : "#dc2626"};">
          ${r.status === "completed" ? "✓ Done" : "Pending"}
        </td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;max-width:900px;">
  <div style="background:#0f172a;padding:16px 20px;border-radius:8px 8px 0 0;">
    <h2 style="color:#ffffff;margin:0;font-size:18px;">Light Finance — DVR Storage Activity Report</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Period: ${periodLabel} &nbsp;|&nbsp; Activity Date: ${dateStr}</p>
  </div>

  <div style="background:#f8fafc;padding:12px 20px;border:1px solid #e5e7eb;display:flex;gap:32px;">
    <span style="font-size:13px;color:#374151;"><strong>Total Branches:</strong> ${records.length}</span>
    <span style="font-size:13px;color:#16a34a;"><strong>Completed:</strong> ${completed.length}</span>
    <span style="font-size:13px;color:#dc2626;"><strong>Pending:</strong> ${pending.length}</span>
  </div>

  <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:0;">
    <thead>
      <tr style="background:#1e40af;">
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;width:36px;">#</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;">State</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;">Branch</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;">Recording Cameras</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;">Not Working</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;">Last Recording</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;">Recording Days</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;">Remark</th>
        <th style="padding:8px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
    This is an automated DVR activity report from the Light Finance CCTV Monitoring System.
  </div>
</div>`;
}

export async function sendDvrActivityReport(label: "mid-month" | "end-of-month"): Promise<{ sent: boolean; reason?: string }> {
  const now = new Date();
  const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const records = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.activityDate, istDateStr));

  if (records.length === 0) {
    return { sent: false, reason: "No DVR records found for today — report not sent" };
  }

  const monthStr = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" });
  const periodLabel = label === "mid-month"
    ? `1–15 ${monthStr} (First Half)`
    : `16–End of ${monthStr} (Second Half)`;

  const dateStr = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
  const subject = `DVR Activity Report — ${periodLabel} | ${dateStr}`;

  const settings = await getEmailSettings();
  const toPrimary = settings.to ? settings.to.split(",").map((e) => e.trim()).filter(Boolean) : [];

  const globalCcList = await getSetting("email_cc_list");
  const ccRecipients = globalCcList ? globalCcList.split(",").map((e) => e.trim()).filter(Boolean) : [];

  if (toPrimary.length === 0) {
    return { sent: false, reason: "No email recipients configured" };
  }

  const html = buildDvrReportHtml(records, dateStr, periodLabel);
  const pdfBuffer = buildDvrReportPDF(records, dateStr, periodLabel);

  await sendEmail(subject, html, undefined, toPrimary, ccRecipients, [
    { filename: `DVR_Activity_Report_${istDateStr}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
  ]);

  return { sent: true };
}
