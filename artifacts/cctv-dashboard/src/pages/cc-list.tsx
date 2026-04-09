import { useState, useMemo } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { Search, Mail, Plus, X, Save, Pencil, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

function EmailTag({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono">
      {email}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors rounded-full"
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

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || emails.includes(trimmed)) {
      setNewEmail("");
      return;
    }
    setEmails(prev => [...prev, trimmed]);
    setNewEmail("");
    setSaveStatus("idle");
  };

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
    <div className={`border border-border/50 rounded-xl overflow-hidden transition-shadow ${editing ? "shadow-md ring-1 ring-primary/20" : ""}`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer select-none transition-colors ${editing ? "bg-primary/5" : "bg-card hover:bg-muted/30"}`}
        onClick={() => !editing && setEditing(true)}
      >
        {/* Branch info */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{device.branchName}</p>
            <p className="text-xs text-muted-foreground">{device.stateName}</p>
          </div>
        </div>

        {/* CC emails preview (collapsed) */}
        {!editing && (
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            {emails.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                {emails.slice(0, 3).map(e => (
                  <span key={e} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[11px] font-mono truncate max-w-[160px]">
                    {e}
                  </span>
                ))}
                {emails.length > 3 && (
                  <span className="text-xs text-muted-foreground font-medium">+{emails.length - 3} more</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">No CC emails</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {!editing && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={e => { e.stopPropagation(); setEditing(true); }}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
          {editing ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-4 pb-4 pt-2 bg-muted/20 border-t border-border/40 space-y-3">
          {/* Current email chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">CC Recipients</p>
            {emails.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
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
              type="email"
              placeholder="newemail@company.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
              className="h-8 text-xs flex-1 bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs shrink-0"
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
              className="h-8 gap-1.5 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
               saveStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
               saveStatus === "error" ? <XCircle className="h-3.5 w-3.5" /> :
               <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : saveStatus === "success" ? "Saved!" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={handleCancel} disabled={saving}>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branch CC List</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage per-branch CC email addresses. These will be CC'd on offline alert emails.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-center px-4 py-2 rounded-lg border bg-card">
            <p className="text-lg font-bold">{devices?.length ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Branches</p>
          </div>
          <div className="text-center px-4 py-2 rounded-lg border bg-blue-50 border-blue-200">
            <p className="text-lg font-bold text-blue-700">{totalWithCc}</p>
            <p className="text-[10px] text-blue-500 uppercase tracking-wider">With CC</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by branch, state or email..."
                className="pl-8 h-8 text-xs bg-background/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background/50">
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
        </CardContent>
      </Card>

      {/* Branch List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
          <Mail className="h-8 w-8 mb-2" />
          <p className="text-sm">No branches found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([state, branches]) => (
            <div key={state}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{state}</h2>
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground/50">{branches.length} branch{branches.length !== 1 ? "es" : ""}</span>
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
