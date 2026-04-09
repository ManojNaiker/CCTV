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
  unknown: "#f97316",
};

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  borderClass,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  loading: boolean;
}) {
  return (
    <Card className={`${borderClass} ${bgClass} shadow-sm hover:shadow-md transition-shadow`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5">
        <CardTitle className={`text-sm font-medium text-muted-foreground`}>{title}</CardTitle>
        <Icon className={`h-5 w-5 ${colorClass} opacity-70`} />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <div className={`text-3xl font-semibold ${colorClass}`}>{value.toLocaleString()}</div>
        )}
      </CardContent>
    </Card>
  );
}

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
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nextRefresh, setNextRefresh] = useState(120);

  const { data: stats, isLoading: statsLoading } = useGetDeviceStats({
    query: { queryKey: getGetDeviceStatsQueryKey() },
  });

  const refreshMutation = useRefreshDeviceStatuses({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetDeviceStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        toast({ title: "Refresh Complete", description: data.message });
        setNextRefresh(120);
      },
    },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: getGetDeviceStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [queryClient]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">CCTV Operations Dashboard</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Real-time monitoring of nationwide branch cameras.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground text-right hidden sm:block">
            <div>
              Auto-refresh in{" "}
              <span className="font-mono text-foreground font-medium">
                {Math.floor(nextRefresh / 60)}:{(nextRefresh % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {stats?.lastRefreshedAt && (
              <div className="text-xs">
                Last checked:{" "}
                {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
              </div>
            )}
          </div>
          <Button
            onClick={() => refreshMutation.mutate(undefined)}
            disabled={refreshMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Devices"
          value={total}
          icon={MonitorCheck}
          colorClass="text-foreground"
          bgClass=""
          borderClass=""
          loading={statsLoading}
        />
        <StatCard
          title="Online"
          value={online}
          icon={Wifi}
          colorClass="text-green-700 dark:text-green-400"
          bgClass="bg-green-50 dark:bg-green-950/40"
          borderClass="border-green-200 dark:border-green-800/50"
          loading={statsLoading}
        />
        <StatCard
          title="Offline"
          value={offline}
          icon={WifiOff}
          colorClass="text-red-600 dark:text-red-400"
          bgClass="bg-red-50 dark:bg-red-950/40"
          borderClass="border-red-200 dark:border-red-800/50"
          loading={statsLoading}
        />
        <StatCard
          title="Unknown State"
          value={unknown}
          icon={HelpCircle}
          colorClass="text-orange-600 dark:text-orange-400"
          bgClass="bg-orange-50 dark:bg-orange-950/40"
          borderClass="border-orange-200 dark:border-orange-800/50"
          loading={statsLoading}
        />
      </div>

      {/* Donut Chart + Summary */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Donut Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Device Status Distribution</CardTitle>
            <CardDescription>
              Network health overview across all {total} branches
            </CardDescription>
          </CardHeader>
          <CardContent>
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
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Network Summary</CardTitle>
            <CardDescription>Status breakdown & quick actions</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            {/* Uptime Badge */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Network Uptime</span>
              <span className="text-2xl font-bold text-green-700 dark:text-green-400">{uptime}%</span>
            </div>

            {/* Status rows */}
            <div className="space-y-3">
              {[
                { label: "Online Branches", value: online, color: "bg-green-500", textColor: "text-green-700 dark:text-green-400" },
                { label: "Offline Branches", value: offline, color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
                { label: "Unknown State", value: unknown, color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${row.color}`} />
                    <span className="text-muted-foreground">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${row.textColor}`}>{statsLoading ? "—" : row.value}</span>
                    {total > 0 && !statsLoading && (
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {((row.value / total) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Progress bars */}
              {!statsLoading && total > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                    <div style={{ width: `${(online / total) * 100}%` }} className="bg-green-500 transition-all" />
                    <div style={{ width: `${(offline / total) * 100}%` }} className="bg-red-500 transition-all" />
                    <div style={{ width: `${(unknown / total) * 100}%` }} className="bg-orange-400 transition-all" />
                  </div>
                  <p className="text-xs text-muted-foreground">Combined network health</p>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-auto space-y-2 pt-2">
              {offline > 0 && (
                <Link href="/offline-report">
                  <Button variant="destructive" size="sm" className="w-full gap-2 justify-between">
                    <span>View {offline} Offline Devices</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/devices">
                <Button variant="outline" size="sm" className="w-full gap-2 justify-between">
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
