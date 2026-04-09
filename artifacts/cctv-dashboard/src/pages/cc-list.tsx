import { useState, useMemo } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { Search, Mail, Plus, X, Save, Pencil, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, MapPin, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

function EmailTag({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
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
        ? "border-primary/40 shadow-md ring-1 ring-primary/10 bg-white dark:bg-card"
        : "border-border/60 bg-white dark:bg-card hover:border-border hover:shadow-sm"
    }`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none transition-colors ${
          editing ? "bg-primary/5 border-b border-border/40" : ""
        }`}
        onClick={() => !editing && setEditing(true)}
      >
        {/* Mail icon */}
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
          emails.length > 0
            ? "bg-blue-100 border border-blue-200"
            : "bg-muted border border-border/50"
        }`}>
          <Mail className={`h-5 w-5 ${emails.length > 0 ? "text-blue-600" : "text-muted-foreground/50"}`} />
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
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium truncate max-w-[220px]"
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

  const { data: devices, isLoading } = useListDevices({});

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
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 shadow-lg relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -right-4 top-12 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Branch CC List</h1>
              <p className="text-blue-100 text-sm mt-0.5 max-w-md">
                Manage per-branch CC email addresses. These will be CC'd on all offline alert emails.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-5 py-3 rounded-xl bg-white/15 border border-white/20 backdrop-blur-sm min-w-[80px]">
              {isLoading
                ? <div className="h-7 w-8 bg-white/20 rounded animate-pulse mx-auto mb-1" />
                : <p className="text-2xl font-extrabold">{totalBranches}</p>
              }
              <p className="text-[10px] text-blue-100 uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1 justify-center">
                <Users className="h-2.5 w-2.5" /> Branches
              </p>
            </div>
            <div className="text-center px-5 py-3 rounded-xl bg-white/25 border border-white/30 backdrop-blur-sm min-w-[80px]">
              {isLoading
                ? <div className="h-7 w-8 bg-white/20 rounded animate-pulse mx-auto mb-1" />
                : <p className="text-2xl font-extrabold">{totalWithCc}</p>
              }
              <p className="text-[10px] text-blue-100 uppercase tracking-widest font-semibold mt-0.5 flex items-center gap-1 justify-center">
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
                  <div className="h-5 w-5 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-blue-600 dark:text-blue-400" />
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
    </div>
  );
}
