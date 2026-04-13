import { useState, useRef, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HardDrive,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  PlusCircle,
  Search,
  X,
  Upload,
  Download,
  MessageSquare,
  Pencil,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type DvrRecord = {
  id: number;
  state: string;
  branch: string;
  branchCameraCount: number | null;
  noOfRecordingCamera: number | null;
  noOfNotWorkingCamera: number | null;
  lastRecording: string | null;
  activityDate: string;
  totalRecordingDay: number | null;
  remark: string | null;
  status: string;
};

function getISTDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function calcTotalDays(lastRecording: string | null, activityDate: string): number | null {
  if (!lastRecording) return null;
  const last = new Date(lastRecording).getTime();
  const activity = new Date(activityDate).getTime();
  if (isNaN(last) || isNaN(activity)) return null;
  const diff = Math.round((activity - last) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

type EditableCellProps = {
  value: string | number | null;
  onSave: (val: string) => void;
  type?: "text" | "number" | "date";
  align?: "left" | "center";
};

function EditableCellInner({ value, onSave, type = "text", align = "left" }: EditableCellProps) {
  const savedRef = useRef(value != null ? String(value) : "");
  const [localVal, setLocalVal] = useState(value != null ? String(value) : "");

  const handleBlur = useCallback(() => {
    if (localVal !== savedRef.current) {
      savedRef.current = localVal;
      onSave(localVal);
    }
  }, [localVal, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") { setLocalVal(savedRef.current); e.currentTarget.blur(); }
  };

  return (
    <input
      type={type}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={[
        "w-full bg-white dark:bg-muted/20 border border-border rounded px-2 py-1 text-xs",
        "focus:bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
        "hover:border-primary/50 transition-colors cursor-text",
        align === "center" ? "text-center" : "text-left",
      ].join(" ")}
      placeholder="—"
      style={{ minWidth: 60 }}
    />
  );
}
const EditableCell = memo(EditableCellInner);

async function generateDvrPDF(records: DvrRecord[], date: string) {
  const COMPANY_NAME = "Light Finance";
  const PORTAL_NAME = "CCTV Monitoring Portal";
  const REPORT_TITLE = "DVR Storage Activity Report";
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

  const logo = await loadLogoBase64();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const CONTENT_TOP = HEADER_HEIGHT + 4;

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

  const rows = records.map((r, i) => [
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
    r.status === "completed" ? "✓ Completed" : "Pending",
  ]);

  autoTable(doc, {
    startY: CONTENT_TOP + 10,
    head: [["#", "State", "Branch", "Branch Camera Count", "No Of Recording Camera", "No Of Not Working Camera", "Last Recording", "Activity Date", "Total Recording Day", "Remark", "Status"]],
    body: rows,
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
    margin: { left: 10, right: 10, top: HEADER_HEIGHT + 2 },
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

  function drawWatermark(d: jsPDF, logoImg: HTMLImageElement) {
    const pW = d.internal.pageSize.getWidth();
    const pH = d.internal.pageSize.getHeight();
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
    d.addImage(wmData, "PNG", pW / 2 - 40, pH / 2 - 40, 80, 80);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const lPageW = doc.internal.pageSize.getWidth();
    const lPageH = doc.internal.pageSize.getHeight();

    if (logo) drawWatermark(doc, logo.img);

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
    doc.text(REPORT_TITLE, lPageW / 2, 11, { align: "center" });

    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.text(`${PORTAL_NAME}  |  Activity Date: ${date}`, lPageW / 2, 17, { align: "center" });

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

  doc.save(`DVR_Storage_Report_${date}.pdf`);
}

type RecordTableProps = {
  rows: DvrRecord[];
  onSave: (id: number, field: string, value: string) => void;
  onOpenRemark: (record: DvrRecord) => void;
};

function RecordTableInner({ rows, onSave, onOpenRemark }: RecordTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">#</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">State</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[130px]">Branch</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[110px]">Branch Camera Count</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[130px]">No Of Recording Camera</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[140px]">No Of Not Working Camera</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[120px]">Last Recording</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Activity Date</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[120px]">Total Recording Day</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[160px]">Remark</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {rows.map((r, idx) => (
            <tr key={r.id} className={`hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}>
              <td className="px-3 py-2 text-muted-foreground/50 font-mono">{idx + 1}</td>
              <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{r.state}</td>
              <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.branch}</td>
              <td className="px-2 py-2 text-center">
                <EditableCell value={r.branchCameraCount} type="number" align="center"
                  onSave={(v) => onSave(r.id, "branchCameraCount", v)} />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell value={r.noOfRecordingCamera} type="number" align="center"
                  onSave={(v) => onSave(r.id, "noOfRecordingCamera", v)} />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell value={r.noOfNotWorkingCamera} type="number" align="center"
                  onSave={(v) => onSave(r.id, "noOfNotWorkingCamera", v)} />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell value={r.lastRecording} type="date" align="center"
                  onSave={(v) => onSave(r.id, "lastRecording", v)} />
              </td>
              <td className="px-3 py-2 text-center text-muted-foreground">{r.activityDate}</td>
              <td className="px-3 py-2 text-center font-mono text-sm">
                {(() => {
                  const days = calcTotalDays(r.lastRecording, r.activityDate);
                  return days !== null
                    ? <span className="font-semibold text-blue-700 dark:text-blue-400">{days}</span>
                    : <span className="text-muted-foreground/40">—</span>;
                })()}
              </td>
              <td className="px-2 py-1.5">
                <button
                  onClick={() => onOpenRemark(r)}
                  className={[
                    "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-left text-xs transition-colors group",
                    r.remark
                      ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300"
                      : "bg-muted/40 hover:bg-muted border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  title="Click to edit remark"
                >
                  {r.remark
                    ? <MessageSquare className="h-3 w-3 shrink-0 text-blue-500" />
                    : <Pencil className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70" />}
                  <span className="truncate max-w-[130px]">
                    {r.remark || <span className="opacity-40">Add remark…</span>}
                  </span>
                </button>
              </td>
              <td className="px-3 py-2 text-center">
                {r.status === "completed" ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 text-[10px] gap-1">
                    <Clock className="h-3 w-3" /> Pending
                  </Badge>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="py-12 text-center text-muted-foreground text-sm">
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
const RecordTable = memo(RecordTableInner);

export default function DvrStorage() {
  const today = getISTDateStr();
  const [date, setDate] = useState(today);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [remarkDialog, setRemarkDialog] = useState<{ record: DvrRecord; text: string } | null>(null);
  const [savingRemark, setSavingRemark] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data: records = [], isLoading } = useQuery<DvrRecord[]>({
    queryKey: ["dvr-storage", date],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/dvr-storage?date=${date}`);
      if (!res.ok) throw new Error("Failed to load DVR storage records");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: string }) => {
      const res = await fetch(`${BASE}/api/dvr-storage/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Failed to update record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dvr-storage", date] });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const handleInitialize = async (mode: "new" | "update") => {
    setShowInitDialog(false);
    setInitializing(true);
    try {
      const res = await fetch(`${BASE}/api/dvr-storage/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["dvr-storage", date] });
      if (mode === "new") {
        toast({ title: `New report initialized — ${data.created} branches added (all fields cleared)` });
      } else {
        toast({
          title: data.created > 0
            ? `${data.created} new branch(es) added to existing report`
            : "All branches already present — existing data kept",
        });
      }
    } catch {
      toast({ title: "Failed to initialize", variant: "destructive" });
    } finally {
      setInitializing(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await generateDvrPDF(records, date);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDownloadExcel = () => {
    if (records.length === 0) return;
    const rows = records.map((r, i) => ({
      "#": i + 1,
      State: r.state,
      Branch: r.branch,
      "Branch Camera Count": r.branchCameraCount ?? "",
      "No Of Recording Camera": r.noOfRecordingCamera ?? "",
      "No Of Not Working Camera": r.noOfNotWorkingCamera ?? "",
      "Last Recording": r.lastRecording ?? "",
      "Activity Date": r.activityDate,
      "Total Recording Days": r.totalRecordingDay ?? "",
      Remark: r.remark ?? "",
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 5 }, { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 22 },
      { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 24 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DVR Storage");
    XLSX.writeFile(wb, `DVR_Storage_${date}.xlsx`);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setBulkUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);

      if (rows.length === 0) {
        toast({ title: "File is empty or unreadable", variant: "destructive" });
        return;
      }

      const normalized = rows.map((row) => ({
        branch: String(row["Branch"] ?? "").trim(),
        branchCameraCount: row["Branch Camera Count"] ?? null,
        noOfRecordingCamera: row["No Of Recording Camera"] ?? null,
        noOfNotWorkingCamera: row["No Of Not Working Camera"] ?? null,
        lastRecording: row["Last Recording"] ? String(row["Last Recording"]).trim() : null,
        remark: row["Remark"] ? String(row["Remark"]).trim() : null,
      }));

      const res = await fetch(`${BASE}/api/dvr-storage/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records: normalized }),
      });

      if (!res.ok) throw new Error();
      const result = await res.json() as { updated: number; skipped: number };
      queryClient.invalidateQueries({ queryKey: ["dvr-storage", date] });
      toast({
        title: `Bulk update complete — ${result.updated} updated, ${result.skipped} skipped`,
      });
    } catch {
      toast({ title: "Bulk update failed", variant: "destructive" });
    } finally {
      setBulkUploading(false);
    }
  };

  const pending = records.filter((r) => r.status === "pending");
  const completed = records.filter((r) => r.status === "completed");

  const q = search.trim().toLowerCase();
  const filteredRecords = records.filter((r) => {
    const matchesSearch = q === "" ||
      r.branch.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const filteredPending = filteredRecords.filter((r) => r.status === "pending");
  const filteredCompleted = filteredRecords.filter((r) => r.status === "completed");

  const handleSave = useCallback(
    (id: number, field: string, value: string) => {
      updateMutation.mutate({ id, field, value });
      if (field === "lastRecording") {
        const row = records.find((r) => r.id === id);
        const actDate = row?.activityDate ?? getISTDateStr();
        const days = calcTotalDays(value || null, actDate);
        updateMutation.mutate({ id, field: "totalRecordingDay", value: days !== null ? String(days) : "" });
      }
    },
    [updateMutation, records]
  );

  const handleOpenRemark = useCallback((record: DvrRecord) => {
    setRemarkDialog({ record, text: record.remark ?? "" });
  }, []);

  const handleSaveRemark = async () => {
    if (!remarkDialog) return;
    setSavingRemark(true);
    try {
      const res = await fetch(`${BASE}/api/dvr-storage/${remarkDialog.record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: remarkDialog.text }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["dvr-storage", date] });
      setRemarkDialog(null);
      toast({ title: "Remark saved" });
    } catch {
      toast({ title: "Failed to save remark", variant: "destructive" });
    } finally {
      setSavingRemark(false);
    }
  };

  const handleSendEmail = async () => {
    const toList = emailTo.split(",").map((e) => e.trim()).filter(Boolean);
    const ccList = emailCc.split(",").map((e) => e.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({ title: "Please enter at least one To email address", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch(`${BASE}/api/dvr-storage/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, to: toList, cc: ccList }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEmailDialog(false);
      setEmailTo("");
      setEmailCc("");
      toast({ title: "DVR report email sent successfully" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to send email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Initialize Confirmation Dialog */}
      <Dialog open={showInitDialog} onOpenChange={setShowInitDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Initialize DVR Report
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Records for today ({today}) may already exist. How would you like to proceed?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 pt-2">
            {/* New initialize option */}
            <button
              onClick={() => handleInitialize("new")}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 dark:border-orange-800/50 dark:hover:bg-orange-900/30 text-left transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">Fresh Initialize</p>
                <p className="text-xs text-orange-600/80 dark:text-orange-400/70 mt-0.5 leading-relaxed">
                  All existing records for today will be deleted. Fresh blank records will be created for all branches — all fields will be empty and shown as Pending.
                </p>
              </div>
            </button>

            {/* Update existing option */}
            <button
              onClick={() => handleInitialize("update")}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800/50 dark:hover:bg-blue-900/30 text-left transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <PlusCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Update Existing</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5 leading-relaxed">
                  Existing data will be kept safe. Only new branches (not yet present) will be added.
                </p>
              </div>
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => setShowInitDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remark Dialog */}
      <Dialog open={!!remarkDialog} onOpenChange={(open) => { if (!open) setRemarkDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Remark
            </DialogTitle>
            {remarkDialog && (
              <DialogDescription className="text-sm text-muted-foreground pt-0.5">
                <span className="font-semibold text-foreground">{remarkDialog.record.branch}</span>
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                {remarkDialog.record.state}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="pt-1 space-y-4">
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none placeholder:text-muted-foreground/50"
              placeholder="Write your remark here…"
              value={remarkDialog?.text ?? ""}
              onChange={(e) => setRemarkDialog((prev) => prev ? { ...prev, text: e.target.value } : null)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveRemark();
                if (e.key === "Escape") setRemarkDialog(null);
              }}
            />
            <p className="text-[11px] text-muted-foreground/50">Ctrl+Enter to save · Esc to cancel</p>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setRemarkDialog(null)}>
                Cancel
              </Button>
              {remarkDialog?.text && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setRemarkDialog((prev) => prev ? { ...prev, text: "" } : null)}
                >
                  Clear
                </Button>
              )}
              <Button size="sm" onClick={handleSaveRemark} disabled={savingRemark} className="gap-2 min-w-[80px]">
                {savingRemark ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={(open) => { if (!open) { setEmailDialog(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-blue-600" />
              Send DVR Activity Report
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-0.5">
              A PDF report for <strong>{date}</strong> will be sent. Auto email is also sent on the 15th and last day of each month.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-1 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To *</label>
              <input
                type="text"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/50"
              />
              <p className="text-[11px] text-muted-foreground/50">Multiple emails separated by commas</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CC <span className="font-normal normal-case text-muted-foreground/60">(optional)</span></label>
              <input
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                placeholder="cc@example.com, another@example.com"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/50"
                onKeyDown={(e) => { if (e.key === "Enter") handleSendEmail(); }}
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEmailDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSendEmail} disabled={sendingEmail || !emailTo.trim()} className="gap-2 min-w-[100px]">
                {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header Banner */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)",
          boxShadow: "0 4px 24px rgba(30, 64, 175, 0.25)",
        }}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/0 via-blue-400/60 to-blue-500/0" />
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
              <HardDrive className="h-6 w-6 text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">DVR Storage</h1>
              <p className="text-blue-200/70 text-sm mt-0.5">
                Branch-wise DVR recording status — {date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[72px]">
              <p className="text-2xl font-extrabold text-white">{records.length}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Branches</p>
            </div>
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[72px]">
              <p className="text-2xl font-extrabold text-green-300">{completed.length}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Completed</p>
            </div>
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[72px]">
              <p className="text-2xl font-extrabold text-orange-300">{pending.length}</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Pending</p>
            </div>

            <Button
              className="gap-2 bg-white/15 text-white hover:bg-white/25 border border-white/20 h-10"
              onClick={() => setShowInitDialog(true)}
              disabled={initializing || date !== today}
              title={date !== today ? "Initialize only available for today" : "Initialize report for today"}
            >
              {initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Initialize
            </Button>

            {/* Bulk Update */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleBulkUpload}
            />
            <Button
              className="gap-2 bg-white/15 text-white hover:bg-white/25 border border-white/20 h-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkUploading || records.length === 0}
              title="Upload Excel/CSV to bulk update records"
            >
              {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Bulk Update
            </Button>

            {/* Bulk Download Excel */}
            <Button
              className="gap-2 bg-white/15 text-white hover:bg-white/25 border border-white/20 h-10"
              onClick={handleDownloadExcel}
              disabled={records.length === 0}
              title="Download data as Excel"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>

            {/* Send Email */}
            <Button
              className="gap-2 bg-white/15 text-white hover:bg-white/25 border border-white/20 h-10"
              onClick={() => setEmailDialog(true)}
              disabled={records.length === 0}
              title="Send DVR report via email with PDF attachment"
            >
              <Mail className="h-4 w-4" />
              Send Email
            </Button>

            <Button
              className="gap-2 bg-white/90 text-blue-900 hover:bg-white border-0 font-semibold h-10"
              onClick={handleExportPDF}
              disabled={exportingPDF || records.length === 0}
            >
              {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Date selector + Search/Filter */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4 px-5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary h-8"
            />
            <Button size="sm" variant="outline" className="h-8" onClick={() => setDate(today)}>
              Today
            </Button>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            {/* Search box */}
            <div className="relative flex items-center">
              <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branch or state…"
                className="pl-7 pr-7 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary h-8 w-52"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "completed")}
              className="px-2 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary h-8 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>

            {(search || statusFilter !== "all") && (
              <span className="text-xs text-muted-foreground">
                {filteredRecords.length} of {records.length} shown
              </span>
            )}

            <span className="text-xs text-muted-foreground/60 ml-auto hidden lg:block">
              Use Tab key to move to the next field. All fields filled → auto Completed.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-3.5 w-3.5" />
            Pending <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{completed.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{records.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800/40">
                <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">DVR Storage Records</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {isLoading
                    ? "Loading..."
                    : filteredRecords.length < records.length
                      ? `${filteredRecords.length} of ${records.length} branches · ${date}`
                      : `${records.length} branch${records.length !== 1 ? "es" : ""} · ${date}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center">
                  <HardDrive className="h-7 w-7 text-blue-400/50" />
                </div>
                <p className="text-base font-semibold text-blue-700 dark:text-blue-400">No records for this date</p>
                <p className="text-sm text-muted-foreground">Click <strong>Initialize</strong> to create records for all branches.</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No results found — try changing the search or filter.
              </div>
            ) : (
              <>
                <TabsContent value="pending" className="mt-0">
                  <RecordTable rows={filteredPending} onSave={handleSave} onOpenRemark={handleOpenRemark} />
                </TabsContent>
                <TabsContent value="completed" className="mt-0">
                  <RecordTable rows={filteredCompleted} onSave={handleSave} onOpenRemark={handleOpenRemark} />
                </TabsContent>
                <TabsContent value="all" className="mt-0">
                  <RecordTable rows={filteredRecords} onSave={handleSave} onOpenRemark={handleOpenRemark} />
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
