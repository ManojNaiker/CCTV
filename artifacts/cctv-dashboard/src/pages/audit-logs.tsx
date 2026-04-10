import { useState } from "react";
import { format } from "date-fns";
import { ClipboardList, Activity, ChevronLeft, ChevronRight, Download, Filter, X } from "lucide-react";
import {
  useListAuditLogs,
  getListAuditLogsQueryKey
} from "@workspace/api-client-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

const ACTION_FILTERS = [
  { label: "Create",          value: "CREATE",           color: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" },
  { label: "Update",          value: "UPDATE",           color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" },
  { label: "Delete",          value: "DELETE",           color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700" },
  { label: "Email Sent",      value: "EMAIL_SENT",       color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" },
  { label: "Report",          value: "REPORT_GENERATED", color: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-700" },
  { label: "Refresh",         value: "REFRESH",          color: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700" },
  { label: "Refresh Error",   value: "REFRESH_ERROR",    color: "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700" },
];

const ACTION_BADGE_STYLE: Record<string, string> = {
  CREATE:           "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50",
  UPDATE:           "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50",
  DELETE:           "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50",
  EMAIL_SENT:       "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50",
  REPORT_GENERATED: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800/50",
  REFRESH:          "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800/50",
  REFRESH_ERROR:    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50",
};

function getActionStyle(action: string): string {
  return ACTION_BADGE_STYLE[action.toUpperCase()] ??
    "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
}

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const queryParams = { limit, offset: page * limit, ...(activeFilter ? { action: activeFilter } : {}) };

  const { data: logsData, isLoading } = useListAuditLogs(
    queryParams,
    { query: { queryKey: getListAuditLogsQueryKey(queryParams) } }
  );

  const total = logsData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleFilterChange = (value: string) => {
    setPage(0);
    setActiveFilter(prev => prev === value ? undefined : value);
  };

  const handleClearFilter = () => {
    setPage(0);
    setActiveFilter(undefined);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ limit: "5000", offset: "0" });
      if (activeFilter) params.set("action", activeFilter);

      const res = await fetch(`${BASE}/api/audit-logs?${params.toString()}`);
      const data = await res.json() as { items: Array<{ id: number; username: string | null; action: string; entityType: string | null; entityId: string | null; description: string | null; createdAt: string }> };

      const headers = ["ID", "Timestamp", "User", "Action", "Entity Type", "Entity ID", "Description"];
      const rows = data.items.map(log => [
        log.id,
        format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss"),
        log.username ?? "system",
        log.action,
        log.entityType ?? "",
        log.entityId ?? "",
        `"${(log.description ?? "").replace(/"/g, '""')}"`,
      ]);

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = activeFilter ? activeFilter.toLowerCase().replace(/_/g, "-") : "all";
      a.download = `audit-logs-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg relative"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)" }}>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs</h1>
              <p className="text-slate-300 text-sm mt-0.5">Complete record of all system changes and user actions.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 min-w-[80px]">
              {isLoading
                ? <div className="h-7 w-10 bg-white/20 animate-pulse rounded mx-auto mb-1" />
                : <p className="text-2xl font-extrabold text-white">{total}</p>}
              <p className="text-[10px] text-slate-300 uppercase tracking-widest font-semibold">
                {activeFilter ? "Filtered" : "Total"} Entries
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white h-10"
              onClick={handleExportCSV}
              disabled={exporting || isLoading || total === 0}
            >
              {exporting
                ? <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Download className="h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Action Filter Bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
          <Filter className="h-3.5 w-3.5" />
          Filter:
        </div>

        <button
          onClick={handleClearFilter}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            activeFilter === undefined
              ? "bg-foreground text-background border-foreground shadow-sm"
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          }`}
        >
          All
        </button>

        {ACTION_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              activeFilter === f.value
                ? `${f.color} shadow-sm ring-1 ring-current/30`
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}

        {activeFilter && (
          <button
            onClick={handleClearFilter}
            className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Clear filter
          </button>
        )}
      </div>

      {/* ── Logs Table ── */}
      <Card className="shadow-sm overflow-hidden">
        <div className="border-b border-border/40 bg-muted/30 px-6 py-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isLoading
              ? "Loading..."
              : total === 0
              ? "No entries found"
              : `Showing ${page * limit + 1}–${Math.min((page + 1) * limit, total)} of ${total} entries${activeFilter ? ` (filtered: ${activeFilter})` : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[200px]">Timestamp</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[130px]">User</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[160px]">Action</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full max-w-xs" /></TableCell>
                  </TableRow>
                ))
              ) : logsData?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-1">
                        <ClipboardList className="h-7 w-7 text-muted-foreground/30" />
                      </div>
                      <p className="font-medium">No audit logs{activeFilter ? ` for "${activeFilter}"` : ""}</p>
                      {activeFilter && (
                        <button onClick={handleClearFilter} className="text-xs text-primary hover:underline">
                          Clear filter to see all logs
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logsData?.items.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="pl-6 py-3.5">
                      <p className="text-xs font-mono text-foreground/80">{format(new Date(log.createdAt), "dd MMM yyyy")}</p>
                      <p className="text-xs font-mono text-muted-foreground/60">{format(new Date(log.createdAt), "HH:mm:ss")}</p>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                            {(log.username || "S").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-sm">{log.username || <span className="text-muted-foreground italic text-xs">System</span>}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={`font-mono text-xs font-semibold ${getActionStyle(log.action)}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-3.5 max-w-xs">
                      {log.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination footer */}
        {!isLoading && totalPages > 1 && (
          <div className="border-t border-border/40 px-6 py-3 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {total} entries • {limit} per page{activeFilter ? ` • Filter: ${activeFilter}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
