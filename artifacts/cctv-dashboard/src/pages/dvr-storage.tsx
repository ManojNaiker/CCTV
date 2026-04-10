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
    head: [["#", "State", "Branch", "Branch Camera Count", "No Of Recording Camera", "No Of Not Working Camera", "Last Recording", "Activity Date", "Total Recording Day", "Remark", "Status"]],
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

type RecordTableProps = {
  rows: DvrRecord[];
  onSave: (id: number, field: string, value: string) => void;
};

function RecordTableInner({ rows, onSave }: RecordTableProps) {
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
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[140px]">Remark</th>
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
              <td className="px-2 py-2 text-center">
                <EditableCell value={r.totalRecordingDay} type="number" align="center"
                  onSave={(v) => onSave(r.id, "totalRecordingDay", v)} />
              </td>
              <td className="px-2 py-2">
                <EditableCell value={r.remark}
                  onSave={(v) => onSave(r.id, "remark", v)} />
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
      generateDvrPDF(records, date);
    } finally {
      setExportingPDF(false);
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
    },
    [updateMutation]
  );

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
              Aaj ke liye ({today}) record already exist ho sakte hain. Kya karna chahte hain?
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
                <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">Naya Initialize Karo</p>
                <p className="text-xs text-orange-600/80 dark:text-orange-400/70 mt-0.5 leading-relaxed">
                  Aaj ke sabhi purane records delete ho jayenge. Sabhi branches ke liye fresh blank records banengy — sabhi fields khali rahenge aur Pending mein dikhenge.
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
                <p className="font-semibold text-sm text-blue-800 dark:text-blue-300">Purane mein Update Karo</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-0.5 leading-relaxed">
                  Jo data already fill hai woh safe rahega. Sirf naye branches (jo abhi tak nahi hain) add ho jayenge.
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
              Tab key se next field mein jayein. All fields filled → auto Completed.
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
                Koi result nahi mila — search ya filter change karein.
              </div>
            ) : (
              <>
                <TabsContent value="pending" className="mt-0">
                  <RecordTable rows={filteredPending} onSave={handleSave} />
                </TabsContent>
                <TabsContent value="completed" className="mt-0">
                  <RecordTable rows={filteredCompleted} onSave={handleSave} />
                </TabsContent>
                <TabsContent value="all" className="mt-0">
                  <RecordTable rows={filteredRecords} onSave={handleSave} />
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
