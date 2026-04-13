import nodemailer from "nodemailer";
import { db, settingsTable, devicesTable, dvrStorageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const PDF_COMPANY_NAME = "Light Finance";
const PDF_PORTAL_NAME = "CCTV Monitoring Portal";
const PDF_HEADER_HEIGHT = 28;

function loadServerLogo(): string | null {
  try {
    const paths = [
      resolve(process.cwd(), "../cctv-dashboard/public/logo.png"),
      resolve(process.cwd(), "../../artifacts/cctv-dashboard/public/logo.png"),
    ];
    for (const p of paths) {
      try {
        const buf = readFileSync(p);
        return "data:image/png;base64," + buf.toString("base64");
      } catch { }
    }
    return null;
  } catch {
    return null;
  }
}

function drawServerWatermark(doc: InstanceType<typeof jsPDF>, logoBase64: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  try {
    doc.saveGraphicsState();
    (doc as any).setGState((doc as any).GState({ opacity: 0.06 }));
    doc.addImage(logoBase64, "PNG", pageW / 2 - 40, pageH / 2 - 40, 80, 80);
    doc.restoreGraphicsState();
  } catch { }
}

function addPdfPageElements(
  doc: InstanceType<typeof jsPDF>,
  pageNum: number,
  totalPages: number,
  generatedAt: string,
  title: string,
  subtitle?: string,
  logoBase64?: string | null
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (logoBase64) drawServerWatermark(doc, logoBase64);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, PDF_HEADER_HEIGHT, "F");

  const logoH = 14;
  const logoW = 28;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 10, 5, logoW, logoH);
  } else {
    doc.setFillColor(29, 78, 216);
    doc.roundedRect(10, 6, logoW, logoH - 2, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(PDF_COMPANY_NAME, 10 + logoW / 2, 14, { align: "center" });
  }

  doc.setFontSize(14);
  doc.setTextColor(22, 22, 22);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 11, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle ?? PDF_PORTAL_NAME, pageW / 2, 17, { align: "center" });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(10, PDF_HEADER_HEIGHT, pageW - 10, PDF_HEADER_HEIGHT);

  const footerY = pageH - 12;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, footerY - 5, pageW, 20, "F");
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(10, footerY - 3, pageW - 10, footerY - 3);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "normal");
  doc.text(PDF_COMPANY_NAME, 10, footerY + 1);
  doc.text(`Generated: ${generatedAt}`, 10, footerY + 5);
  doc.text(PDF_PORTAL_NAME, pageW - 10, footerY + 1, { align: "right" });
  doc.text("Confidential — Internal Use Only", pageW - 10, footerY + 5, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, footerY + 3, { align: "center" });
}

