import { useState, useRef } from "react";
import { format } from "date-fns";
import {
  Shield, ShieldAlert, ShieldCheck, MoreHorizontal, UserPlus, Users,
  Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, AlertCircle,
  Eye, Pencil, Trash2, UserCircle2, Calendar, Mail, KeyRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

/* ─── CSV helpers ─── */
const CSV_TEMPLATE_HEADERS = ["username", "fullName", "email", "password", "role"];
const CSV_TEMPLATE_ROWS = [
  ["rahulv", "Rahul Verma", "rahul.v@lightfinance.com", "Pass@1234", "viewer"],
  ["priyak", "Priya Kapoor", "priya.k@lightfinance.com", "Pass@5678", "operator"],
  ["admintest", "Admin User", "admin.test@lightfinance.com", "Admin@9999", "admin"],
];
function generateCsvTemplate() {
  return [CSV_TEMPLATE_HEADERS, ...CSV_TEMPLATE_ROWS].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const result: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    result.push(cur.trim()); return result;
  };
  const headers = parseRow(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = parseRow(line); const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v.trim()));
}
type BulkResult = { row: number; username: string; status: "success" | "error"; message: string };

/* ─── Role helpers ─── */
const RoleIcon = ({ role }: { role: string }) => {
  if (role === "admin") return <ShieldAlert className="h-3 w-3 mr-1" />;
  if (role === "operator") return <ShieldCheck className="h-3 w-3 mr-1" />;
  return <Shield className="h-3 w-3 mr-1" />;
};
const roleBadge = (role: string) => {
  if (role === "admin") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50";
  if (role === "operator") return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50";
  return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
};

