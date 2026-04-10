import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { generateStatusReportPDF } from "@/lib/pdfExport";

type HistoryRecord = {
  deviceId: number;
  serialNumber: string;
  branchName: string;
  stateName: string;
  date: string;
  status: string;
};

type TimelineEvent = {
  minuteOfDay: number;
  status: string;
};

type TimelineRecord = {
  deviceId: number;
  serialNumber: string;
  branchName: string;
  stateName: string;
  date: string;
  events: TimelineEvent[];
};

type Segment = {
  startMinute: number;
  endMinute: number;
  status: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function logReportEvent(description: string) {
  try {
    await fetch(`${BASE}/api/audit-logs/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REPORT_GENERATED", entityType: "report", entityId: "status-report", description }),
    });
  } catch {
    // Non-fatal
  }
}

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

function minutesToTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function eventsToSegments(events: TimelineEvent[]): Segment[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.minuteOfDay - b.minuteOfDay);
  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].minuteOfDay;
    const end = i + 1 < sorted.length ? sorted[i + 1].minuteOfDay : 1440;
    segments.push({ startMinute: start, endMinute: end, status: sorted[i].status });
  }
  // If first event doesn't start at 0, prepend an "unknown" from 0 to first event
  if (sorted[0].minuteOfDay > 0) {
    segments.unshift({ startMinute: 0, endMinute: sorted[0].minuteOfDay, status: "unknown" });
  }
  return segments;
}

const STATUS_COLOR: Record<string, { bg: string; label: string }> = {
  online:  { bg: "#22c55e", label: "Online"  },
  offline: { bg: "#ef4444", label: "Offline" },
  unknown: { bg: "transparent", label: "Unknown" },
};

const DAY_TICKS = [
  { minute: 0,    label: "12AM" },
  { minute: 360,  label: "6AM"  },
  { minute: 720,  label: "12PM" },
  { minute: 1080, label: "6PM"  },
  { minute: 1440, label: "12AM" },
];

function TimelineBar({ events }: { events: TimelineEvent[] | undefined }) {
  const segments = events && events.length > 0 ? eventsToSegments(events) : [];

  return (
    <div className="w-full" style={{ minWidth: 80 }}>
      {/* Outer rounded wrapper — clips nothing, just for visual rounding */}
      <div className="relative w-full" style={{ height: 18 }}>
        {/* Gray background track — no border-radius so segments start exactly at 0% */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.07)" }}
        />
        {/* Online / Offline segments — no orange for unknown */}
        {segments
          .filter((seg) => seg.status === "online" || seg.status === "offline")
          .map((seg, i) => {
            const leftPct = (seg.startMinute / 1440) * 100;
            const widthPct = ((seg.endMinute - seg.startMinute) / 1440) * 100;
            const color = seg.status === "online" ? "#22c55e" : "#ef4444";
            const label = seg.status === "online" ? "Online" : "Offline";
            const title = `${label}: ${minutesToTimeLabel(seg.startMinute)} – ${minutesToTimeLabel(seg.endMinute)}`;
            return (
              <div
                key={i}
                title={title}
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.max(widthPct, 0.3)}%`,
                  background: color,
                }}
              />
            );
          })}
        {/* Hour tick marks at 6AM, 12PM, 6PM — exact pixel alignment with labels */}
        {[360, 720, 1080].map((min) => (
          <div
            key={min}
            className="absolute top-0 h-full pointer-events-none"
            style={{
              left: `${(min / 1440) * 100}%`,
              width: 1,
              background: "rgba(255,255,255,0.6)",
              zIndex: 2,
              transform: "translateX(-0.5px)",
            }}
          />
        ))}
      </div>
      {/* Time ruler — same percentage positions as segments above */}
      <div className="relative w-full" style={{ height: 13 }}>
        {DAY_TICKS.map((t) => (
          <span
            key={t.minute}
            className="absolute text-[8px] text-muted-foreground/50 leading-none select-none"
            style={{
              left: `${(t.minute / 1440) * 100}%`,
              top: 2,
              transform:
                t.minute === 0
                  ? "none"
                  : t.minute === 1440
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 Days", days: 6 },
  { label: "Last 14 Days", days: 13 },
  { label: "Last 30 Days", days: 29 },
];

function getPresetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: getISTDateStr(from), to: getISTDateStr(to) };
}

const MAX_DATES = 14;

export default function StatusReport() {
  const today = getISTDateStr(new Date());

  const [activePreset, setActivePreset] = useState<number>(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);

  const { from, to } = useMemo(() => {
    if (isCustom && customFrom && customTo) return { from: customFrom, to: customTo };
    return getPresetRange(PRESETS[activePreset].days);
  }, [activePreset, isCustom, customFrom, customTo]);

  // Legacy per-day records for summary stats and PDF
  const { data: records = [], isLoading } = useQuery<HistoryRecord[]>({
    queryKey: ["status-history", from, to],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/devices/status-history?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load status history");
      return res.json();
    },
    enabled: !!(from && to),
  });

  // Timeline data for the segmented bars
  const { data: timelineData = [] } = useQuery<TimelineRecord[]>({
    queryKey: ["status-timeline", from, to],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/devices/status-timeline?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load status timeline");
      return res.json();
    },
    enabled: !!(from && to),
  });

  const dateRange = useMemo(() => generateDateRange(from, to), [from, to]);

  const devices = useMemo(() => {
    const map = new Map<string, { deviceId: number; serialNumber: string; branchName: string; stateName: string }>();
    for (const r of records) {
      if (!map.has(r.serialNumber))
        map.set(r.serialNumber, { deviceId: r.deviceId, serialNumber: r.serialNumber, branchName: r.branchName, stateName: r.stateName });
    }
    return Array.from(map.values()).sort((a, b) => a.branchName.localeCompare(b.branchName));
  }, [records]);

  // Timeline lookup: serialNumber::date -> events[]
  const timelineMap = useMemo(() => {
    const m = new Map<string, TimelineEvent[]>();
    for (const t of timelineData) {
      m.set(`${t.serialNumber}::${t.date}`, t.events);
    }
    return m;
  }, [timelineData]);

  // Day-level status map (for summary % row)
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of records) m.set(`${r.serialNumber}::${r.date}`, r.status);
    return m;
  }, [records]);

  const daySummaries = useMemo(() =>
    dateRange.map((date) => {
      let online = 0, offline = 0, unknown = 0, noData = 0;
      for (const d of devices) {
        const s = statusMap.get(`${d.serialNumber}::${date}`);
        if (!s) noData++;
        else if (s === "online") online++;
        else if (s === "offline") offline++;
        else unknown++;
      }
      return { date, online, offline, unknown, noData };
    }), [dateRange, devices, statusMap]);

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
    const tracked = online + offline + unknown;
    return { online, offline, unknown, noData, tracked };
  }, [devices, dateRange, statusMap]);

  const uptimePct = overallStats.tracked > 0
    ? ((overallStats.online / overallStats.tracked) * 100).toFixed(1)
    : null;

  const handlePreset = (idx: number) => {
    setActivePreset(idx);
    setIsCustom(false);
    setPageOffset(0);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setIsCustom(true);
      setPageOffset(0);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await generateStatusReportPDF({ records, devices, dateRange, daySummaries, from, to });
      void logReportEvent(`Status Report exported as PDF — date range: ${from} to ${to}, ${devices.length} device(s)`);
    } finally {
      setExportingPDF(false);
    }
  };

  const visibleDates = dateRange.slice(pageOffset, pageOffset + MAX_DATES);
  const canPrev = pageOffset > 0;
  const canNext = pageOffset + MAX_DATES < dateRange.length;

  const rangeLabel = from === to ? from : `${from} → ${to}`;

  return (
    <div className="space-y-6">

      {/* ── Header Banner ── */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)",
          boxShadow: "0 4px 24px rgba(30, 64, 175, 0.25)",
        }}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/0 via-blue-400/60 to-blue-500/0" />
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-24 -bottom-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
              <CalendarDays className="h-6 w-6 text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Status Report</h1>
              <p className="text-blue-200/70 text-sm mt-0.5">
                Timeline view of device online / offline history — {rangeLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[72px]">
              {isLoading
                ? <div className="h-7 w-10 bg-white/20 animate-pulse rounded mx-auto mb-1" />
                : <p className="text-2xl font-extrabold text-white">{devices.length}</p>}
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Devices</p>
            </div>
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[72px]">
              {isLoading
                ? <div className="h-7 w-10 bg-white/20 animate-pulse rounded mx-auto mb-1" />
                : <p className="text-2xl font-extrabold text-white">{uptimePct !== null ? `${uptimePct}%` : "—"}</p>}
              <p className="text-[10px] text-blue-200 uppercase tracking-widest font-semibold">Uptime</p>
            </div>
            <Button
              className="gap-2 bg-white/90 text-blue-900 hover:bg-white border-0 font-semibold h-10"
              onClick={handleExportPDF}
              disabled={exportingPDF || records.length === 0 || isLoading}
            >
              {exportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Date Range Controls ── */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4 px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Range:</span>
            {PRESETS.map((p, i) => (
              <Button
                key={p.label}
                variant={!isCustom && activePreset === i ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => handlePreset(i)}
              >
                {p.label}
              </Button>
            ))}

            <div className="flex items-center gap-2 ml-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Custom:</span>
              <input
                type="date"
                value={customFrom}
                max={today}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary h-8"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={today}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary h-8"
              />
              <Button
                size="sm"
                variant={isCustom ? "default" : "secondary"}
                className="h-8"
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo || customFrom > customTo}
              >
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-700/60">
          <div className="h-0.5 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Online</p>
              <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center border border-green-100 dark:border-green-800/40">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-16 mb-1" />
              : <p className="text-3xl font-extrabold text-green-600 dark:text-green-400 tracking-tight">{overallStats.online}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">device-day readings online</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-700/60">
          <div className="h-0.5 bg-gradient-to-r from-red-500 to-rose-600" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Offline</p>
              <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center border border-red-100 dark:border-red-800/40">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-16 mb-1" />
              : <p className="text-3xl font-extrabold text-red-500 dark:text-red-400 tracking-tight">{overallStats.offline}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">device-day readings offline</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden shadow-sm border-slate-200 dark:border-slate-700/60">
          <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Uptime</p>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/40">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            {isLoading
              ? <Skeleton className="h-9 w-16 mb-1" />
              : <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight">
                  {uptimePct !== null ? `${uptimePct}%` : "—"}
                </p>}
            <p className="text-xs text-muted-foreground mt-1.5">across {dateRange.length} day{dateRange.length !== 1 ? "s" : ""}, {devices.length} device{devices.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 rounded" style={{ background: "#22c55e" }} />
          Online
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 rounded" style={{ background: "#ef4444" }} />
          Offline
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 rounded" style={{ background: "rgba(0,0,0,0.07)" }} />
          No Data / Unknown
        </div>
        <span className="ml-2 text-muted-foreground/60 italic">Hover on bar to see time range</span>
      </div>

      {/* ── Calendar Grid with Timeline Bars ── */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800/40">
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Timeline Calendar</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {isLoading ? "Loading..." : records.length === 0 ? "No data for this range" : `${devices.length} device${devices.length !== 1 ? "s" : ""} · ${dateRange.length} day${dateRange.length !== 1 ? "s" : ""}`}
                </CardDescription>
              </div>
            </div>
            {dateRange.length > MAX_DATES && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {pageOffset + 1}–{Math.min(pageOffset + MAX_DATES, dateRange.length)} / {dateRange.length} days
                </span>
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={!canPrev}
                  onClick={() => setPageOffset(Math.max(0, pageOffset - MAX_DATES))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-7 w-7" disabled={!canNext}
                  onClick={() => setPageOffset(Math.min(dateRange.length - 1, pageOffset + MAX_DATES))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : records.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center">
                <CalendarDays className="h-7 w-7 text-blue-400/50" />
              </div>
              <p className="text-base font-semibold text-blue-700 dark:text-blue-400">No history for this period</p>
              <p className="text-sm text-muted-foreground">Status history is recorded on each device refresh.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 bg-muted/60 z-10 px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[140px] w-[140px]">
                      Device / Branch
                    </th>
                    {visibleDates.map((date) => {
                      const { day, weekday, month } = formatDisplayDate(date);
                      const isToday = date === today;
                      return (
                        <th key={date} className={`px-1 py-2 text-center min-w-[110px] ${isToday ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                          <div className={`font-bold text-sm ${isToday ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>{day}</div>
                          <div className={`text-[10px] ${isToday ? "text-blue-500/70" : "text-muted-foreground/60"}`}>{weekday}</div>
                          <div className={`text-[10px] ${isToday ? "text-blue-400/60" : "text-muted-foreground/40"}`}>{month}</div>
                        </th>
                      );
                    })}
                  </tr>
                  {/* Day uptime % summary row */}
                  <tr className="border-b bg-muted/20">
                    <td className="sticky left-0 bg-muted/30 z-10 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-[140px]">
                      Day Uptime
                    </td>
                    {visibleDates.map((date) => {
                      const s = daySummaries.find((d) => d.date === date);
                      const total = devices.length;
                      const onlinePct = total > 0 && s ? Math.round((s.online / total) * 100) : 0;
                      return (
                        <td key={date} className="px-1 py-1.5 text-center">
                          <span className={`text-[10px] font-bold ${onlinePct >= 80 ? "text-green-600" : "text-red-500"}`}>
                            {onlinePct}%
                          </span>
                          <div className="w-full h-1 rounded-full bg-muted mt-0.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${onlinePct >= 80 ? "bg-green-500" : "bg-red-500"}`}
                              style={{ width: `${onlinePct}%` }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {devices.map((device, idx) => (
                    <tr
                      key={device.serialNumber}
                      className={`hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
                    >
                      <td className="sticky left-0 bg-card z-10 px-4 py-3 border-r border-border/30">
                        <div className="font-semibold text-foreground truncate max-w-[170px]" title={device.branchName}>
                          {device.branchName}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{device.stateName}</div>
                        <div className="text-[10px] text-muted-foreground/50 font-mono">{device.serialNumber}</div>
                      </td>
                      {visibleDates.map((date) => {
                        const events = timelineMap.get(`${device.serialNumber}::${date}`);
                        const isToday = date === today;
                        return (
                          <td
                            key={date}
                            className={`px-2 py-3 ${isToday ? "bg-blue-50/40 dark:bg-blue-950/10" : ""}`}
                          >
                            <TimelineBar events={events} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Device Uptime Summary Table ── */}
      {devices.length > 0 && records.length > 0 && (
        <Card className="shadow-sm overflow-hidden border-slate-200 dark:border-slate-700/60">
          <CardHeader className="border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/40">
                <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Device Uptime Summary</CardTitle>
                <CardDescription className="mt-0.5 text-xs">{rangeLabel}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider w-8">#</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Branch</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">State</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Serial</th>
                    <th className="text-center font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Online Days</th>
                    <th className="text-center font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Offline Days</th>
                    <th className="text-center font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">No Data</th>
                    <th className="text-center font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Uptime %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {devices.map((device, idx) => {
                    let onlineD = 0, offlineD = 0, noDataD = 0;
                    for (const date of dateRange) {
                      const s = statusMap.get(`${device.serialNumber}::${date}`);
                      if (!s) noDataD++;
                      else if (s === "online") onlineD++;
                      else if (s === "offline") offlineD++;
                    }
                    const tracked = onlineD + offlineD;
                    const uptime = tracked > 0 ? ((onlineD / tracked) * 100).toFixed(1) : null;
                    const isGood = uptime !== null && Number(uptime) >= 80;
                    return (
                      <tr key={device.serialNumber} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5 text-muted-foreground/50 text-xs font-mono">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-semibold">{device.branchName}</td>
                        <td className="px-4 py-3.5 text-muted-foreground text-sm">{device.stateName}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{device.serialNumber}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-bold text-green-600 dark:text-green-400">{onlineD}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {offlineD > 0
                            ? <span className="font-bold text-red-500 dark:text-red-400">{offlineD}</span>
                            : <span className="text-muted-foreground/40">0</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center text-muted-foreground">{noDataD || "—"}</td>
                        <td className="px-4 py-3.5 text-center">
                          {uptime === null ? (
                            <Badge variant="secondary" className="text-[10px]">—</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${
                                isGood
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50"
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50"
                              }`}
                            >
                              {uptime}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
