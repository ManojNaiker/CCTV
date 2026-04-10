import { useState, useMemo, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Search, Plus, MoreHorizontal, FileEdit, Trash2, Video, Upload, CheckCircle2, AlertCircle, SkipForward, Download, FileSpreadsheet, X, Loader2, Hash, MapPin, Tag, Clock, Pencil, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { 
  useListDevices,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
  useBulkCreateDevices,
  useBulkUpdateDevices,
  getListDevicesQueryKey
} from "@workspace/api-client-react";
import type { BulkUpdateDeviceRow } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function StatusBadge({ status, offlineDays }: { status: string; offlineDays?: number | null }) {
  if (status === "online") {
    return (
      <Badge className="gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
        Online
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
          Offline
        </Badge>
        {offlineDays && offlineDays > 0 && (
          <span className="text-xs text-red-500 font-medium">{offlineDays}d</span>
        )}
      </div>
    );
  }
  return (
    <Badge className="gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
      Unknown
    </Badge>
  );
}

type ParsedRow = {
  stateName: string;
  branchName: string;
  serialNumber: string;
  email?: string;
  error?: string;
};

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["State Name", "Branch Name", "Serial Number", "Email ID"],
    ["Rajasthan", "Bhinder", "DS-ABC123", "bhinder@company.com"],
    ["Maharashtra", "Pune Main", "DS-XYZ456", "pune@company.com"],
    ["Gujarat", "Ahmedabad", "DS-DEF789", ""],
  ]);
  ws["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Devices");
  XLSX.writeFile(wb, "device_import_template.xlsx");
}