function buildOfflinePDF(devices: OfflineDevice[], dateStr: string): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const CONTENT_TOP = PDF_HEADER_HEIGHT + 4;
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Device Status Summary", 10, CONTENT_TOP + 5);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, CONTENT_TOP + 7, pageW - 10, CONTENT_TOP + 7);

  autoTable(doc, {
    startY: CONTENT_TOP + 10,
    head: [["Status", "Count", "Percentage"]],
    body: [
      ["Offline", devices.length.toString(), "100.0%"],
      ["Total", devices.length.toString(), "100.0%"],
    ],
    headStyles: {
      fillColor: [220, 230, 241],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: { halign: "center", fontSize: 9 },
    columnStyles: {
      0: { halign: "left", cellWidth: 50 },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.row.index === 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
      if (data.section === "body" && data.column.index === 0 && data.row.index === 0) {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
    margin: { left: 10, right: 10, top: PDF_HEADER_HEIGHT + 2 },
  });

  const afterSummary = (doc as any).lastAutoTable?.finalY ?? CONTENT_TOP + 40;
  let nextY = afterSummary + 12;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text(`Offline Device List (${devices.length} devices)`, 10, nextY);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, nextY + 2, pageW - 10, nextY + 2);

  autoTable(doc, {
    startY: nextY + 5,
    head: [["#", "Branch Name", "State", "Serial Number", "Days Offline", "Remark"]],
    body: devices.map((d, i) => [
      (i + 1).toString(),
      d.branchName,
      d.stateName,
      d.serialNumber,
      `${d.offlineDays} days`,
      d.remark || (d.offlineDays >= 3 ? `Offline for ${d.offlineDays} days` : "—"),
    ]),
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 45, fontStyle: "bold", textColor: [185, 28, 28] },
      2: { cellWidth: 35 },
      3: { cellWidth: 35, textColor: [80, 80, 80] },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 45 },
    },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const days = parseInt(String(data.cell.raw), 10);
        if (!isNaN(days) && days >= 3) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 10, right: 10, top: PDF_HEADER_HEIGHT + 2 },
  });

  const logo = loadServerLogo();
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPdfPageElements(doc, p, totalPages, generatedAt, "Branch CCTV Offline Report", undefined, logo);
  }

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
  const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" });

  const tableRows = devices.map((d, i) => {
    const remark = d.remark
      ? d.remark
      : d.offlineDays >= 3
      ? `Offline for ${d.offlineDays} days`
      : "CCTV has been offline since today.";
    const bgColor = i % 2 === 0 ? "#ffffff" : "#fff5f5";
    return `
      <tr style="background-color:${bgColor};">
        <td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${i + 1}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;">${d.stateName}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#111827;">${d.branchName}</td>
        <td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;font-size:13px;">
          <span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">Offline</span>
        </td>
        <td style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;font-size:13px;${d.offlineDays >= 3 ? "color:#b91c1c;font-weight:600;" : "color:#374151;"}">${d.offlineDays} day${d.offlineDays !== 1 ? "s" : ""}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#374151;">${remark}</td>
      </tr>`;
  }).join("");

  return `
<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#f9fafb;padding:0;">

  <div style="background:#1d4ed8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Light Finance — CCTV Monitoring</h1>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Branch CCTV Offline Alert &nbsp;|&nbsp; ${dateStr}</p>
  </div>

  <div style="background:#ffffff;padding:20px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">

    <p style="margin:0 0 6px;font-size:14px;color:#111827;"><strong>Dear Branch Team,</strong></p>
    <p style="margin:0 0 4px;font-size:13px;color:#374151;line-height:1.7;">Please find below the CCTV status of your branches. If any issue persists, please check your internet connection and contact the IT team.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#374151;line-height:1.7;">कृपया अपनी शाखाओं की सीसीटीवी स्थिति नीचे देखें। यदि समस्या बनी रहती है तो इंटरनेट केबल जांचें व आईटी टीम से संपर्क करें।</p>
    <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.7;">કૃપા કરીને નીચે સ્થિતિ જુઓ. સમસ્યા ચાલુ રહે તો ઇન્ટરનેટ કેબલ તપાસો અને IT ટીમનો સંપર્ક કરો.</p>

    <p style="margin:0 0 6px;font-size:14px;color:#111827;"><strong>Dear RM's,</strong></p>
    <p style="margin:0 0 4px;font-size:13px;color:#374151;line-height:1.7;">The CCTV cameras at the following branches are offline. Please coordinate with your branch BMs to resolve this as soon as possible.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#374151;line-height:1.7;">निम्नलिखित शाखाओं के सीसीटीवी कैमरे ऑफ़लाइन हैं। कृपया समस्या जल्द हल करने के लिए बीएम के साथ समन्वय करें।</p>
    <p style="margin:0 0 20px;font-size:13px;color:#374151;line-height:1.7;">નીચેની શાખાઓ ઑફલાઇન છે. BM સાથે સંકલન કરીને સમસ્યા વહેલી તકે ઉકેલો.</p>

    ${hasLongOffline ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:10px 14px;margin-bottom:20px;border-radius:0 4px 4px 0;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#b91c1c;">&#9888; Alert: One or more branches have been offline for more than 3 days. CBM, DM, SH — please coordinate with your branch immediately.</p>
    </div>` : ""}

    <div style="margin-bottom:20px;overflow-x:auto;">
      <div style="background:#fbbf24;padding:2px 0;border-radius:6px 6px 0 0;"></div>
      <table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#1d4ed8;">
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;width:36px;">#</th>
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">State</th>
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">Branch Name</th>
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">CCTV Status</th>
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Days Offline</th>
            <th style="padding:9px 12px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">Remark</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#1e40af;"><strong>Summary:</strong> &nbsp;
        Total Offline: <strong>${devices.length}</strong> &nbsp;|&nbsp;
        Offline &ge; 3 days: <strong style="color:#b91c1c;">${devices.filter(d => d.offlineDays >= 3).length}</strong>
      </p>
    </div>

    <p style="margin:0 0 2px;font-size:13px;color:#374151;">Thanks &amp; Regards,</p>
    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">IT Team</p>
    <p style="margin:0;font-size:12px;color:#6b7280;">Light Finance &mdash; CCTV Monitoring System</p>
  </div>

  <div style="background:#f3f4f6;padding:12px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated alert from the Light Finance CCTV Monitoring System. Please do not reply to this email.</p>
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

