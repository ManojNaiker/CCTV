import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HardDrive,
  FileText,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder = "—",
}: {
  value: string | number | null;
  onSave: (val: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    setEditing(false);
    onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full px-1.5 py-0.5 text-xs border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        style={{ minWidth: 60 }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:bg-muted/60 px-1.5 py-0.5 rounded text-xs block truncate ${
        value == null || value === "" ? "text-muted-foreground/40 italic" : ""
      }`}
      title={value != null && value !== "" ? String(value) : "Click to edit"}
    >
      {value != null && value !== "" ? String(value) : placeholder}
    </span>
  );
}

function generateDvrPDF(records: DvrRecord[], date: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Light Finance — DVR Storage Report", 14, 9);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Activity Date: ${date}   |   Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, 14, 16);

  const completed = records.filter((r) => r.status === "completed");
  const pending = records.filter((r) => r.status === "pending");

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
    startY: 26,
    head: [["#", "State", "Branch", "Camera Count", "Recording Cameras", "Not Working", "Last Recording", "Activity Date", "Total Days", "Remark", "Status"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 26 },
      7: { cellWidth: 22 },
      8: { cellWidth: 18 },
      9: { cellWidth: 28 },
      10: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.column.index === 10 && data.section === "body") {
        const val = String(data.cell.raw);
        if (val.includes("Completed")) {
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
    `Total: ${records.length}  |  Completed: ${completed.length}  |  Pending: ${pending.length}`,
    14,
    finalY + 8
  );

  doc.save(`DVR_Storage_Report_${date}.pdf`);
}

export default function DvrStorage() {
  const today = getISTDateStr();
  const [date, setDate] = useState(today);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [initializing, setInitializing] = useState(false);

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

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`${BASE}/api/dvr-storage/initialize`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["dvr-storage", date] });
      toast({ title: `${data.created} new branch records created` });
    } catch {
      toast({ title: "Failed to initialize", variant: "destructive" });
    } finally {
      setInitializing(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      generateDvrPDF(records, date);
    } finally {
      setExportingPDF(false);
    }
  };

  const pending = records.filter((r) => r.status === "pending");
  const completed = records.filter((r) => r.status === "completed");

  const RecordTable = ({ rows }: { rows: DvrRecord[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">#</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">State</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[130px]">Branch</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[90px]">Camera Count</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[100px]">Recording</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[90px]">Not Working</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[110px]">Last Recording</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Activity Date</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[80px]">Total Days</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[120px]">Remark</th>
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
                <EditableCell
                  value={r.branchCameraCount}
                  type="number"
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "branchCameraCount", value: v })}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell
                  value={r.noOfRecordingCamera}
                  type="number"
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "noOfRecordingCamera", value: v })}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell
                  value={r.noOfNotWorkingCamera}
                  type="number"
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "noOfNotWorkingCamera", value: v })}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <EditableCell
                  value={r.lastRecording}
                  type="date"
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "lastRecording", value: v })}
                />
              </td>
              <td className="px-3 py-2 text-center text-muted-foreground">{r.activityDate}</td>
              <td className="px-2 py-2 text-center">
                <EditableCell
                  value={r.totalRecordingDay}
                  type="number"
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "totalRecordingDay", value: v })}
                />
              </td>
              <td className="px-2 py-2">
                <EditableCell
                  value={r.remark}
                  placeholder="Click to edit"
                  onSave={(v) => updateMutation.mutate({ id: r.id, field: "remark", value: v })}
                />
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

  return (
    <div className="space-y-6">
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
              onClick={handleInitialize}
              disabled={initializing || date !== today}
              title={date !== today ? "Initialize only available for today" : "Create records for all branches"}
            >
              {initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Initialize
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

      {/* Date selector */}
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
            <span className="text-xs text-muted-foreground/60 ml-2">
              Click any cell to edit. All fields filled → auto-moves to Completed.
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
                  {isLoading ? "Loading..." : `${records.length} branch${records.length !== 1 ? "es" : ""} · ${date}`}
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
            ) : (
              <>
                <TabsContent value="pending" className="mt-0">
                  <RecordTable rows={pending} />
                </TabsContent>
                <TabsContent value="completed" className="mt-0">
                  <RecordTable rows={completed} />
                </TabsContent>
                <TabsContent value="all" className="mt-0">
                  <RecordTable rows={records} />
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
