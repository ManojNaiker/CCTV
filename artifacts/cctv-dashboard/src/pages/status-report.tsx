import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, ChevronLeft, ChevronRight, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateStatusReportPDF } from "@/lib/pdfExport";

type HistoryRecord = {
  deviceId: number;
  serialNumber: string;
  branchName: string;
  stateName: string;
  date: string;
  status: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getISTDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatDisplayDate(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit" }),
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    month: d.toLocaleDateString("en-IN", { month: "short" }),
  };
}

function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const curr = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (curr <= end) {
    dates.push(getISTDateStr(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 6 },
  { label: "Last 14 days", days: 13 },
  { label: "Last 30 days", days: 29 },
];

function getPresetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: getISTDateStr(from), to: getISTDateStr(to) };
}

function StatusCell({ status }: { status: string | undefined }) {
  if (!status) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-muted-foreground/20" title="No data" />
      </div>
    );
  }
  const colorMap: Record<string, string> = {
    online: "bg-green-500",
    offline: "bg-red-500",
    unknown: "bg-orange-400",
  };
  const labelMap: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    unknown: "Unknown",
  };
  return (
    <div className="w-full h-full flex items-center justify-center" title={labelMap[status] ?? status}>
      <div className={`w-3 h-3 rounded-full ${colorMap[status] ?? "bg-gray-400"}`} />
    </div>
  );
}