function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];

        const dataRows = rows.filter(r => r.some(c => c !== undefined && String(c).trim() !== ""));
        const startIdx = dataRows.findIndex(r => {
          const first = String(r[0] || "").toLowerCase();
          return first === "state name" || first === "state";
        });
        const actualData = startIdx >= 0 ? dataRows.slice(startIdx + 1) : dataRows;

        const parsed: ParsedRow[] = actualData.map((row, i) => {
          const stateName = String(row[0] || "").trim();
          const branchName = String(row[1] || "").trim();
          const serialNumber = String(row[2] || "").trim();
          const email = String(row[3] || "").trim();

          if (!stateName || !branchName || !serialNumber) {
            return { stateName, branchName, serialNumber, email, error: `Row ${i + 1}: State, Branch, or Serial is empty` };
          }
          return { stateName, branchName, serialNumber, email: email || undefined };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function Devices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ serialNumber: "", branchName: "", stateName: "", remark: "" });

  const [editDevice, setEditDevice] = useState<any>(null);
  const [editData, setEditData] = useState({ branchName: "", stateName: "", serialNumber: "", email: "", status: "online" as any, remark: "" });

  const [deleteDevice, setDeleteDevice] = useState<any>(null);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [fileError, setFileError] = useState<string>("");

  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateParsedRows, setUpdateParsedRows] = useState<BulkUpdateDeviceRow[]>([]);
  const [updateSelectedFile, setUpdateSelectedFile] = useState<File | null>(null);
  const [updateFileError, setUpdateFileError] = useState<string>("");
  const [updateResult, setUpdateResult] = useState<{ updated: number; notFound: string[]; errors: string[] } | null>(null);

  const validRows = useMemo(() => parsedRows.filter(r => !r.error), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter(r => !!r.error), [parsedRows]);

  const { data: devices, isLoading } = useListDevices(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter as any : undefined },
    { query: { queryKey: getListDevicesQueryKey({ search: search || undefined, status: statusFilter !== "all" ? statusFilter as any : undefined }) } }
  );

  const createMutation = useCreateDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        setIsCreateOpen(false);
        setCreateData({ serialNumber: "", branchName: "", stateName: "", remark: "" });
        toast({ title: "Device added" });
      }
    }
  });

  const bulkMutation = useBulkCreateDevices({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        setBulkResult(data);
        setParsedRows([]);
        setSelectedFile(null);
        toast({
          title: "Bulk import complete",
          description: `${data.created} added, ${data.skipped} skipped`,
        });
      },
      onError: () => {
        toast({ title: "Bulk import failed", variant: "destructive" });
      }
    }
  });

  const updateMutation = useUpdateDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        setEditDevice(null);
        toast({ title: "Device updated" });
      }
    }
  });

  const deleteMutation = useDeleteDevice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        setDeleteDevice(null);
        toast({ title: "Device deleted" });
      }
    }
  });

  const handleCreate = () => {
    createMutation.mutate({ data: createData });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    setSelectedFile(file);
    try {
      const rows = await parseExcelFile(file);
      setParsedRows(rows);
    } catch {
      setFileError("Could not read the file. Please upload a valid .xlsx or .xls file.");
      setSelectedFile(null);
      setParsedRows([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleBulkImport = () => {
    if (validRows.length === 0) return;
    bulkMutation.mutate({
      data: {
        devices: validRows.map(r => ({
          stateName: r.stateName,
          branchName: r.branchName,
          serialNumber: r.serialNumber,
          email: r.email || null,
        })),
      },
    });
  };

  const handleUpdate = () => {
    updateMutation.mutate({
      id: editDevice.id,
      data: {
        branchName: editData.branchName,
        stateName: editData.stateName,
        serialNumber: editData.serialNumber || undefined,
        email: editData.email || null,
        status: editData.status,
        remark: editData.remark || null,
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: deleteDevice.id });
  };

  const openEdit = (device: any) => {
    setEditDevice(device);
    setEditData({
      branchName: device.branchName,
      stateName: device.stateName,
      serialNumber: device.serialNumber || "",
      email: device.email || "",
      status: device.status,
      remark: device.remark || "",
    });
  };

  const handleBulkClose = () => {
    setIsBulkOpen(false);
    setParsedRows([]);
    setSelectedFile(null);
    setFileError("");
    setBulkResult(null);
  };

  const bulkUpdateMutation = useBulkUpdateDevices({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
        setUpdateResult(data);
        setUpdateParsedRows([]);
        setUpdateSelectedFile(null);
        toast({
          title: "Bulk update complete",
          description: `${data.updated} devices updated`,
        });
      },
      onError: () => {
        toast({ title: "Bulk update failed", variant: "destructive" });
      }
    }
  });

  const handleUpdateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpdateFileError("");
    setUpdateSelectedFile(file);
    try {
      const rows = await parseExcelFile(file);
      const updateRows: BulkUpdateDeviceRow[] = rows
        .filter(r => !r.error && r.branchName)
        .map(r => ({
          branchName: r.branchName,
          stateName: r.stateName || undefined,
          serialNumber: r.serialNumber || undefined,
          email: r.email || undefined,
        }));
      setUpdateParsedRows(updateRows);
    } catch {
      setUpdateFileError("Could not read the file. Please upload a valid .xlsx or .xls file.");
      setUpdateSelectedFile(null);
      setUpdateParsedRows([]);
    }
    if (updateFileInputRef.current) updateFileInputRef.current.value = "";
  };

  const handleClearUpdateFile = () => {
    setUpdateSelectedFile(null);
    setUpdateParsedRows([]);
    setUpdateFileError("");
    if (updateFileInputRef.current) updateFileInputRef.current.value = "";
  };

  const handleBulkUpdate = () => {
    if (updateParsedRows.length === 0) return;
    bulkUpdateMutation.mutate({ data: updateParsedRows });
  };

  const handleUpdateClose = () => {
    setIsUpdateOpen(false);
    setUpdateParsedRows([]);
    setUpdateSelectedFile(null);
    setUpdateFileError("");
    setUpdateResult(null);
  };

  const handleExportAll = async () => {
    try {
      const res = await fetch("/api/devices");
      const allDevices: any[] = await res.json();
      const ws = XLSX.utils.aoa_to_sheet([
        ["State Name", "Branch Name", "Serial Number", "Email ID"],
        ...allDevices.map(d => [d.stateName, d.branchName, d.serialNumber, d.email ?? ""]),
      ]);
      ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 22 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Devices");
      XLSX.writeFile(wb, `devices_export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Export complete", description: `${allDevices.length} devices exported` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

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
              <Video className="h-6 w-6 text-blue-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Device Inventory</h1>
              <p className="text-blue-200/70 text-sm mt-0.5">Manage CCTV devices across all branches</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 bg-white/8 border-white/20 text-white hover:bg-white/15 hover:text-white h-10"
              onClick={handleExportAll}
            >
              <Download className="h-4 w-4" />
              Export All
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-white/8 border-white/20 text-white hover:bg-white/15 hover:text-white h-10"
              onClick={() => setIsBulkOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </Button>
            <Button
              variant="outline"
              className="gap-2 bg-amber-400/20 border-amber-300/40 text-amber-200 hover:bg-amber-400/30 hover:text-amber-100 h-10"
              onClick={() => setIsUpdateOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Bulk Update
            </Button>
            <Button
              className="gap-2 bg-white/90 text-blue-900 hover:bg-white border-0 font-semibold h-10 shadow-lg shadow-blue-900/20"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search branch, serial, state..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">Branch</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">Serial No.</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">State</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">Updated</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider h-10">Remarks</TableHead>
                  <TableHead className="w-[50px] h-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-sm" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-6 rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : devices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                        <Video className="h-7 w-7" />
                        <span className="text-[10px] tracking-widest uppercase">No devices found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  devices?.map((device) => (
                    <TableRow key={device.id} className="border-border/30 hover:bg-muted/10">
                      <TableCell className="font-medium text-sm py-2.5">{device.branchName}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground py-2.5">{device.serialNumber}</TableCell>
                      <TableCell className="text-sm py-2.5">{device.stateName}</TableCell>
                      <TableCell className="py-2.5">
                        <StatusBadge status={device.status} offlineDays={device.offlineDays} />
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground font-mono py-2.5">
                        {device.updatedAt ? format(new Date(device.updatedAt), "dd MMM HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/70 max-w-[160px] truncate italic py-2.5">
                        {device.remark || <span className="opacity-30 not-italic">—</span>}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs min-w-[150px]">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(device)}>
                              <FileEdit className="h-3.5 w-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => setDeleteDevice(device)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {devices && devices.length > 0 && (
            <p className="text-[10px] text-muted-foreground/50 font-mono mt-2">
              {devices.length} record{devices.length !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Add Device ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              <span className="text-primary">+</span> Add Device
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {[
              { label: "Serial Number", key: "serialNumber", placeholder: "DS-2CD2143G2-I", mono: true },
              { label: "Branch Name", key: "branchName", placeholder: "e.g. Bhinder" },
              { label: "State Name", key: "stateName", placeholder: "e.g. Rajasthan" },
              { label: "Remark", key: "remark", placeholder: "Optional note..." },
            ].map(({ label, key, placeholder, mono }) => (
              <div key={key} className="grid gap-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
                <Input
                  className={`text-sm h-8 bg-background/50 ${mono ? "font-mono" : ""}`}
                  placeholder={placeholder}
                  value={(createData as any)[key]}
                  onChange={e => setCreateData({ ...createData, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="text-xs h-8"
              onClick={handleCreate}
              disabled={createMutation.isPending || !createData.serialNumber || !createData.branchName || !createData.stateName}
            >
              {createMutation.isPending ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Import ── */}
      <Dialog open={isBulkOpen} onOpenChange={handleBulkClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              <span className="text-primary">↑</span> Bulk Import Devices
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Upload an Excel file with State Name, Branch Name, Serial Number and Email ID columns.
              Download the template below.
            </DialogDescription>
          </DialogHeader>

          {bulkResult ? (
            <>
              <div className="py-3 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="font-mono text-2xl font-bold text-emerald-400">{bulkResult.created}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Created</span>
                  </div>
                  <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-4 flex flex-col items-center gap-1.5">
                    <SkipForward className="h-5 w-5 text-yellow-400" />
                    <span className="font-mono text-2xl font-bold text-yellow-400">{bulkResult.skipped}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Skipped</span>
                  </div>
                  <div className="rounded border border-red-500/20 bg-red-500/5 p-4 flex flex-col items-center gap-1.5">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <span className="font-mono text-2xl font-bold text-red-400">{bulkResult.errors.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Errors</span>
                  </div>
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-1 max-h-28 overflow-auto">
                    {bulkResult.errors.map((e, i) => (
                      <p key={i} className="font-mono text-[11px] text-red-400">{e}</p>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button size="sm" className="text-xs h-8" onClick={handleBulkClose}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-1">
                {/* Template Download */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Excel Template</p>
                      <p className="text-xs text-muted-foreground">Ready-to-use template with State, Branch, Serial, and Email columns</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>

                {/* File Upload */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Excel File Upload</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {parsedRows.length} rows detected &mdash; {validRows.length} valid
                            {errorRows.length > 0 && `, ${errorRows.length} invalid`}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleClearFile}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-muted-foreground">Upload an Excel file here</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Supports .xlsx and .xls formats</p>
                      </div>
                    </button>
                  )}
                  {fileError && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {fileError}
                    </p>
                  )}
                </div>

                {/* Preview */}
                {parsedRows.length > 0 && (
                  <>
                    <Separator className="bg-border/40" />
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        Preview &mdash; {validRows.length} valid&nbsp;&nbsp;·&nbsp;&nbsp;{errorRows.length} invalid
                      </p>
                      <div className="rounded border border-border/40 overflow-hidden max-h-44 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableHead className="text-[10px] h-6 text-muted-foreground/60 uppercase">State</TableHead>
                              <TableHead className="text-[10px] h-6 text-muted-foreground/60 uppercase">Branch</TableHead>
                              <TableHead className="text-[10px] h-6 text-muted-foreground/60 uppercase">Serial</TableHead>
                              <TableHead className="text-[10px] h-6 text-muted-foreground/60 uppercase">Email</TableHead>
                              <TableHead className="text-[10px] h-6 w-8" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedRows.map((row, i) => (
                              <TableRow key={i} className={`border-border/30 ${row.error ? "bg-red-500/5" : ""}`}>
                                <TableCell className="text-[11px] py-1.5">{row.stateName || <span className="text-red-400/70">—</span>}</TableCell>
                                <TableCell className="text-[11px] py-1.5">{row.branchName || <span className="text-red-400/70">—</span>}</TableCell>
                                <TableCell className="font-mono text-[11px] py-1.5">{row.serialNumber || <span className="text-red-400/70">—</span>}</TableCell>
                                <TableCell className="text-[11px] py-1.5 text-muted-foreground">{row.email || <span className="opacity-40">—</span>}</TableCell>
                                <TableCell className="py-1.5">
                                  {row.error
                                    ? <AlertCircle className="h-3 w-3 text-red-400" title={row.error} />
                                    : <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  }
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleBulkClose}>Cancel</Button>
                <Button
                  size="sm"
                  className="text-xs h-8 gap-1.5"
                  onClick={handleBulkImport}
                  disabled={validRows.length === 0 || bulkMutation.isPending}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {bulkMutation.isPending
                    ? "Importing..."
                    : `Import ${validRows.length > 0 ? validRows.length : ""} Device${validRows.length !== 1 ? "s" : ""}`
                  }
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Device ── */}
      <Dialog open={!!editDevice} onOpenChange={(open) => !open && setEditDevice(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
          {/* Dialog header with device identity */}
          <div
            className="px-6 pt-5 pb-4 relative"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1e40af 100%)" }}
          >
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <Pencil className="h-5 w-5 text-blue-200" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-widest mb-0.5">Edit Device</p>
                <h2 className="text-lg font-bold text-white tracking-tight truncate">
                  {editDevice?.branchName}
                </h2>
                <p className="text-blue-200/60 text-xs mt-0.5">{editDevice?.stateName}</p>
              </div>
              <button
                onClick={() => setEditDevice(null)}
                className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>

            {/* Device identity pills */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/8 border border-white/12">
                <Hash className="h-3 w-3 text-blue-300" />
                <span className="text-[11px] font-mono text-blue-200">ID: {editDevice?.id}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/8 border border-white/12">
                <Tag className="h-3 w-3 text-blue-300" />
                <span className="text-[11px] font-mono text-blue-200">{editDevice?.serialNumber}</span>
              </div>
              {editDevice?.updatedAt && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/8 border border-white/12">
                  <Clock className="h-3 w-3 text-blue-300" />
                  <span className="text-[11px] text-blue-200">
                    Updated {formatDistanceToNow(new Date(editDevice.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/8 border border-white/12">
                <span
                  className={`h-1.5 w-1.5 rounded-full inline-block ${
                    editDevice?.status === "online" ? "bg-green-400 animate-pulse" :
                    editDevice?.status === "offline" ? "bg-red-400" : "bg-amber-400"
                  }`}
                />
                <span className={`text-[11px] capitalize font-medium ${
                  editDevice?.status === "online" ? "text-green-300" :
                  editDevice?.status === "offline" ? "text-red-300" : "text-amber-300"
                }`}>
                  {editDevice?.status ?? "unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Branch Name
                </Label>
                <Input
                  className="text-sm bg-background border-border/60 focus:border-primary"
                  value={editData.branchName}
                  onChange={e => setEditData({...editData, branchName: e.target.value})}
                  placeholder="Branch name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> State Name
                </Label>
                <Input
                  className="text-sm bg-background border-border/60 focus:border-primary"
                  value={editData.stateName}
                  onChange={e => setEditData({...editData, stateName: e.target.value})}
                  placeholder="State name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> Serial Number (SN)
                </Label>
                <Input
                  className="text-sm bg-background border-border/60 focus:border-primary font-mono"
                  value={editData.serialNumber}
                  onChange={e => setEditData({...editData, serialNumber: e.target.value})}
                  placeholder="e.g. DS-2CD2143G2-I"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Email / Alert ID
                </Label>
                <Input
                  type="email"
                  className="text-sm bg-background border-border/60 focus:border-primary"
                  value={editData.email}
                  onChange={e => setEditData({...editData, email: e.target.value})}
                  placeholder="branch@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Override Status
              </Label>
              <Select value={editData.status} onValueChange={(v: any) => setEditData({...editData, status: v})}>
                <SelectTrigger className="text-sm bg-background border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                      Online
                    </span>
                  </SelectItem>
                  <SelectItem value="offline">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                      Offline
                    </span>
                  </SelectItem>
                  <SelectItem value="unknown">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                      Unknown
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/60">This overrides the auto-synced status from Hik-Connect until the next refresh.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Remark / Note
              </Label>
              <textarea
                className="w-full text-sm bg-background border border-border/60 focus:border-primary rounded-md px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground/40"
                rows={3}
                value={editData.remark}
                onChange={e => setEditData({...editData, remark: e.target.value})}
                placeholder="e.g. CCTV has been offline since today — power issue at branch"
              />
            </div>
          </div>

          <Separator className="bg-border/40" />

          <div className="px-6 py-4 flex items-center justify-between gap-3 bg-muted/20">
            <p className="text-[11px] text-muted-foreground/50 font-mono">
              {editDevice?.serialNumber}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 px-4" onClick={() => setEditDevice(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 px-5 gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                  : <><CheckCircle2 className="h-3.5 w-3.5" /> Save Changes</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete ── */}
      <Dialog open={!!deleteDevice} onOpenChange={(open) => !open && setDeleteDevice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-destructive">
              ⚠ Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <span className="font-medium text-foreground">{deleteDevice?.branchName}</span>
            {" "}(<span className="font-mono text-xs">{deleteDevice?.serialNumber}</span>)?
            {" "}This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setDeleteDevice(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" className="text-xs h-8" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Update by Branch Name ── */}
      <input
        type="file"
        ref={updateFileInputRef}
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleUpdateFileChange}
      />
      <Dialog open={isUpdateOpen} onOpenChange={(open) => !open && handleUpdateClose()}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden gap-0">
          {/* Header */}
          <div
            className="px-6 pt-5 pb-4"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #78350f 100%)" }}
          >
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                <RefreshCw className="h-5 w-5 text-amber-200" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300 uppercase tracking-widest mb-0.5">Bulk Update</p>
                <h2 className="text-lg font-bold text-white tracking-tight">Update Devices by Branch Name</h2>
                <p className="text-white/50 text-xs mt-0.5">Upload an Excel file — devices are matched by Branch Name</p>
              </div>
              <button onClick={handleUpdateClose} className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                <X className="h-3.5 w-3.5 text-white/70" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {updateResult ? (
              /* Result view */
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-green-50 p-4 text-center">
                    <span className="font-mono text-2xl font-bold text-green-600">{updateResult.updated}</span>
                    <p className="text-xs text-muted-foreground mt-1">Updated</p>
                  </div>
                  <div className="rounded-xl border bg-amber-50 p-4 text-center">
                    <span className="font-mono text-2xl font-bold text-amber-500">{updateResult.notFound.length}</span>
                    <p className="text-xs text-muted-foreground mt-1">Not Found</p>
                  </div>
                  <div className="rounded-xl border bg-red-50 p-4 text-center">
                    <span className="font-mono text-2xl font-bold text-red-500">{updateResult.errors.length}</span>
                    <p className="text-xs text-muted-foreground mt-1">Errors</p>
                  </div>
                </div>
                {updateResult.notFound.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Branches Not Found:</p>
                    <div className="flex flex-wrap gap-1">
                      {updateResult.notFound.map((b, i) => (
                        <span key={i} className="text-[11px] font-mono bg-amber-100 border border-amber-300 text-amber-800 rounded px-1.5 py-0.5">{b}</span>
                      ))}
                    </div>
                  </div>
                )}
                {updateResult.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                    {updateResult.errors.map((e, i) => (
                      <p key={i} className="text-[11px] font-mono text-red-700">{e}</p>
                    ))}
                  </div>
                )}
                <Button className="w-full h-9" onClick={handleUpdateClose}>Done</Button>
              </div>
            ) : (
              /* Upload view */
              <>
                {/* Format tip */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Expected Excel Format (same as Export/Import):</p>
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                    {["State Name", "Branch Name", "Serial Number", "Email ID"].map((h) => (
                      <span key={h} className="bg-amber-100 border border-amber-300 text-amber-800 rounded px-1.5 py-0.5 text-center">{h}</span>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1.5">Devices are matched by <strong>Branch Name</strong>. Leave a cell blank to keep the existing value.</p>
                </div>

                {updateFileError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">{updateFileError}</div>
                )}

                {!updateSelectedFile ? (
                  <button
                    onClick={() => updateFileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-amber-400 rounded-xl p-8 text-center transition-colors group"
                  >
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground/40 group-hover:text-amber-500 transition-colors mb-2" />
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Click to upload Excel file</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">.xlsx or .xls</p>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{updateSelectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{updateParsedRows.length} valid rows ready to update</p>
                      </div>
                      <button onClick={handleClearUpdateFile} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {updateParsedRows.length > 0 && (
                      <div className="rounded-lg border overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/60 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Branch Name</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">State</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Serial No.</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {updateParsedRows.slice(0, 50).map((row, i) => (
                              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-3 py-1.5 font-medium">{row.branchName}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.stateName || "—"}</td>
                                <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.serialNumber || "—"}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{row.email || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {updateParsedRows.length > 50 && (
                          <p className="text-xs text-muted-foreground text-center py-1.5 bg-muted/30">
                            …and {updateParsedRows.length - 50} more rows
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-9 px-4" onClick={handleUpdateClose}>Cancel</Button>
                  <Button
                    size="sm"
                    className="h-9 px-5 gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0"
                    onClick={handleBulkUpdate}
                    disabled={updateParsedRows.length === 0 || bulkUpdateMutation.isPending}
                  >
                    {bulkUpdateMutation.isPending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...</>
                      : <><RefreshCw className="h-3.5 w-3.5" /> Update {updateParsedRows.length} Devices</>
                    }
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
