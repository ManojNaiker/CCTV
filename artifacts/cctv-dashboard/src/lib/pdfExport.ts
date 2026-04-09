import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DeviceRow {
  id: number;
  branchName: string;
  stateName: string;
  serialNumber: string;
  status: string;
  offlineDays?: number | null;
  lastSeenAt?: string | null;
  remark?: string | null;
}

interface StatusSummary {
  total: number;
  online: number;
  offline: number;
}

const COMPANY_NAME = "Light Finance";
const REPORT_TITLE = "Branch CCTV Offline Report";
const PORTAL_NAME = "CCTV Monitoring Portal";
const HEADER_HEIGHT = 28;

async function loadLogoBase64(): Promise<{ base64: string; img: HTMLImageElement } | null> {
  try {
    const url = `${window.location.origin}/logo.png`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = base64;
    });
    return { base64, img };
  } catch {
    return null;
  }
}

function drawDonutChart(
  doc: jsPDF,
  x: number,
  y: number,
  radius: number,
  online: number,
  offline: number,
  unknown: number
): number {
  const total = online + offline + unknown;
  if (total === 0) return y + radius * 2 + 20;

  const slices: { value: number; color: string; label: string }[] = [
    { value: online, color: "#22c55e", label: "Online" },
    { value: offline, color: "#ef4444", label: "Offline" },
    { value: unknown, color: "#f97316", label: "Unknown" },
  ].filter((s) => s.value > 0);

  const canvasSize = (radius * 2 + 10) * 3;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;

  const canvasCx = canvasSize / 2;
  const canvasCy = canvasSize / 2;
  const canvasRadius = radius * 3 - 5;
  const canvasInner = (radius * 0.5) * 3;

  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(canvasCx, canvasCy);
    ctx.arc(canvasCx, canvasCy, canvasRadius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    startAngle += sliceAngle;
  }

  ctx.beginPath();
  ctx.arc(canvasCx, canvasCy, canvasInner, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.font = `bold ${Math.round(canvasRadius * 0.4)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${((online / total) * 100).toFixed(0)}%`, canvasCx, canvasCy - canvasRadius * 0.05);
  ctx.font = `${Math.round(canvasRadius * 0.22)}px Arial`;
  ctx.fillStyle = "#6b7280";
  ctx.fillText("Online", canvasCx, canvasCy + canvasRadius * 0.2);

  const imgData = canvas.toDataURL("image/png");
  const chartSize = radius * 2;
  doc.addImage(imgData, "PNG", x, y, chartSize, chartSize);

  let legendX = x;
  const legendY = y + chartSize + 6;
  const swatchSize = 4;

  for (const slice of slices) {
    const pct = ((slice.value / total) * 100).toFixed(1);
    const label = `${slice.label} ${slice.value} (${pct}%)`;
    doc.setFillColor(slice.color);
    doc.rect(legendX, legendY, swatchSize, swatchSize, "F");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(label, legendX + swatchSize + 2, legendY + swatchSize - 0.5);
    legendX += doc.getTextWidth(label) + swatchSize + 8;
  }

  return legendY + 10;
}

function drawWatermark(doc: jsPDF, logoImg: HTMLImageElement) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const wmSize = 80;
  const canvasDim = wmSize * 3;

  const wmCanvas = document.createElement("canvas");
  wmCanvas.width = canvasDim;
  wmCanvas.height = canvasDim;
  const wmCtx = wmCanvas.getContext("2d")!;

  wmCtx.save();
  wmCtx.translate(canvasDim / 2, canvasDim / 2);
  wmCtx.rotate((45 * Math.PI) / 180);
  wmCtx.globalAlpha = 0.06;
  wmCtx.drawImage(logoImg, -wmSize * 1.2, -wmSize * 1.2, wmSize * 2.4, wmSize * 2.4);
  wmCtx.restore();

  const wmData = wmCanvas.toDataURL("image/png");
  doc.addImage(wmData, "PNG", pageW / 2 - 40, pageH / 2 - 40, 80, 80);
}

function addPageElements(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  generatedAt: string,
  logo: { base64: string; img: HTMLImageElement } | null
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  if (logo) {
    drawWatermark(doc, logo.img);
  }

  // White header background to prevent content showing through
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, HEADER_HEIGHT, "F");

  // Logo or fallback
  const logoH = 14;
  const logoW = 28;

  if (logo) {
    doc.addImage(logo.base64, "PNG", 10, 5, logoW, logoH);
  } else {
    doc.setFillColor(29, 78, 216);
    doc.roundedRect(10, 6, logoW, logoH - 2, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, 10 + logoW / 2, 14, { align: "center" });
  }

  // Report title — centered, sized to not clash with logo
  doc.setFontSize(14);
  doc.setTextColor(22, 22, 22);
  doc.setFont("helvetica", "bold");
  doc.text(REPORT_TITLE, pageW / 2, 11, { align: "center" });

  // Subtitle — slightly below title
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text(PORTAL_NAME, pageW / 2, 17, { align: "center" });

  // Header separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(10, HEADER_HEIGHT, pageW - 10, HEADER_HEIGHT);

  // Footer
  const footerY = pageH - 12;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, footerY - 5, pageW, 20, "F");

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(10, footerY - 3, pageW - 10, footerY - 3);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "normal");

  doc.text(COMPANY_NAME, 10, footerY + 1);
  doc.text(`Generated: ${generatedAt}`, 10, footerY + 5);

  doc.text(PORTAL_NAME, pageW - 10, footerY + 1, { align: "right" });
  doc.text("Confidential — Internal Use Only", pageW - 10, footerY + 5, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, footerY + 3, { align: "center" });
}

