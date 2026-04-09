import { useStats } from "@/hooks/use-stats";
import { LayoutShell } from "@/components/layout-shell";
import { StatCard } from "@/components/stat-card";
import { Box, Users, Repeat, CheckCircle2, Search } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { AssetSearchModal } from "@/components/asset-search-modal";
import { useState } from "react";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const [, navigate] = useLocation();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </LayoutShell>
    );
  }

  if (!stats) return null;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time insight into your asset inventory.</p>
      </div>

      <div className="flex gap-3 mb-8">
        <AssetSearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen}>
          <Button 
            variant="outline"
            data-testid="button-asset-search"
          >
            <Search className="w-4 h-4 mr-2" />
            Asset Search
          </Button>
        </AssetSearchModal>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Total Assets" 
          value={stats.totalAssets} 
          icon={Box} 
          color="blue"
        />
        <StatCard 
          title="Allocated" 
          value={stats.allocatedAssets} 
          icon={Repeat} 
          color="orange"
          trend={`${Math.round((stats.allocatedAssets / stats.totalAssets) * 100)}%`}
          trendUp={true}
        />
        <StatCard 
          title="Available" 
          value={stats.availableAssets} 
          icon={CheckCircle2} 
          color="green"
        />
        <StatCard 
          title="Employees" 
          value={stats.totalEmployees} 
          icon={Users} 
          color="purple"
        />
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-7">
        {/* Status Chart */}
        <Card className="col-span-2 md:col-span-1 lg:col-span-3 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-xl font-bold">Status</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="h-[180px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.assetsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {stats.assetsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {stats.assetsByStatus.map((item, index) => (
                <div key={item.status} className="flex items-center gap-1 text-[10px] sm:text-sm">
                  <div className="w-1.5 h-1.5 sm:w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-muted-foreground font-medium truncate">{item.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Type Chart */}
        <Card className="col-span-2 md:col-span-1 lg:col-span-4 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-xl font-bold">Category</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="h-[180px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.assetsByType} margin={{ left: -30, right: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 8 }} 
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 8 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
