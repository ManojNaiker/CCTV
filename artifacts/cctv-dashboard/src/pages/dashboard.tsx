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
  online: "#4ade80",
  offline: "#fb7185",
  unknown: "#fb923c",
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
    <text x={x} y={y} fill="#78350f" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
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
      {/* ── Header Banner — warm amber/orange gradient ── */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg relative"
        style={{ background: "linear-gradient(135deg, #78350f 0%, #b45309 45%, #d97706 100%)" }}
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">CCTV Operations Dashboard</h1>
              <p className="text-amber-100 text-sm mt-0.5">
                Real-time monitoring of nationwide branch cameras.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Timer */}
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 min-w-[110px]">
              <div className="flex items-center gap-1.5 justify-center mb-0.5">
                <Clock className="h-3 w-3 text-amber-200" />
                <span className="text-[10px] text-amber-200 uppercase tracking-widest font-semibold">Next Refresh</span>
              </div>
              <p className="text-xl font-bold text-white font-mono">{timerDisplay}</p>
              {stats?.lastRefreshedAt && (
                <p className="text-[10px] text-amber-200/60 mt-0.5">
                  Last: {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
                </p>
              )}
            </div>

            <Button
              onClick={() => refreshMutation.mutate(undefined)}
              disabled={refreshMutation.isPending}
              className="gap-2 bg-white text-amber-800 hover:bg-amber-50 border-0 font-semibold h-10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh Now
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total — warm amber/gold */}
        <Card className="border-amber-200 dark:border-amber-800/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Total Devices</p>
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <MonitorCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-amber-800 dark:text-amber-300">{total.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        {/* Online */}
        <Card className="border-emerald-200 dark:border-emerald-800/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-300 to-green-400" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Online</p>
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center">
                <Wifi className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{online.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        {/* Offline */}
        <Card className="border-rose-200 dark:border-rose-800/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-rose-300 to-pink-400" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Offline</p>
              <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center">
                <WifiOff className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-rose-500 dark:text-rose-400">{offline.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>

        {/* Unknown */}
        <Card className="border-amber-200 dark:border-amber-800/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-300 to-orange-400" />
          <CardContent className="pt-4 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Unknown</p>
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/40 flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
            {statsLoading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{unknown.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Donut Chart + Summary ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-sm border-amber-100 dark:border-amber-900/30">
          <CardHeader className="border-b border-amber-100 dark:border-amber-900/30 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MonitorX className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Device Status Distribution</CardTitle>
                <CardDescription>Network health across all {total} branches</CardDescription>
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
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    labelLine={false}
                    label={CustomLabel}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `${val} devices (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`,
                      name,
                    ]}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend
                    iconType="circle"
                    formatter={(value) => (
                      <span style={{ fontSize: 13, color: "inherit" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Summary Panel */}
        <Card className="lg:col-span-2 flex flex-col shadow-sm border-amber-100 dark:border-amber-900/30">
          <CardHeader className="border-b border-amber-100 dark:border-amber-900/30 pb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Activity className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Network Summary</CardTitle>
                <CardDescription>Status breakdown &amp; quick actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4 pt-4">
            {/* Uptime */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border border-amber-200 dark:border-amber-800/50"
              style={{ background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)" }}
            >
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Network Uptime</p>
                {!statsLoading && stats?.lastRefreshedAt && (
                  <p className="text-[10px] text-amber-700/70 mt-0.5">
                    As of {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
              <span className="text-3xl font-extrabold text-amber-800">{uptime}%</span>
            </div>

            {/* Status rows */}
            <div className="space-y-2.5">
              {[
                { label: "Online Branches", value: online, barColor: "bg-emerald-400", textColor: "text-emerald-600 dark:text-emerald-400" },
                { label: "Offline Branches", value: offline, barColor: "bg-rose-400", textColor: "text-rose-500 dark:text-rose-400" },
                { label: "Unknown State", value: unknown, barColor: "bg-amber-400", textColor: "text-amber-600 dark:text-amber-400" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${row.barColor}`} />
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${row.textColor}`}>{statsLoading ? "—" : row.value}</span>
                      {total > 0 && !statsLoading && (
                        <span className="text-xs text-muted-foreground/60 w-10 text-right">
                          {((row.value / total) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {!statsLoading && total > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${row.barColor} rounded-full transition-all`}
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
                  <Button size="sm" className="w-full gap-2 justify-between h-9 bg-rose-400 hover:bg-rose-500 text-white border-0">
                    <span>View {offline} Offline Devices</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/devices">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 justify-between h-9 border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-800/50 dark:text-amber-400 dark:hover:bg-amber-950/30"
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