export interface StatusReportParams {
  records: { serialNumber: string; branchName: string; stateName: string; date: string; status: string }[];
  devices: { serialNumber: string; branchName: string; stateName: string }[];
  dateRange: string[];
  daySummaries: { date: string; online: number; offline: number; unknown: number; noData: number }[];
  from: string;
  to: string;
}

export async function generateStatusReportPDF(params: StatusReportParams): Promise<void> {
  const { records, devices, dateRange, from, to } = params;
  const logo = await loadLogoBase64();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });

  const STATUS_REPORT_TITLE = "Device Status Report";
  const CONTENT_TOP = HEADER_HEIGHT + 6;

  const statusMap = new Map<string, string>();
  for (const r of records) statusMap.set(`${r.serialNumber}::${r.date}`, r.status);

  // PAGE 1 — Calendar Grid (up to 15 dates per page)
  const DATES_PER_PAGE = 15;
  const dateChunks: string[][] = [];
  for (let i = 0; i < dateRange.length; i += DATES_PER_PAGE) {
    dateChunks.push(dateRange.slice(i, i + DATES_PER_PAGE));
  }

  for (let chunkIdx = 0; chunkIdx < dateChunks.length; chunkIdx++) {
    if (chunkIdx > 0) doc.addPage();
    const chunk = dateChunks[chunkIdx];

    // Section title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text(
      `Calendar View — ${from === to ? from : `${from} to ${to}`}${dateChunks.length > 1 ? ` (Part ${chunkIdx + 1}/${dateChunks.length})` : ""}`,
      10,
      CONTENT_TOP + 3
    );
    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.line(10, CONTENT_TOP + 5, pageW - 10, CONTENT_TOP + 5);

    const head = [["#", "Branch", "State", "Serial", ...chunk.map((d) => {
      const dt = new Date(`${d}T12:00:00`);
      return `${dt.toLocaleDateString("en-IN", { day: "2-digit" })}\n${dt.toLocaleDateString("en-IN", { weekday: "short" })}`;
    })]];

    const statusLabel = (s: string | undefined) => {
      if (!s) return "–";
      if (s === "online") return "ON";
      if (s === "offline") return "OFF";
      return "?";
    };

    const body = devices.map((device, i) => [
      (i + 1).toString(),
      device.branchName,
      device.stateName,
      device.serialNumber,
      ...chunk.map((date) => statusLabel(statusMap.get(`${device.serialNumber}::${date}`))),
    ]);

    autoTable(doc, {
      startY: CONTENT_TOP + 8,
      head,
      body,
      headStyles: {
        fillColor: [29, 78, 216],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 40, fontStyle: "bold" },
        2: { cellWidth: 28 },
        3: { cellWidth: 30, fontName: "courier", textColor: [80, 80, 80] },
        ...Object.fromEntries(chunk.map((_, i) => [i + 4, { cellWidth: 12, halign: "center" }])),
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 4) {
          const val = String(data.cell.raw);
          if (val === "ON") {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "OFF") {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "?") {
            data.cell.styles.textColor = [180, 100, 20];
          } else {
            data.cell.styles.textColor = [180, 180, 180];
          }
        }
      },
      margin: { left: 10, right: 10, top: HEADER_HEIGHT + 2 },
    });
  }

  // Last page — Uptime Summary Table
  doc.addPage();
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Device Uptime Summary", 10, CONTENT_TOP + 3);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, CONTENT_TOP + 5, pageW - 10, CONTENT_TOP + 5);

  const summaryBody = devices.map((device, i) => {
    let onlineD = 0, offlineD = 0, unknownD = 0, noDataD = 0;
    for (const date of dateRange) {
      const s = statusMap.get(`${device.serialNumber}::${date}`);
      if (!s) noDataD++;
      else if (s === "online") onlineD++;
      else if (s === "offline") offlineD++;
      else unknownD++;
    }
    const tracked = onlineD + offlineD + unknownD;
    const uptime = tracked > 0 ? `${((onlineD / tracked) * 100).toFixed(1)}%` : "–";
    return [
      (i + 1).toString(),
      device.branchName,
      device.stateName,
      device.serialNumber,
      onlineD.toString(),
      offlineD.toString(),
      unknownD.toString(),
      noDataD.toString(),
      uptime,
    ];
  });

  autoTable(doc, {
    startY: CONTENT_TOP + 8,
    head: [["#", "Branch", "State", "Serial", "Online Days", "Offline Days", "Unknown", "No Data", "Uptime %"]],
    body: summaryBody,
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
      1: { cellWidth: 55, fontStyle: "bold" },
      2: { cellWidth: 35 },
      3: { cellWidth: 40, fontName: "courier", textColor: [80, 80, 80] },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 18, halign: "center" },
      8: { cellWidth: 22, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 4) data.cell.styles.textColor = [21, 128, 61];
        if (data.column.index === 5) {
          const val = parseInt(String(data.cell.raw), 10);
          if (val > 0) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === 8) {
          const val = parseFloat(String(data.cell.raw));
          if (!isNaN(val)) {
            if (val >= 80) data.cell.styles.textColor = [21, 128, 61];
            else if (val >= 50) data.cell.styles.textColor = [180, 100, 20];
            else data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
    margin: { left: 10, right: 10, top: HEADER_HEIGHT + 2 },
  });

  // Override title/subtitle for all pages
  const totalPages = doc.getNumberOfPages();
  const savedTitle = REPORT_TITLE;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (logo) drawWatermark(doc, logo.img);

    const lPageW = doc.internal.pageSize.getWidth();
    const lPageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, lPageW, HEADER_HEIGHT, "F");

    const logoH = 14, logoW = 28;
    if (logo) {
      doc.addImage(logo.base64, "PNG", 10, 5, logoW, logoH);
    } else {
      doc.setFillColor(29, 78, 216);
      doc.roundedRect(10, 6, logoW, logoH - 2, 2, 2, "F");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(COMPANY_NAME, 10 + logoW / 2, 14, { align: "center" });
    }

    doc.setFontSize(14);
    doc.setTextColor(22, 22, 22);
    doc.setFont("helvetica", "bold");
    doc.text(STATUS_REPORT_TITLE, lPageW / 2, 11, { align: "center" });

    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.text(`${PORTAL_NAME}  |  Period: ${from === to ? from : `${from} to ${to}`}`, lPageW / 2, 17, { align: "center" });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(10, HEADER_HEIGHT, lPageW - 10, HEADER_HEIGHT);

    const footerY = lPageH - 12;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, footerY - 5, lPageW, 20, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(10, footerY - 3, lPageW - 10, footerY - 3);

    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont("helvetica", "normal");
    doc.text(COMPANY_NAME, 10, footerY + 1);
    doc.text(`Generated: ${generatedAt}`, 10, footerY + 5);
    doc.text(PORTAL_NAME, lPageW - 10, footerY + 1, { align: "right" });
    doc.text("Confidential — Internal Use Only", lPageW - 10, footerY + 5, { align: "right" });
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Page ${p} of ${totalPages}`, lPageW / 2, footerY + 3, { align: "center" });
  }

  void savedTitle;
  doc.save(`status-report-${from}-to-${to}.pdf`);
}

export async function generateOfflinePDF(devices: DeviceRow[], summary: StatusSummary): Promise<void> {
  const logo = await loadLogoBase64();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });

  const unknown = summary.total - summary.online - summary.offline;
  const CONTENT_TOP = HEADER_HEIGHT + 4;

  // PAGE 1 — Chart + Summary
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Network Status Overview", 10, CONTENT_TOP + 5);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, CONTENT_TOP + 7, pageW - 10, CONTENT_TOP + 7);

  const chartStartY = CONTENT_TOP + 12;
  const legendEndY = drawDonutChart(doc, pageW / 2 - 30, chartStartY, 30, summary.online, summary.offline, unknown);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Device Status Summary", 10, legendEndY + 4);

  autoTable(doc, {
    startY: legendEndY + 7,
    head: [["Status", "Count", "Percentage"]],
    body: [
      ["Online", summary.online.toString(), `${summary.total > 0 ? ((summary.online / summary.total) * 100).toFixed(1) : 0}%`],
      ["Offline", summary.offline.toString(), `${summary.total > 0 ? ((summary.offline / summary.total) * 100).toFixed(1) : 0}%`],
      ["Unknown", unknown.toString(), `${summary.total > 0 ? ((unknown / summary.total) * 100).toFixed(1) : 0}%`],
      ["Total", summary.total.toString(), "100.0%"],
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
      if (data.row.index === 3) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
      if (data.section === "body" && data.column.index === 0) {
        if (data.row.index === 0) data.cell.styles.textColor = [21, 128, 61];
        if (data.row.index === 1) data.cell.styles.textColor = [185, 28, 28];
        if (data.row.index === 2) data.cell.styles.textColor = [194, 65, 12];
      }
    },
    margin: { left: 10, right: 10, top: HEADER_HEIGHT + 2 },
  });

  let nextY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  if (nextY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    nextY = CONTENT_TOP + 5;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text(`Offline Device List (${summary.offline} devices)`, 10, nextY);
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
      d.offlineDays != null ? `${d.offlineDays} days` : "—",
      d.remark || "—",
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
      3: { cellWidth: 35, fontName: "courier", textColor: [80, 80, 80] },
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
    margin: { left: 10, right: 10, top: HEADER_HEIGHT + 2 },
  });

  // Add headers/footers to ALL pages (drawn last to get total page count)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageElements(doc, p, totalPages, generatedAt, logo);
  }

  doc.save(`offline-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
