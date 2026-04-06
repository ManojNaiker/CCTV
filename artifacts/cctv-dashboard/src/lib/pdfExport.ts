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
const REPORT_TITLE = "All Network Device Status";
const PORTAL_NAME = "CCTV Monitoring Portal";

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

  const cx = x + radius;
  const cy = y + radius;
  const innerRadius = radius * 0.5;

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
  const canvasRadius = (radius * 3) - 5;
  const canvasInner = innerRadius * 3;

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

  // Draw donut hole
  ctx.beginPath();
  ctx.arc(canvasCx, canvasCy, canvasInner, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Center text
  ctx.fillStyle = "#111827";
  ctx.font = `bold ${Math.round(canvasRadius * 0.4)}px Inter, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${((online / total) * 100).toFixed(0)}%`, canvasCx, canvasCy - canvasRadius * 0.05);
  ctx.font = `${Math.round(canvasRadius * 0.22)}px Inter, Arial`;
  ctx.fillStyle = "#6b7280";
  ctx.fillText("Online", canvasCx, canvasCy + canvasRadius * 0.2);

  const imgData = canvas.toDataURL("image/png");
  const chartSize = radius * 2;
  doc.addImage(imgData, "PNG", x, y, chartSize, chartSize);

  // Legend below chart
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

function addPageElements(doc: jsPDF, pageNum: number, totalPages: number, generatedAt: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // === WATERMARK ===
  const wm = document.createElement("canvas");
  wm.width = 400;
  wm.height = 400;
  const wmCtx = wm.getContext("2d")!;
  wmCtx.save();
  wmCtx.translate(200, 200);
  wmCtx.rotate((45 * Math.PI) / 180);
  wmCtx.globalAlpha = 0.06;
  wmCtx.fillStyle = "#1d4ed8";
  wmCtx.font = "bold 52px Arial";
  wmCtx.textAlign = "center";
  wmCtx.textBaseline = "middle";
  wmCtx.fillText(COMPANY_NAME, 0, 0);
  wmCtx.restore();
  const wmData = wm.toDataURL("image/png");
  doc.addImage(wmData, "PNG", pageW / 2 - 40, pageH / 2 - 40, 80, 80);

  // === HEADER ===
  // Logo placeholder (blue square)
  doc.setFillColor(29, 78, 216);
  doc.roundedRect(10, 8, 22, 10, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, 21, 14, { align: "center" });

  // Title
  doc.setFontSize(14);
  doc.setTextColor(34, 34, 34);
  doc.setFont("helvetica", "bold");
  doc.text(REPORT_TITLE, pageW / 2, 15, { align: "center" });

  // Subtitle
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(PORTAL_NAME, pageW / 2, 21, { align: "center" });

  // Header line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(10, 26, pageW - 10, 26);

  // === FOOTER ===
  const footerY = pageH - 12;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(10, footerY - 3, pageW - 10, footerY - 3);

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");

  // Left footer
  doc.text(COMPANY_NAME, 10, footerY + 1);
  doc.text(`Generated: ${generatedAt}`, 10, footerY + 5);

  // Right footer
  doc.text(PORTAL_NAME, pageW - 10, footerY + 1, { align: "right" });
  doc.text("Confidential — Internal Use Only", pageW - 10, footerY + 5, { align: "right" });

  // Center — page number
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW / 2, footerY + 3, { align: "center" });
}

export async function generateOfflinePDF(devices: DeviceRow[], summary: StatusSummary): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const unknown = summary.total - summary.online - summary.offline;
  const CONTENT_TOP = 30;

  // =====================
  // PAGE 1 — Chart + Summary
  // =====================

  // Section title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("Network Status Overview", 10, CONTENT_TOP + 5);
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(10, CONTENT_TOP + 7, pageW - 10, CONTENT_TOP + 7);

  // Donut chart
  const chartStartY = CONTENT_TOP + 12;
  const legendEndY = drawDonutChart(doc, pageW / 2 - 30, chartStartY, 30, summary.online, summary.offline, unknown);

  // Summary table
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
      // Color rows
      if (data.section === "body" && data.column.index === 0) {
        if (data.row.index === 0) data.cell.styles.textColor = [21, 128, 61];
        if (data.row.index === 1) data.cell.styles.textColor = [185, 28, 28];
        if (data.row.index === 2) data.cell.styles.textColor = [194, 65, 12];
      }
    },
    margin: { left: 10, right: 10 },
  });

  let nextY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // =====================
  // Device Table (may span multiple pages)
  // =====================
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);

  if (nextY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    nextY = CONTENT_TOP + 5;
  }

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
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      // Headers and footers are added after all pages are drawn
    },
  });

  // Add headers/footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageElements(doc, p, totalPages, generatedAt);
  }

  doc.save(`offline-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