export default function UsersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users, isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });

  /* ── single create ── */
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ username: "", fullName: "", email: "", password: "", role: "viewer" as any });
  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsCreateOpen(false);
        setCreateData({ username: "", fullName: "", email: "", password: "", role: "viewer" });
        toast({ title: "User created" });
      },
    },
  });

  /* ── view ── */
  const [viewUser, setViewUser] = useState<any>(null);

  /* ── edit ── */
  const [editUser, setEditUser] = useState<any>(null);
  const [editData, setEditData] = useState({ fullName: "", email: "", role: "viewer" as any, password: "" });
  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setEditUser(null);
        toast({ title: "User updated" });
      },
    },
  });
  const openEdit = (user: any) => {
    setEditUser(user);
    setEditData({ fullName: user.fullName ?? "", email: user.email ?? "", role: user.role, password: "" });
  };
  const handleEdit = () => {
    const payload: any = { fullName: editData.fullName, email: editData.email, role: editData.role };
    if (editData.password) payload.password = editData.password;
    updateMutation.mutate({ id: editUser.id, data: payload });
  };

  /* ── delete ── */
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/users/${deleteUser.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: `User '${deleteUser.username}' deleted` });
        setDeleteUser(null);
      } else {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  /* ── toggle active ── */
  const toggleActive = (user: any) => {
    updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } });
  };

  /* ── bulk import ── */
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([generateCsvTemplate()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bulk_user_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBulkFileName(file.name); setBulkResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => setBulkRows(parseCsv(ev.target?.result as string));
    reader.readAsText(file);
  };
  const handleBulkImport = async () => {
    if (!bulkRows.length) return;
    setBulkImporting(true); setBulkResults(null);
    try {
      const res = await fetch(`${BASE}/api/users/bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: bulkRows }),
      });
      const data = await res.json() as { results: BulkResult[]; successCount: number; errorCount: number };
      setBulkResults(data.results);
      if (data.successCount > 0) {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: `${data.successCount} user${data.successCount !== 1 ? "s" : ""} imported` });
      }
    } catch { toast({ title: "Import failed", variant: "destructive" }); }
    finally { setBulkImporting(false); }
  };
  const resetBulk = () => { setBulkRows([]); setBulkFileName(""); setBulkResults(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const adminCount = (users ?? []).filter((u: any) => u.role === "admin").length;
  const operatorCount = (users ?? []).filter((u: any) => u.role === "operator").length;
  const activeCount = (users ?? []).filter((u: any) => u.isActive).length;
  const successCount = bulkResults?.filter((r) => r.status === "success").length ?? 0;
  const errorCount = bulkResults?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="rounded-2xl overflow-hidden shadow-lg relative" style={{ background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6366f1 100%)" }}>
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
            <Button variant="outline" className="gap-2 bg-white/10 text-white border-white/30 hover:bg-white/20 font-semibold h-10" onClick={() => { resetBulk(); setIsBulkOpen(true); }}>
              <Upload className="h-4 w-4" /> Bulk Import
            </Button>
            <Button className="gap-2 bg-white text-indigo-700 hover:bg-indigo-50 border-0 font-semibold h-10" onClick={() => setIsCreateOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </div>
        </div>
      </div>

      {/* ── Role pills ── */}
      {!isLoading && (users?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400 text-xs font-semibold"><ShieldAlert className="h-3.5 w-3.5" /> {adminCount} Admin{adminCount !== 1 ? "s" : ""}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> {operatorCount} Operator{operatorCount !== 1 ? "s" : ""}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-xs font-semibold"><Shield className="h-3.5 w-3.5" /> {(users?.length ?? 0) - adminCount - operatorCount} Viewer{((users?.length ?? 0) - adminCount - operatorCount) !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* ── Table ── */}
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
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                </TableRow>
              )) : users?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No users found.</TableCell></TableRow>
              ) : users?.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/20">
                  <TableCell className="pl-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{(user.fullName || user.username).charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{user.fullName}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm py-3.5">{user.username}</TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className={`capitalize inline-flex items-center gap-1 w-fit text-xs font-semibold ${roleBadge(user.role)}`}>
                      <RoleIcon role={user.role} />{user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                      <span className={`text-sm ${user.isActive ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>{user.isActive ? "Active" : "Inactive"}</span>
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
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setViewUser(user)}>
                          <Eye className="h-4 w-4 text-muted-foreground" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" /> Edit User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => toggleActive(user)}>
                          {user.isActive ? <XCircle className="h-4 w-4 text-muted-foreground" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                          {user.isActive ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => setDeleteUser(user)}>
                          <Trash2 className="h-4 w-4" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          VIEW DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-600" /> User Details
            </DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4 py-2">
              {/* Avatar + name */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{(viewUser.fullName || viewUser.username).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-bold text-base">{viewUser.fullName}</p>
                  <p className="text-sm text-muted-foreground font-mono">@{viewUser.username}</p>
                  <Badge variant="outline" className={`mt-1.5 capitalize inline-flex items-center gap-1 text-xs font-semibold ${roleBadge(viewUser.role)}`}>
                    <RoleIcon role={viewUser.role} />{viewUser.role}
                  </Badge>
                </div>
              </div>

              {/* Detail rows */}
              <div className="space-y-3">
                {[
                  { icon: <Mail className="h-4 w-4" />, label: "Email", value: viewUser.email || "—" },
                  {
                    icon: <span className={`h-2 w-2 rounded-full mt-0.5 shrink-0 ${viewUser.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />,
                    label: "Status",
                    value: viewUser.isActive ? "Active" : "Inactive",
                    valueClass: viewUser.isActive ? "text-green-700 dark:text-green-400 font-semibold" : "text-muted-foreground",
                  },
                  {
                    icon: <Calendar className="h-4 w-4" />,
                    label: "Last Login",
                    value: viewUser.lastLoginAt ? format(new Date(viewUser.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never",
                  },
                  {
                    icon: <UserCircle2 className="h-4 w-4" />,
                    label: "Account Created",
                    value: viewUser.createdAt ? format(new Date(viewUser.createdAt), "dd MMM yyyy, HH:mm") : "—",
                  },
                ].map(({ icon, label, value, valueClass }) => (
                  <div key={label} className="flex items-start gap-3 text-sm">
                    <span className="text-muted-foreground mt-0.5">{icon}</span>
                    <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                    <span className={`font-medium flex-1 ${valueClass ?? ""}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
            <Button className="gap-2" onClick={() => { setViewUser(null); viewUser && openEdit(viewUser); }}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          EDIT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-indigo-600" /> Edit User — <span className="font-mono text-base">{editUser?.username}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</Label>
              <Input className="h-9" value={editData.fullName} onChange={(e) => setEditData({ ...editData, fullName: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input className="h-9" type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
              <Select value={editData.role} onValueChange={(v: any) => setEditData({ ...editData, role: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> New Password <span className="normal-case font-normal text-muted-foreground/60">(leave blank to keep current)</span>
              </Label>
              <Input className="h-9" type="password" placeholder="••••••••" value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={updateMutation.isPending || !editData.fullName}
              onClick={handleEdit}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          DELETE DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" /> Delete User
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800/40">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-red-600">{(deleteUser?.fullName || deleteUser?.username || "?").charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{deleteUser?.fullName}</p>
                <p className="text-xs text-muted-foreground font-mono">@{deleteUser?.username}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This action is <span className="font-semibold text-foreground">permanent</span> and cannot be undone. All data associated with this user will be removed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : <><Trash2 className="h-4 w-4" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          ADD USER DIALOG
      ══════════════════════════════════════════ */}
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
                <Input type={type} className="h-9" value={(createData as any)[key]} onChange={(e) => setCreateData({ ...createData, [key]: e.target.value })} />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
              <Select value={createData.role} onValueChange={(v: any) => setCreateData({ ...createData, role: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
            <Button onClick={() => createMutation.mutate({ data: createData })} disabled={createMutation.isPending || !createData.username || !createData.password} className="gap-2">
              {createMutation.isPending ? "Adding..." : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          BULK IMPORT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog open={isBulkOpen} onOpenChange={(o) => { setIsBulkOpen(o); if (!o) resetBulk(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> Bulk User Import
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-800/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Step 1 — Download the CSV Template</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">Columns: <span className="font-mono">username, fullName, email, password, role</span></p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-0.5">Role: <span className="font-mono font-bold">admin</span> / <span className="font-mono font-bold">operator</span> / <span className="font-mono font-bold">viewer</span></p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4" /> Download Template
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Step 2 — Upload Filled CSV</p>
              <label htmlFor="bulk-csv-upload" className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">{bulkFileName ? <span className="font-medium text-foreground">{bulkFileName}</span> : "Click to choose CSV file"}</span>
                {bulkRows.length > 0 && <span className="text-xs text-indigo-600 mt-1">{bulkRows.length} row{bulkRows.length !== 1 ? "s" : ""} detected</span>}
                <input id="bulk-csv-upload" ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {bulkRows.length > 0 && !bulkResults && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Preview ({bulkRows.length} users)</p>
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {["#", "Username", "Full Name", "Email", "Role"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {bulkRows.map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-2 font-mono font-semibold">{row.username || <span className="text-red-500 italic">missing</span>}</td>
                            <td className="px-3 py-2">{row.fullname || row.fullName || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${row.role === "admin" ? "bg-red-100 text-red-700" : row.role === "operator" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                                {row.role || "viewer"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {bulkResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-green-700 font-semibold"><CheckCircle2 className="h-4 w-4" /> {successCount} created</span>
                  {errorCount > 0 && <span className="flex items-center gap-1.5 text-sm text-red-600 font-semibold"><XCircle className="h-4 w-4" /> {errorCount} failed</span>}
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>{["#", "Username", "Status", "Message"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {bulkResults.map((r) => (
                          <tr key={r.row} className={r.status === "error" ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                            <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                            <td className="px-3 py-2 font-mono font-semibold">{r.username}</td>
                            <td className="px-3 py-2">{r.status === "success" ? <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Success</span> : <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" /> Error</span>}</td>
                            <td className="px-3 py-2 text-muted-foreground">{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {errorCount === 0 && <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700"><CheckCircle2 className="h-4 w-4 shrink-0" /> All users imported successfully!</div>}
                {errorCount > 0 && successCount > 0 && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700"><AlertCircle className="h-4 w-4 shrink-0" /> {successCount} created, {errorCount} row{errorCount !== 1 ? "s" : ""} failed. Fix and re-import only those rows.</div>}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {bulkResults ? (
              <Button variant="outline" onClick={() => { resetBulk(); setIsBulkOpen(false); }}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { resetBulk(); setIsBulkOpen(false); }}>Cancel</Button>
                <Button onClick={handleBulkImport} disabled={bulkRows.length === 0 || bulkImporting} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                  {bulkImporting ? <><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> Importing...</> : <><Upload className="h-4 w-4" /> Import {bulkRows.length > 0 ? `${bulkRows.length} Users` : "Users"}</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
