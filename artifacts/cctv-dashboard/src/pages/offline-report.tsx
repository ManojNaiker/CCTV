import { useState } from "react";
import { useListDevices } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  FileText,
  FileSpreadsheet,
  WifiOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { generateOfflinePDF } from "@/lib/pdfExport";

export default function OfflineReport() {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const { data: offlineDevices, isLoading } = useListDevices({ status: "offline" });
  const { data: allDevices } = useListDevices({});

  const total = allDevices?.length ?? 0;
  const offline = offlineDevices?.length ?? 0;
  const online = total - offline;

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offline Device Report</h1>
          <p className="text-muted-foreground mt-1">
            All devices currently offline — export for reporting and escalation.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleCSVExport}
            disabled={isLoading || !offlineDevices?.length || exporting !== null}
          >
            {exporting === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
            )}
            Export CSV
          </Button>
          <Button
            className="gap-2"
            onClick={handlePDFExport}
            disabled={isLoading || !offlineDevices?.length || exporting !== null}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">Offline Devices</p>
                <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">{isLoading ? "—" : offline}</p>
              </div>
              <WifiOff className="h-8 w-8 text-red-300 dark:text-red-700" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Devices</p>
                <p className="text-3xl font-bold mt-1">{isLoading ? "—" : total}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Offline Rate</p>
                <p className="text-3xl font-bold mt-1 text-red-600">
                  {isLoading || total === 0 ? "—" : `${((offline / total) * 100).toFixed(1)}%`}
                </p>
              </div>
              <Download className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Table */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <WifiOff className="h-5 w-5" />
                Offline Devices
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? "Loading..." : `${offline} devices require attention`}
              </CardDescription>
            </div>
            {offline > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {offline} alerts
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : offlineDevices?.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
              <WifiOff className="h-12 w-12 opacity-20" />
              <p className="text-lg font-medium">No offline devices found</p>
              <p className="text-sm">All devices are currently online.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3 w-12">#</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Branch Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">State</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Serial Number</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Days Offline</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Seen</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {offlineDevices?.map((device, i) => (
                    <tr key={device.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-red-600 dark:text-red-400">{device.branchName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 text-xs">
                          {device.stateName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{device.serialNumber}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={device.offlineDays && device.offlineDays >= 3 ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {device.offlineDays ?? 0} days
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {device.lastSeenAt
                          ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground italic text-xs max-w-[200px] truncate">
                        {device.remark || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