type DvrRecord = { state: string; branch: string; branchCameraCount: number | null; noOfRecordingCamera: number | null; noOfNotWorkingCamera: number | null; lastRecording: string | null; activityDate: string; totalRecordingDay: number | null; remark: string | null; status: string };

function buildDvrReportPDF(records: DvrRecord[], dateStr: string, periodLabel: string): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const CONTENT_TOP = PDF_HEADER_HEIGHT + 4;
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });

  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => r.status === "pending");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("DVR Storage Activity Records", 10, CONTENT_TOP + 5);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, CONTENT_TOP + 7, pageW - 10, CONTENT_TOP + 7);

  autoTable(doc, {
    startY: CONTENT_TOP + 10,
    head: [["#", "State", "Branch", "Branch Camera Count", "No Of Recording Camera", "No Of Not Working Camera", "Last Recording", "Activity Date", "Total Recording Day", "Remark", "Status"]],
    body: records.map((r, i) => [
      String(i + 1),
      r.state,
      r.branch,
      r.branchCameraCount != null ? String(r.branchCameraCount) : "—",
      r.noOfRecordingCamera != null ? String(r.noOfRecordingCamera) : "—",
      r.noOfNotWorkingCamera != null ? String(r.noOfNotWorkingCamera) : "—",
      r.lastRecording || "—",
      r.activityDate,
      r.totalRecordingDay != null ? String(r.totalRecordingDay) : "—",
      r.remark || "—",
      r.status === "completed" ? "✓ Completed" : "Pending",
    ]),
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 32, fontStyle: "bold" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 26, halign: "center" },
      7: { cellWidth: 22, halign: "center" },
      8: { cellWidth: 18, halign: "center" },
      9: { cellWidth: 28 },
      10: { cellWidth: 22, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.column.index === 10 && data.section === "body") {
        const val = String(data.cell.raw);
        data.cell.styles.fontStyle = "bold";
        if (val.includes("Completed")) {
          data.cell.styles.textColor = [22, 163, 74];
        } else {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
    margin: { left: 10, right: 10, top: PDF_HEADER_HEIGHT + 2 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? CONTENT_TOP + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Total: ${records.length}  |  Completed: ${completed.length}  |  Pending: ${pending.length}`,
    pageW / 2,
    finalY + 7,
    { align: "center" }
  );

  const logo = loadServerLogo();
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPdfPageElements(
      doc, p, totalPages, generatedAt,
      "DVR Storage Activity Report",
      `${PDF_PORTAL_NAME}  |  Period: ${periodLabel}`,
      logo
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function buildDvrReportHtml(
  records: { state: string; branch: string; noOfRecordingCamera: number | null; noOfNotWorkingCamera: number | null; lastRecording: string | null; activityDate: string; totalRecordingDay: number | null; remark: string | null; status: string }[],
  dateStr: string,
  periodLabel: string
): string {
  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => r.status === "pending");

  const rows = records.map((r, i) => {
    const bgColor = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    const isDone = r.status === "completed";
    return `
      <tr style="background-color:${bgColor};">
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${i + 1}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;">${r.state}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#111827;">${r.branch}</td>
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;">${r.noOfRecordingCamera ?? "—"}</td>
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;${r.noOfNotWorkingCamera ? "color:#b91c1c;font-weight:600;" : ""}">${r.noOfNotWorkingCamera ?? "—"}</td>
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;">${r.lastRecording || "—"}</td>
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;">${r.totalRecordingDay ?? "—"}</td>
        <td style="padding:8px 10px;border:1px solid #e5e7eb;font-size:13px;color:#374151;">${r.remark || "—"}</td>
        <td style="padding:8px 10px;text-align:center;border:1px solid #e5e7eb;font-size:13px;">
          <span style="background:${isDone ? "#dcfce7" : "#fee2e2"};color:${isDone ? "#15803d" : "#b91c1c"};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${isDone ? "✓ Done" : "Pending"}</span>
        </td>
      </tr>`;
  }).join("");

  return `
<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;background:#f9fafb;padding:0;">

  <div style="background:#1d4ed8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">Light Finance — DVR Storage Activity Report</h1>
    <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px;">Period: ${periodLabel} &nbsp;|&nbsp; Activity Date: ${dateStr}</p>
  </div>

  <div style="background:#eff6ff;padding:12px 24px;border-left:1px solid #bfdbfe;border-right:1px solid #bfdbfe;display:table;width:100%;box-sizing:border-box;">
    <span style="font-size:13px;color:#374151;margin-right:24px;display:inline-block;"><strong>Total Branches:</strong> ${records.length}</span>
    <span style="font-size:13px;color:#15803d;margin-right:24px;display:inline-block;"><strong>Completed:</strong> ${completed.length}</span>
    <span style="font-size:13px;color:#b91c1c;display:inline-block;"><strong>Pending:</strong> ${pending.length}</span>
  </div>

  <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#1d4ed8;">
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;width:36px;">#</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">State</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">Branch</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Recording Cameras</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Not Working</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Last Recording</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Recording Days</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:left;font-weight:600;">Remark</th>
          <th style="padding:9px 10px;border:1px solid #1e3a8a;color:#fff;text-align:center;font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="background:#f3f4f6;padding:12px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated DVR activity report from the Light Finance CCTV Monitoring System. Please do not reply to this email.</p>
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

export async function sendDvrReportManual(opts: {
  date: string;
  to: string[];
  cc: string[];
}): Promise<{ sent: boolean; reason?: string }> {
  const records = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.activityDate, opts.date));

  if (records.length === 0) {
    return { sent: false, reason: `No DVR records found for ${opts.date}` };
  }

  if (opts.to.length === 0) {
    return { sent: false, reason: "No recipients provided" };
  }

  const dateObj = new Date(opts.date + "T00:00:00+05:30");
  const dateStr = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const monthStr = dateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const day = dateObj.getDate();
  const periodLabel = day <= 15
    ? `1–15 ${monthStr} (First Half)`
    : `16–End of ${monthStr} (Second Half)`;

  const subject = `DVR Activity Report — ${periodLabel} | ${dateStr}`;
  const html = buildDvrReportHtml(records, dateStr, periodLabel);
  const pdfBuffer = buildDvrReportPDF(records, dateStr, periodLabel);

  await sendEmail(subject, html, undefined, opts.to, opts.cc, [
    { filename: `DVR_Activity_Report_${opts.date}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
  ]);

  return { sent: true };
}
