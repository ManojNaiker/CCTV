import { useState } from "react";
import { format } from "date-fns";
import { Shield, ShieldAlert, ShieldCheck, MoreHorizontal, UserPlus, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListUsers,
  useCreateUser,
  useUpdateUser,
  getListUsersQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: users, isLoading } = useListUsers(
    { query: { queryKey: getListUsersQueryKey() } }
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ username: "", fullName: "", email: "", password: "", role: "viewer" as any });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsCreateOpen(false);
        setCreateData({ username: "", fullName: "", email: "", password: "", role: "viewer" });
        toast({ title: "User created" });
      }
    }
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User updated" });
      }
    }
  });

  const handleCreate = () => {
    createMutation.mutate({ data: createData });
  };

  const toggleActive = (user: any) => {
    updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } });
  };

  const RoleIcon = ({ role }: { role: string }) => {
    switch (role) {
      case 'admin': return <ShieldAlert className="h-3 w-3 mr-1" />;
      case 'operator': return <ShieldCheck className="h-3 w-3 mr-1" />;
      default: return <Shield className="h-3 w-3 mr-1" />;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50';
      case 'operator': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50';
      default: return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const adminCount = (users ?? []).filter((u: any) => u.role === "admin").length;
  const operatorCount = (users ?? []).filter((u: any) => u.role === "operator").length;
  const activeCount = (users ?? []).filter((u: any) => u.isActive).length;

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg relative"
        style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6366f1 100%)" }}>
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
              <p className="text-indigo-100 text-sm mt-0.5">Manage operators, admins, and their access levels.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 min-w-[64px]">
              {isLoading ? <div className="h-7 w-8 bg-white/20 animate-pulse rounded mx-auto mb-1" /> : <p className="text-2xl font-extrabold text-white">{users?.length ?? 0}</p>}
              <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-semibold">Total</p>
            </div>
            <div className="text-center px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 min-w-[64px]">
              {isLoading ? <div className="h-7 w-8 bg-white/20 animate-pulse rounded mx-auto mb-1" /> : <p className="text-2xl font-extrabold text-white">{activeCount}</p>}
              <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-semibold">Active</p>
            </div>
            <Button
              className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50 border-0 font-semibold h-10"
              onClick={() => setIsCreateOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* ── Role summary pills ── */}
      {!isLoading && (users?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400 text-xs font-semibold">
            <ShieldAlert className="h-3.5 w-3.5" /> {adminCount} Admin{adminCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> {operatorCount} Operator{operatorCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" /> {(users?.length ?? 0) - adminCount - operatorCount} Viewer{((users?.length ?? 0) - adminCount - operatorCount) !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Users Table ── */}
      <Card className="shadow-sm overflow-hidden">
        <div className="border-b border-border/40 bg-muted/30 px-6 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isLoading ? "Loading users..." : `${users?.length ?? 0} user${(users?.length ?? 0) !== 1 ? "s" : ""} registered`}
          </p>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Login</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/20">
                    <TableCell className="pl-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {(user.fullName || user.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm py-3.5">{user.username}</TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={`capitalize inline-flex items-center gap-1 w-fit text-xs font-semibold ${getRoleBadgeStyle(user.role)}`}>
                        <RoleIcon role={user.role} />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        <span className={`text-sm ${user.isActive ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs py-3.5">
                      {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM yyyy, HH:mm") : <span className="opacity-40 italic">Never</span>}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => toggleActive(user)}>
                            {user.isActive ? "Deactivate User" : "Activate User"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Add User Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-600" /> Add New User
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {[
              { label: "Username", key: "username", type: "text" },
              { label: "Full Name", key: "fullName", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: "Password", key: "password", type: "password" },
            ].map(({ label, key, type }) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
                <Input
                  type={type}
                  className="h-9"
                  value={(createData as any)[key]}
                  onChange={e => setCreateData({ ...createData, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
              <Select value={createData.role} onValueChange={(v: any) => setCreateData({ ...createData, role: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createData.username || !createData.password}
              className="gap-2"
            >
              {createMutation.isPending ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
