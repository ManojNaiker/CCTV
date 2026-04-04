import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetDeviceStats, 
  useListDevices, 
  useRefreshDeviceStatuses,
  useUpdateDevice,
  getGetDeviceStatsQueryKey,
  getListDevicesQueryKey
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { 
  MonitorCheck, 
  MonitorX, 
  MonitorOff, 
  RefreshCw, 
  ServerCrash,
  Edit2,
  Check,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nextRefresh, setNextRefresh] = useState(120);

  const [editingRemark, setEditingRemark] = useState<{id: number, text: string} | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetDeviceStats({
    query: { queryKey: getGetDeviceStatsQueryKey() }
  });

  const { data: onlineDevices, isLoading: onlineLoading } = useListDevices(
    { status: "online" },
    { query: { queryKey: getListDevicesQueryKey({ status: "online" }) } }
  );

  const { data: offlineDevices, isLoading: offlineLoading } = useListDevices(
    { status: "offline" },
    { query: { queryKey: getListDevicesQueryKey({ status: "offline" }) } }
  );

  const refreshMutation = useRefreshDeviceStatuses({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetDeviceStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey({ status: "online" }) });
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey({ status: "offline" }) });
        toast({
          title: "Refresh Complete",
          description: data.message,
        });
        setNextRefresh(120);
      }
    }
  });

  const updateMutation = useUpdateDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey({ status: "offline" }) });
        setEditingRemark(null);
        toast({ title: "Remark updated" });
      }
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) {
          queryClient.invalidateQueries({ queryKey: getGetDeviceStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey({ status: "online" }) });
          queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey({ status: "offline" }) });
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [queryClient]);

  const handleManualRefresh = () => {
    refreshMutation.mutate(undefined);
  };

  const handleSaveRemark = (id: number) => {
    if (!editingRemark) return;
    updateMutation.mutate({ id, data: { remark: editingRemark.text } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CCTV Operations Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of nationwide branch cameras.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground text-right hidden sm:block">
            <div>Auto-refresh in <span className="font-mono text-foreground font-medium">{Math.floor(nextRefresh / 60)}:{(nextRefresh % 60).toString().padStart(2, '0')}</span></div>
            {stats?.lastRefreshedAt && (
              <div className="text-xs">
                Last checked: {formatDistanceToNow(new Date(stats.lastRefreshedAt), { addSuffix: true })}
              </div>
            )}
          </div>
          <Button 
            onClick={handleManualRefresh} 
            disabled={refreshMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Now
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <MonitorCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-green-500/20 bg-green-500/5 dark:bg-green-500/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Online</CardTitle>
            <MonitorCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-green-200 dark:bg-green-800" />
            ) : (
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats?.online || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Offline</CardTitle>
            <ServerCrash className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-destructive/20" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{stats?.offline || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="border-orange-500/20 bg-orange-500/5 dark:bg-orange-500/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Unknown State</CardTitle>
            <MonitorX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-orange-200 dark:bg-orange-800" />
            ) : (
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats?.unknown || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Online Devices
              </CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                {onlineDevices?.length || 0} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[600px]">
            {onlineLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : onlineDevices?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <MonitorOff className="h-8 w-8 mb-2 opacity-20" />
                <p>No online devices found</p>
              </div>
            ) : (
              <div className="divide-y">
                {onlineDevices?.map((device) => (
                  <div key={device.id} className="p-4 hover:bg-muted/50 transition-colors flex items-start justify-between">
                    <div>
                      <div className="font-medium">{device.branchName}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">{device.serialNumber}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{device.stateName}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        Seen {device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : 'unknown'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col border-destructive/30">
          <CardHeader className="pb-3 border-b bg-destructive/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <ServerCrash className="h-5 w-5" />
                Offline Action Required
              </CardTitle>
              <Badge variant="destructive">
                {offlineDevices?.length || 0} alerts
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[600px]">
            {offlineLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : offlineDevices?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <MonitorCheck className="h-8 w-8 mb-2 opacity-20 text-green-500" />
                <p>All clear! No offline devices.</p>
              </div>
            ) : (
              <div className="divide-y divide-destructive/10">
                {offlineDevices?.map((device) => (
                  <div key={device.id} className="p-4 bg-destructive/5 hover:bg-destructive/10 transition-colors flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-destructive">{device.branchName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">{device.serialNumber}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="border-destructive/30 text-destructive">{device.stateName}</Badge>
                        <div className="text-xs text-destructive/80 font-medium mt-1">
                          Down for {device.offlineDays} days
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-background/50 p-2 rounded border border-border/50 group flex items-start gap-2 min-h-[40px]">
                      {editingRemark?.id === device.id ? (
                        <div className="flex w-full items-center gap-2">
                          <Input 
                            size={1} 
                            autoFocus
                            className="h-8 text-sm" 
                            value={editingRemark.text} 
                            onChange={e => setEditingRemark({...editingRemark, text: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handleSaveRemark(device.id)}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleSaveRemark(device.id)} disabled={updateMutation.isPending}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setEditingRemark(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex w-full items-center justify-between cursor-pointer" onClick={() => setEditingRemark({id: device.id, text: device.remark || ""})}>
                          <span className={`text-sm italic flex-1 ${!device.remark ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                            {device.remark ? `"${device.remark}"` : "Click to add a remark (e.g. ISP issue reported)..."}
                          </span>
                          <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
