import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDeviceStats,
  useRefreshDeviceStatuses,
  getGetDeviceStatsQueryKey,
  getListDevicesQueryKey,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import {
  MonitorCheck,
  MonitorX,
  RefreshCw,
  ServerCrash,
  Wifi,
  WifiOff,
  HelpCircle,
  ArrowRight,
  Activity,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const COLORS = {
  online: "#22c55e",
  offline: "#ef4444",
  unknown: "#f59e0b",
};

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: CustomLabelProps) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nextRefresh, setNextRefresh] = useState(60);

  const { data: stats, isLoading: statsLoading } = useGetDeviceStats({
    query: { queryKey: getGetDeviceStatsQueryKey() },
  });

  const refreshMutation = useRefreshDeviceStatuses({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetDeviceStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        toast({ title: "Refresh Complete", description: data.message });
        setNextRefresh(60);
      },
      onError: () => {
        setNextRefresh(60);
      },
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (nextRefresh === 0 && !refreshMutation.isPending) {
      refreshMutation.mutate(undefined);
    }
  }, [nextRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const online = stats?.online ?? 0;
  const offline = stats?.offline ?? 0;
  const unknown = stats?.unknown ?? 0;
  const total = stats?.total ?? 0;

  const chartData = [
    { name: "Online", value: online, color: COLORS.online },
    { name: "Offline", value: offline, color: COLORS.offline },
    { name: "Unknown", value: unknown, color: COLORS.unknown },
  ].filter((d) => d.value > 0);

  const uptime = total > 0 ? ((online / total) * 100).toFixed(1) : "0.0";
  const timerDisplay = `${Math.floor(nextRefresh / 60)}:${(nextRefresh % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* ── Header Banner — professional dark navy gradient ── */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)",
          boxShadow: "0 4px 24px rgba(30, 64, 175, 0.25)",
        }}
      >
        {/* Subtle decorative circles */}
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400/8 pointer-events-none" />
        <div className="absolute right-32 -bottom-10 h-36 w-36 rounded-full bg-blue-300/6 pointer-events-none" />
        <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/4 pointer-events-none" />

        {/* Top accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/0 via-blue-400/60 to-blue-500/0" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15 backdrop-blur-sm">
              <Activity className="h-6 w-6 text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">CCTV Operations Dashboard</h1>
              <p className="text-blue-200/70 text-sm mt-0.5">
                Real-time monitoring of nationwide branch cameras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Timer */}
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 min-w-[110px] backdrop-blur-sm">
              <div className="flex items-center gap-1.5 justify-center mb-0.5">
                <Clock className="h-3 w-3 text-blue-300" />
                <span className="text-[10px] text-blue-300 uppercase tracking-widest font-semibold">Next Refresh</span>
              </div>
              <p className="text-xl font-bold text-white font-mono">{timerDisplay}</p>
              {stats?.lastRefreshedAt && (
                <p className="text-[10px] text-blue-200/50 mt-0.5">
                  Last: {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
                </p>
              )}
            </div>

            <Button
              onClick={() => refreshMutation.mutate(undefined)}
              disabled={refreshMutation.isPending}
              className="gap-2 bg-white/90 text-blue-900 hover:bg-white border-0 font-semibold h-10 shadow-lg shadow-blue-900/20"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh Now
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total */}
        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Devices</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800/40 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                <MonitorCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{total.toLocaleString()}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Registered cameras</p>
          </CardContent>
        </Card>

        {/* Online */}
        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-green-500" />
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Online</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/40 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">{online.toLocaleString()}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {total > 0 && !statsLoading ? `${((online / total) * 100).toFixed(1)}% of total` : "Actively streaming"}
            </p>
          </CardContent>
        </Card>

        {/* Offline */}
        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <div className="h-0.5 bg-gradient-to-r from-red-400 to-rose-500" />
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Offline</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center border border-red-100 dark:border-red-800/40 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
                <WifiOff className="h-4 w-4 text-red-500 dark:text-red-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-red-500 dark:text-red-400 tracking-tight">{offline.toLocaleString()}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {total > 0 && !statsLoading ? `${((offline / total) * 100).toFixed(1)}% of total` : "Requires attention"}
            </p>
          </CardContent>
        </Card>

        {/* Unknown */}
        <Card className="border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
          <div className="h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500" />
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unknown</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center border border-amber-100 dark:border-amber-800/40 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
                <HelpCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-amber-500 dark:text-amber-400 tracking-tight">{unknown.toLocaleString()}</p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {total > 0 && !statsLoading ? `${((unknown / total) * 100).toFixed(1)}% of total` : "Status pending"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Donut Chart + Summary ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm border-slate-200 dark:border-slate-700/60">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <MonitorX className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Device Status Distribution</CardTitle>
                <CardDescription className="text-xs">Network health across all {total} branches</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {statsLoading ? (
              <div className="h-72 flex items-center justify-center">
                <Skeleton className="h-56 w-56 rounded-full" />
              </div>
            ) : total === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <ServerCrash className="h-12 w-12 opacity-20" />
                <p>No device data available. Click Refresh Now to update.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={CustomLabel}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `${val} devices (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`,
                      name,
                    ]}
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 13,
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: 12, color: "inherit", fontWeight: 500 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary Panel */}
        <Card className="lg:col-span-2 flex flex-col shadow-sm border-slate-200 dark:border-slate-700/60">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <TrendingUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Network Summary</CardTitle>
                <CardDescription className="text-xs">Status breakdown &amp; quick actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-5 pt-5">
            {/* Uptime */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Network Uptime</p>
                {!statsLoading && stats?.lastRefreshedAt && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    As of {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{uptime}%</span>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">uptime</p>
              </div>
            </div>

            {/* Status rows */}
            <div className="space-y-3">
              {[
                { label: "Online Branches", value: online, barColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", trackColor: "bg-emerald-100 dark:bg-emerald-900/30" },
                { label: "Offline Branches", value: offline, barColor: "bg-red-500", textColor: "text-red-500 dark:text-red-400", trackColor: "bg-red-100 dark:bg-red-900/30" },
                { label: "Unknown State", value: unknown, barColor: "bg-amber-400", textColor: "text-amber-500 dark:text-amber-400", trackColor: "bg-amber-100 dark:bg-amber-900/30" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${row.barColor}`} />
                      <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${row.textColor}`}>{statsLoading ? "—" : row.value}</span>
                      {total > 0 && !statsLoading && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 w-10 text-right">
                          {((row.value / total) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {!statsLoading && total > 0 && (
                    <div className={`h-1.5 w-full rounded-full ${row.trackColor} overflow-hidden`}>
                      <div
                        className={`h-full ${row.barColor} rounded-full transition-all duration-700`}
                        style={{ width: `${(row.value / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="mt-auto space-y-2 pt-2">
              {offline > 0 && (
                <Link href="/offline-report">
                  <Button
                    size="sm"
                    className="w-full gap-2 justify-between h-9 bg-red-500 hover:bg-red-600 text-white border-0 shadow-sm shadow-red-200 dark:shadow-red-900/30"
                  >
                    <span>View {offline} Offline Devices</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/devices">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 justify-between h-9 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>Manage All Devices</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
