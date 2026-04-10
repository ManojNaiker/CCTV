import { useState, useMemo, useRef } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { Search, Mail, Plus, X, Save, Pencil, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, MapPin, Users, Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

function EmailTag({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
      {email}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors rounded-full"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

type ParsedRow = { branchName: string; stateName: string; ccEmails: string };
type ApplyResult = { updated: number; notFound: string[] };

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const branchIdx = header.findIndex(h => h.includes("branch"));
  const stateIdx = header.findIndex(h => h.includes("state"));
  const ccIdx = header.findIndex(h => h.includes("cc") || h.includes("email"));
  if (branchIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.match(/(".*?"|[^,]*)/g)?.map(c => c.trim().replace(/^"|"$/g, "")) ?? [];
    return {
      branchName: cols[branchIdx] ?? "",
      stateName: stateIdx >= 0 ? (cols[stateIdx] ?? "") : "",
      ccEmails: ccIdx >= 0 ? (cols[ccIdx] ?? "") : "",
    };
  }).filter(r => r.branchName);
}

function BulkUpdateDialog({ open, onClose, allDevices, onSuccess, mode = "update" }: {
  open: boolean;
  onClose: () => void;
  allDevices: any[];
  onSuccess: () => void;
  mode?: "add" | "update";
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isAdd = mode === "add";

  const handleClose = () => {
    onClose();
    setTimeout(() => { setStep("upload"); setRows([]); setResult(null); }, 300);
  };

  const downloadTemplate = () => {
    const header = "Branch Name,State Name,CC Emails";
    const csvRows = isAdd
      ? [
          // Blank template with example row
          '"Bhinder","Rajasthan","email1@company.com,email2@company.com"',
          '"Pune Main","Maharashtra",""',
        ]
      : allDevices.map(d => {
          const cc = d.ccEmails ?? "";
          return `"${d.branchName}","${d.stateName ?? ""}","${cc}"`;
        });
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isAdd ? "cc_bulk_add_template.csv" : "cc_list_update_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast({ title: "No data found", description: "The CSV appears empty or has an invalid format.", variant: "destructive" });
        return;
      }
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const body = rows.map(r => ({ branchName: r.branchName, ccEmails: r.ccEmails || null }));
      const res = await fetch(`${BASE}/api/devices/cc/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as ApplyResult & { error?: string };
      if (res.ok) {
        setResult(data);
        setStep("result");
        onSuccess();
        toast({ title: `${data.updated} branches updated`, description: data.notFound.length > 0 ? `${data.notFound.length} branch(es) not found.` : "All rows applied successfully." });
      } else {
        toast({ title: "Update failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className={`h-5 w-5 ${isAdd ? "text-green-600" : "text-blue-600"}`} />
            {isAdd ? "Bulk Add CC Emails" : "Bulk Update CC List"}
          </DialogTitle>
          <DialogDescription>
            {isAdd
              ? "Download the blank template, fill in branch names and CC emails, then upload to add CC recipients in bulk."
              : "Download the template pre-filled with current data, edit CC emails, then upload to apply all changes at once."}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-5 py-2">
            {/* Download template */}
            <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${isAdd ? "border-green-100 bg-green-50/60" : "border-blue-100 bg-blue-50/60"}`}>
              <div>
                <p className={`text-sm font-semibold ${isAdd ? "text-green-900" : "text-blue-900"}`}>Step 1 — Download Template</p>
                <p className={`text-xs mt-0.5 ${isAdd ? "text-green-700" : "text-blue-700"}`}>
                  {isAdd
                    ? "Blank CSV template — fill in Branch Name, State Name, and CC Emails (comma-separate multiple emails)."
                    : "Pre-filled with all branches and their current CC emails. Edit the CC Emails column (comma-separate multiple emails)."}
                </p>
              </div>
              <Button
                variant="outline"
                className={`gap-2 shrink-0 ${isAdd ? "border-green-300 text-green-700 hover:bg-green-100" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4" /> Download Template
              </Button>
            </div>

            {/* Upload area */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Step 2 — Upload Filled CSV</p>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-border hover:border-blue-300 hover:bg-muted/30"}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className={`h-8 w-8 mx-auto mb-3 ${dragOver ? "text-blue-500" : "text-muted-foreground/40"}`} />
                <p className="text-sm font-medium text-foreground">Click or drag &amp; drop your CSV file here</p>
                <p className="text-xs text-muted-foreground mt-1">Only .csv files are accepted</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <p className="text-sm font-semibold text-foreground">{rows.length} row{rows.length !== 1 ? "s" : ""} ready to apply</p>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setStep("upload")}>
                <Upload className="h-3.5 w-3.5" /> Upload different file
              </Button>
            </div>
            <div className="overflow-auto rounded-xl border border-border/60 min-h-0 flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">Branch Name</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">State</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider">CC Emails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.branchName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.stateName || "—"}</td>
                      <td className="px-3 py-2">
                        {row.ccEmails
                          ? <div className="flex flex-wrap gap-1">{row.ccEmails.split(",").map(e => e.trim()).filter(Boolean).map(e => (
                              <span key={e} className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium">{e}</span>
                            ))}</div>
                          : <span className="text-muted-foreground/40 italic">Clear</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-1 shrink-0">
              <Button className="gap-2" onClick={handleApply} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {applying ? "Applying..." : `Apply ${rows.length} Rows`}
              </Button>
              <Button variant="ghost" onClick={handleClose} disabled={applying}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">{result.updated} branch{result.updated !== 1 ? "es" : ""} updated successfully</p>
                {result.notFound.length === 0 && <p className="text-xs text-green-700 mt-0.5">All rows from the CSV were applied.</p>}
              </div>
            </div>
            {result.notFound.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-900">{result.notFound.length} branch name{result.notFound.length !== 1 ? "s" : ""} not matched</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.notFound.map(name => (
                    <Badge key={name} variant="outline" className="text-xs border-amber-300 text-amber-800 bg-amber-100">{name}</Badge>
                  ))}
                </div>
                <p className="text-xs text-amber-700 mt-2">These names did not exactly match any branch in the system. Check spelling or use the template.</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleClose}>Done</Button>
              <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); setResult(null); }}>Upload Another File</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BranchRow({ device }: { device: any }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [emails, setEmails] = useState<string[]>(() =>
    device.ccEmails
      ? device.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
      : []
  );
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const addEmails = (raw: string) => {
    // Split by comma, semicolon, space, or newline — handles paste of multiple emails
    const parts = raw
      .split(/[\s,;]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.includes("@") && s.includes("."));

    if (parts.length === 0) {
      setNewEmail("");
      return;
    }

    setEmails(prev => {
      const next = [...prev];
      for (const email of parts) {
        if (!next.includes(email)) next.push(email);
      }
      return next;
    });
    setNewEmail("");
    setSaveStatus("idle");
  };

  const addEmail = () => addEmails(newEmail);

  const removeEmail = (email: string) => {
    setEmails(prev => prev.filter(e => e !== email));
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`${BASE}/api/devices/${device.id}/cc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ccEmails: emails.join(", ") || null }),
      });
      if (res.ok) {
        setSaveStatus("success");
        toast({ title: "CC list updated", description: `CC list saved for ${device.branchName}.` });
        setTimeout(() => { setEditing(false); setSaveStatus("idle"); }, 1000);
      } else {
        setSaveStatus("error");
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch {
      setSaveStatus("error");
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEmails(
      device.ccEmails
        ? device.ccEmails.split(",").map((e: string) => e.trim()).filter(Boolean)
        : []
    );
    setNewEmail("");
    setSaveStatus("idle");
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
      editing
        ? "border-amber-300/60 shadow-md ring-1 ring-amber-200/40 bg-white dark:bg-card"
        : "border-border/60 bg-white dark:bg-card hover:border-amber-200 hover:shadow-sm"
    }`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none transition-colors ${
          editing ? "bg-amber-50/60 border-b border-amber-100 dark:bg-amber-950/20" : ""
        }`}
        onClick={() => !editing && setEditing(true)}
      >
        {/* Mail icon */}
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
          emails.length > 0
            ? "bg-amber-100 border border-amber-200"
            : "bg-muted border border-border/50"
        }`}>
          <Mail className={`h-5 w-5 ${emails.length > 0 ? "text-amber-600" : "text-muted-foreground/50"}`} />
        </div>

        {/* Branch name + state */}
        <div className="min-w-0 w-44 shrink-0">
          <p className="font-bold text-sm text-foreground truncate">{device.branchName}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{device.stateName}</p>
          </div>
        </div>

        {/* CC emails preview (collapsed) */}
        {!editing && (
          <div className="flex-1 min-w-0">
            {emails.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {emails.slice(0, 3).map(e => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium truncate max-w-[220px]"
                  >
                    <Mail className="h-2.5 w-2.5 shrink-0" />
                    {e}
                  </span>
                ))}
                {emails.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted border border-border text-xs text-muted-foreground font-medium">
                    +{emails.length - 3} more
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/40 italic">No CC emails configured</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2 ml-auto">
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={e => { e.stopPropagation(); setEditing(true); }}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
          {editing
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-5 pb-5 pt-4 bg-muted/20 space-y-4">
          {/* Current email chips */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CC Recipients</p>
            {emails.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {emails.map(email => (
                  <EmailTag key={email} email={email} onRemove={() => removeEmail(email)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">No CC emails — add one below.</p>
            )}
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="email@company.com or paste multiple"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); addEmail(); } }}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text");
                addEmails(pasted);
              }}
              className="h-9 text-sm flex-1 bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-sm px-4 shrink-0"
              onClick={addEmail}
              disabled={!newEmail.trim() || !newEmail.includes("@")}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-9 gap-1.5 px-5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
               saveStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
               saveStatus === "error" ? <XCircle className="h-3.5 w-3.5" /> :
               <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : saveStatus === "success" ? "Saved!" : "Save Changes"}
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-4 text-muted-foreground" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CcList() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);

  const { data: devices, isLoading, refetch } = useListDevices({});

  const states = useMemo(() => {
    if (!devices) return [];
    const set = new Set(devices.map((d: any) => d.stateName));
    return Array.from(set).sort() as string[];
  }, [devices]);

  const filtered = useMemo(() => {
    if (!devices) return [];
    return devices.filter((d: any) => {
      const matchesSearch =
        !search ||
        d.branchName.toLowerCase().includes(search.toLowerCase()) ||
        d.stateName.toLowerCase().includes(search.toLowerCase()) ||
        (d.ccEmails ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesState = stateFilter === "all" || d.stateName === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [devices, search, stateFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of filtered) {
      if (!map[d.stateName]) map[d.stateName] = [];
      map[d.stateName].push(d);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalWithCc = useMemo(() => (devices ?? []).filter((d: any) => d.ccEmails).length, [devices]);
  const totalBranches = devices?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <div
        className="rounded-2xl text-white p-6 shadow-lg relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #78350f 0%, #b45309 45%, #d97706 100%)" }}
      >
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 top-12 h-24 w-24 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Branch CC List</h1>
              <p className="text-amber-100 text-sm mt-0.5 max-w-md">
                Manage per-branch CC email addresses. These will be CC'd on all offline alert emails.
              </p>
            </div>
          </div>

          {/* Right side: action buttons + stats */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 bg-white/8 border-white/20 text-white hover:bg-white/15 hover:text-white h-10"
              onClick={() => setBulkAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Bulk Add
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white/8 border-white/20 text-white hover:bg-white/15 hover:text-white h-10"
              onClick={() => setBulkOpen(true)}
            >
              <Upload className="h-4 w-4" /> Bulk Update
            </Button>
            <div className="w-px h-8 bg-white/20 mx-1 hidden sm:block" />
            <div className="text-center px-5 py-3 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm min-w-[80px]">
              {isLoading
                ? <div className="h-7 w-8 bg-white/20 rounded animate-pulse mx-auto mb-1" />
                : <p className="text-2xl font-extrabold">{totalBranches}</p>
              }
              <p className="text-[10px] text-amber-100 uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1 justify-center">
                <Users className="h-2.5 w-2.5" /> Branches
              </p>
            </div>
            <div className="text-center px-5 py-3 rounded-xl bg-white/25 border border-white/30 backdrop-blur-sm min-w-[80px]">
              {isLoading
                ? <div className="h-7 w-8 bg-white/20 rounded animate-pulse mx-auto mb-1" />
                : <p className="text-2xl font-extrabold">{totalWithCc}</p>
              }
              <p className="text-[10px] text-amber-100 uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1 justify-center">
                <Mail className="h-2.5 w-2.5" /> With CC
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by branch, state or email..."
            className="pl-9 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Branch List ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium">No branches found</p>
          <p className="text-xs mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([state, branches]) => (
            <div key={state}>
              {/* State group header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-5 w-5 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">{state}</h2>
                </div>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium shrink-0">
                  {branches.length} branch{branches.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {branches.map(device => (
                  <BranchRow key={device.id} device={device} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bulk Update Dialog ── */}
      <BulkUpdateDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        allDevices={devices ?? []}
        onSuccess={refetch}
        mode="update"
      />

      {/* ── Bulk Add Dialog ── */}
      <BulkUpdateDialog
        open={bulkAddOpen}
        onClose={() => setBulkAddOpen(false)}
        allDevices={devices ?? []}
        onSuccess={refetch}
        mode="add"
      />
    </div>
  );
}
