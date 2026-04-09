import { useState } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  FileText,
  FileSpreadsheet,
  WifiOff,
  AlertTriangle,
  Loader2,
  TrendingDown,
  Activity,
  MapPin,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { generateOfflinePDF } from "@/lib/pdfExport";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

export default function OfflineReport() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendingAlertId, setSendingAlertId] = useState<number | null>(null);

  const handleSendBulkAlert = async () => {
    setSendingBulk(true);
    try {
      const res = await fetch(`${BASE}/api/devices/send-bulk-alert`, { method: "POST" });
      const data = await res.json() as { success?: boolean; message?: string; error?: string; count?: number };
      if (res.ok && data.success) {
        toast({ title: data.count === 0 ? "No offline devices" : "Bulk alert sent", description: data.message });
      } else {
        toast({ title: "Failed to send", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not send bulk alert email.", variant: "destructive" });
    } finally {
      setSendingBulk(false);
    }
  };

  const handleSendAlert = async (device: { id: number; branchName: string }) => {
    setSendingAlertId(device.id);
    try {
      const res = await fetch(`${BASE}/api/devices/${device.id}/send-alert`, { method: "POST" });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        toast({ title: "Alert email sent", description: `Alert email sent for ${device.branchName}.` });
      } else {
        toast({ title: "Email send failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "An error occurred while sending the email.", variant: "destructive" });
    } finally {
      setSendingAlertId(null);
    }
  };

  const { data: offlineDevices, isLoading } = useListDevices({ status: "offline" });
  const { data: allDevices } = useListDevices({});

  const total = allDevices?.length ?? 0;
  const offline = offlineDevices?.length ?? 0;
  const online = total - offline;
  const offlineRate = total > 0 ? ((offline / total) * 100).toFixed(1) : "0.0";

  const handleCSVExport = () => {
    if (!offlineDevices?.length) return;
    setExporting("csv");

    const headers = ["S.No", "Branch Name", "State", "Serial Number", "Days Offline", "Last Seen", "Remark"];
    const rows = offlineDevices.map((d, i) => [
      i + 1,
      `"${d.branchName}"`,
      `"${d.stateName}"`,
      d.serialNumber,
      d.offlineDays ?? 0,
      d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never",
      `"${d.remark ?? ""}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offline-devices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  };

  const handlePDFExport = async () => {
    if (!offlineDevices?.length) return;
    setExporting("pdf");
    try {
      await generateOfflinePDF(offlineDevices, { total, online, offline });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg relative"
        style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #dc2626 100%)" }}>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <WifiOff className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Offline Device Report</h1>
              <p className="text-red-100 text-sm mt-0.5">
                All devices currently offline — export for reporting and escalation.
              </p>
            </div>
          </div>

          {/* Stats + Export */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 min-w-[72px]">
              {isLoading
                ? <div className="h-7 w-10 bg-white/20 animate-pulse rounded mx-auto mb-1" />
                : <p className="text-2xl font-extrabold text-white">{offline}</p>}
              <p className="text-[10px] text-red-200 uppercase tracking-widest font-semibold">Offline</p>
            </div>
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 min-w-[72px]">
              {isLoading
                ? <div className="h-7 w-10 bg-white/20 animate-pulse rounded mx-auto mb-1" />
                : <p className="text-2xl font-extrabold text-white">{offlineRate}%</p>}
              <p className="text-[10px] text-red-200 uppercase tracking-widest font-semibold">Rate</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white h-10"
                onClick={handleSendBulkAlert}
                disabled={isLoading || !offlineDevices?.length || sendingBulk}
              >
                {sendingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Alert Email
              </Button>
              <Button
                variant="outline"
                className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white h-10"
                onClick={handleCSVExport}
                disabled={isLoading || !offlineDevices?.length || exporting !== null}
              >
                {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                CSV
              </Button>
              <Button
                className="gap-2 bg-white text-red-700 hover:bg-red-50 border-0 font-semibold h-10"
                onClick={handlePDFExport}
                disabled={isLoading || !offlineDevices?.length || exporting !== null}
              >
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-200 dark:border-red-800/50 overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Offline Now</p>
              <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-red-700 dark:text-red-400">{isLoading ? "—" : offline}</p>
            <p className="text-xs text-muted-foreground mt-1">devices need attention</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-slate-400 to-slate-500" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Devices</p>
              <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
            <p className="text-3xl font-extrabold">{isLoading ? "—" : total}</p>
            <p className="text-xs text-muted-foreground mt-1">registered branches</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Offline Rate</p>
              <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
              {isLoading || total === 0 ? "—" : `${offlineRate}%`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">of all devices offline</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Device Table ── */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-base text-red-700 dark:text-red-400">Offline Devices</CardTitle>
                <CardDescription className="mt-0.5">
                  {isLoading ? "Loading..." : `${offline} device${offline !== 1 ? "s" : ""} require attention`}
                </CardDescription>
              </div>
            </div>
            {offline > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1 font-bold">
                {offline} alerts
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : offlineDevices?.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 flex items-center justify-center">
                <WifiOff className="h-7 w-7 text-green-500/50" />
              </div>
              <p className="text-base font-semibold text-green-700 dark:text-green-400">All devices are online!</p>
              <p className="text-sm text-muted-foreground">No offline devices found at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider w-10">#</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Branch Name</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">State</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Serial Number</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Days Offline</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Last Seen</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Remark</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {offlineDevices?.map((device, i) => (
                    <tr key={device.id} className="hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors">
                      <td className="px-4 py-3.5 text-muted-foreground/50 text-xs font-mono">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                            <WifiOff className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <span className="font-semibold text-red-700 dark:text-red-400">{device.branchName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {device.stateName}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{device.serialNumber}</td>
                      <td className="px-4 py-3.5">
                        <Badge
                          className={`text-xs font-semibold ${
                            device.offlineDays && device.offlineDays >= 3
                              ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50"
                              : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400"
                          }`}
                          variant="outline"
                        >
                          {device.offlineDays ?? 0}d
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">
                        {device.lastSeenAt
                          ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                          : <span className="text-muted-foreground/40 italic">Never</span>}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground italic text-xs max-w-[200px] truncate">
                        {device.remark || <span className="opacity-30 not-italic">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/50 dark:hover:bg-amber-950/30"
                          disabled={sendingAlertId === device.id}
                          onClick={() => handleSendAlert(device)}
                        >
                          {sendingAlertId === device.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Send className="h-3 w-3" />}
                          Send Alert
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export hint */}
      {!isLoading && offline > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-400">
          <Download className="h-3.5 w-3.5 shrink-0" />
          Use the <strong>CSV</strong> or <strong>PDF</strong> export buttons to download this report for sharing or escalation.
        </div>
      )}
    </div>
  );
}