export default function StatusReport() {
  const today = getISTDateStr(new Date());
  const [activePreset, setActivePreset] = useState<number>(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const { from, to } = useMemo(() => {
    if (isCustom && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return getPresetRange(PRESETS[activePreset].days);
  }, [activePreset, isCustom, customFrom, customTo]);

  const { data: records = [], isLoading, error } = useQuery<HistoryRecord[]>({
    queryKey: ["status-history", from, to],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/devices/status-history?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load status history");
      return res.json();
    },
    enabled: !!(from && to),
  });

  const dateRange = useMemo(() => generateDateRange(from, to), [from, to]);

  const devices = useMemo(() => {
    const map = new Map<string, { deviceId: number; serialNumber: string; branchName: string; stateName: string }>();
    for (const r of records) {
      if (!map.has(r.serialNumber)) {
        map.set(r.serialNumber, { deviceId: r.deviceId, serialNumber: r.serialNumber, branchName: r.branchName, stateName: r.stateName });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [records]);

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of records) {
      m.set(`${r.serialNumber}::${r.date}`, r.status);
    }
    return m;
  }, [records]);

  const daySummaries = useMemo(() => {
    return dateRange.map((date) => {
      let online = 0, offline = 0, unknown = 0, noData = 0;
      for (const d of devices) {
        const s = statusMap.get(`${d.serialNumber}::${date}`);
        if (!s) noData++;
        else if (s === "online") online++;
        else if (s === "offline") offline++;
        else unknown++;
      }
      return { date, online, offline, unknown, noData };
    });
  }, [dateRange, devices, statusMap]);

  const overallStats = useMemo(() => {
    let online = 0, offline = 0, unknown = 0, noData = 0;
    for (const d of devices) {
      for (const date of dateRange) {
        const s = statusMap.get(`${d.serialNumber}::${date}`);
        if (!s) noData++;
        else if (s === "online") online++;
        else if (s === "offline") offline++;
        else unknown++;
      }
    }
    return { online, offline, unknown, noData, total: online + offline + unknown + noData };
  }, [devices, dateRange, statusMap]);

  const handlePreset = (idx: number) => {
    setActivePreset(idx);
    setIsCustom(false);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setIsCustom(true);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await generateStatusReportPDF({ records, devices, dateRange, daySummaries, from, to });
    } finally {
      setExportingPDF(false);
    }
  };

  const maxDatesPerPage = 14;
  const [pageOffset, setPageOffset] = useState(0);

  const visibleDates = dateRange.slice(pageOffset, pageOffset + maxDatesPerPage);
  const canPrev = pageOffset > 0;
  const canNext = pageOffset + maxDatesPerPage < dateRange.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Status Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Day-wise device online/offline history</p>
        </div>
        <Button
          onClick={handleExportPDF}
          disabled={exportingPDF || records.length === 0}
          className="gap-2"
        >
          {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export PDF
        </Button>
      </div>

      {/* Date Range Controls */}
      <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl border bg-card">
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map((p, i) => (
            <Button
              key={p.label}
              variant={!isCustom && activePreset === i ? "default" : "outline"}
              size="sm"
              onClick={() => handlePreset(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Custom:</span>
          <input
            type="date"
            value={customFrom}
            max={today}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={today}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button size="sm" variant="secondary" onClick={handleCustomApply} disabled={!customFrom || !customTo || customFrom > customTo}>
            Apply
          </Button>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {from === to ? from : `${from} → ${to}`}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Devices Tracked</div>
          <div className="text-2xl font-bold">{devices.length}</div>
          <div className="text-xs text-muted-foreground">{dateRange.length} day(s)</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Online Readings</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{overallStats.online}</div>
          <div className="text-xs text-muted-foreground">
            {overallStats.total > 0 ? ((overallStats.online / (overallStats.total - overallStats.noData)) * 100).toFixed(1) : 0}% uptime
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Offline Readings</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{overallStats.offline}</div>
          <div className="text-xs text-muted-foreground">
            {overallStats.total > 0 ? ((overallStats.offline / (overallStats.total - overallStats.noData)) * 100).toFixed(1) : 0}% downtime
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-orange-500 font-medium mb-1">Unknown</div>
          <div className="text-2xl font-bold text-orange-500">{overallStats.unknown}</div>
          <div className="text-xs text-muted-foreground">No Hik data</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500" />Online</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" />Offline</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-400" />Unknown</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-muted-foreground/20" />No Data</div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading status history...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48 text-red-500 gap-2">
            <Info className="h-4 w-4" />
            Failed to load status history
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <CalendarDays className="h-10 w-10 opacity-20" />
            <p className="text-sm">No status history for this date range.</p>
            <p className="text-xs">History is recorded when a device refresh is run.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Pagination header */}
            {dateRange.length > maxDatesPerPage && (
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  Showing days {pageOffset + 1}–{Math.min(pageOffset + maxDatesPerPage, dateRange.length)} of {dateRange.length}
                </span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!canPrev} onClick={() => setPageOffset(Math.max(0, pageOffset - maxDatesPerPage))}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={!canNext} onClick={() => setPageOffset(Math.min(dateRange.length - 1, pageOffset + maxDatesPerPage))}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <table className="w-full text-xs border-collapse">
              <thead>
                {/* Month row */}
                <tr className="border-b bg-muted/40">
                  <th className="sticky left-0 bg-muted/60 z-10 px-4 py-2 text-left font-semibold text-muted-foreground min-w-[180px]">
                    Device / Branch
                  </th>
                  {visibleDates.map((date) => {
                    const { weekday, day, month } = formatDisplayDate(date);
                    const isToday = date === today;
                    return (
                      <th key={date} className={`px-1 py-1 text-center min-w-[44px] ${isToday ? "bg-primary/10" : ""}`}>
                        <div className={`font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</div>
                        <div className={`text-[10px] ${isToday ? "text-primary/70" : "text-muted-foreground/60"}`}>{weekday}</div>
                        <div className={`text-[10px] ${isToday ? "text-primary/70" : "text-muted-foreground/40"}`}>{month}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Day summary row */}
                <tr className="border-b bg-muted/20">
                  <td className="sticky left-0 bg-muted/30 z-10 px-4 py-1.5 font-medium text-muted-foreground text-[11px]">
                    Day Summary
                  </td>
                  {visibleDates.map((date) => {
                    const s = daySummaries.find((d) => d.date === date);
                    const total = devices.length;
                    const onlinePct = total > 0 && s ? Math.round((s.online / total) * 100) : 0;
                    return (
                      <td key={date} className="px-1 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[10px] font-bold ${onlinePct >= 80 ? "text-green-600" : onlinePct >= 50 ? "text-orange-500" : "text-red-500"}`}>
                            {onlinePct}%
                          </span>
                          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${onlinePct >= 80 ? "bg-green-500" : onlinePct >= 50 ? "bg-orange-400" : "bg-red-500"}`}
                              style={{ width: `${onlinePct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Device rows */}
                {devices.map((device, idx) => (
                  <tr key={device.serialNumber} className={`border-b hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="sticky left-0 bg-card z-10 px-4 py-2 border-r">
                      <div className="font-medium text-foreground truncate max-w-[160px]" title={device.branchName}>
                        {device.branchName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{device.stateName}</div>
                      <div className="text-[10px] text-muted-foreground/50 font-mono">{device.serialNumber}</div>
                    </td>
                    {visibleDates.map((date) => {
                      const status = statusMap.get(`${device.serialNumber}::${date}`);
                      const isToday = date === today;
                      return (
                        <td key={date} className={`px-1 py-2 text-center h-12 ${isToday ? "bg-primary/5" : ""}`}>
                          <StatusCell status={status} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-device offline summary for the range */}
      {devices.length > 0 && records.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Device Uptime Summary ({from === to ? from : `${from} to ${to}`})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Branch</th>
                  <th className="text-left pb-2 font-medium">State</th>
                  <th className="text-left pb-2 font-medium">Serial</th>
                  <th className="text-center pb-2 font-medium">Online Days</th>
                  <th className="text-center pb-2 font-medium">Offline Days</th>
                  <th className="text-center pb-2 font-medium">No Data</th>
                  <th className="text-center pb-2 font-medium">Uptime %</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device, idx) => {
                  let onlineD = 0, offlineD = 0, noDataD = 0;
                  for (const date of dateRange) {
                    const s = statusMap.get(`${device.serialNumber}::${date}`);
                    if (!s) noDataD++;
                    else if (s === "online") onlineD++;
                    else if (s === "offline") offlineD++;
                  }
                  const tracked = onlineD + offlineD;
                  const uptime = tracked > 0 ? ((onlineD / tracked) * 100).toFixed(1) : "—";
                  return (
                    <tr key={device.serialNumber} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-3 font-medium">{device.branchName}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{device.stateName}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{device.serialNumber}</td>
                      <td className="py-2 text-center text-green-600 dark:text-green-400 font-semibold">{onlineD}</td>
                      <td className="py-2 text-center text-red-600 dark:text-red-400 font-semibold">{offlineD}</td>
                      <td className="py-2 text-center text-muted-foreground">{noDataD}</td>
                      <td className="py-2 text-center">
                        <Badge variant={tracked === 0 ? "secondary" : Number(uptime) >= 80 ? "default" : Number(uptime) >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                          {uptime}{tracked > 0 ? "%" : ""}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
