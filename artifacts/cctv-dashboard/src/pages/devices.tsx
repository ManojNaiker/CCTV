import { useState, useMemo, useRef } from "react";
import { format } from "date-fns";
import { Search, Plus, MoreHorizontal, FileEdit, Trash2, Video, Upload, ChevronRight, CheckCircle2, AlertCircle, SkipForward, Download, FileSpreadsheet, X, Send, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { 
  useListDevices,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
  useBulkCreateDevices,
  getListDevicesQueryKey
} from "@workspace/api-client-react";

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
  const [editData, setEditData] = useState({ branchName: "", stateName: "", status: "online" as any, remark: "" });

  const [deleteDevice, setDeleteDevice] = useState<any>(null);

  const [sendingAlertId, setSendingAlertId] = useState<number | null>(null);

  const handleSendAlert = async (device: any) => {
    setSendingAlertId(device.id);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");
      const res = await fetch(`${BASE}/api/devices/${device.id}/send-alert`, { method: "POST" });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        toast({ title: "Alert email sent", description: `Alert email sent for ${device.branchName}.` });
      } else {
        toast({ title: "Email send failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "An error occurred while sending the email.", variant: "destructive" });
    } finally {
      setSendingAlertId(null);
    }
  };

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [fileError, setFileError] = useState<string>("");

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
    updateMutation.mutate({ id: editDevice.id, data: editData });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: deleteDevice.id });
  };

  const openEdit = (device: any) => {
    setEditDevice(device);
    setEditData({ branchName: device.branchName, stateName: device.stateName, status: device.status, remark: device.remark || "" });
  };

  const handleBulkClose = () => {
    setIsBulkOpen(false);
    setParsedRows([]);
    setSelectedFile(null);
    setFileError("");
    setBulkResult(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Inventory</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage CCTV devices across all branches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsBulkOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Bulk Import
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Device
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search branch, serial, state..."
                className="pl-8 text-xs h-8 bg-background/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs bg-background/50">
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

          <div className="rounded border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-border/50">
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">Branch</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">Serial No.</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">State</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">Status</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">Updated</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground h-9">Remarks</TableHead>
                  <TableHead className="w-[50px] h-9" />
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
                            {device.status === "offline" && (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                                disabled={sendingAlertId === device.id}
                                onClick={() => handleSendAlert(device)}
                              >
                                {sendingAlertId === device.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Send className="h-3.5 w-3.5" />}
                                Send Alert Email
                              </DropdownMenuItem>
                            )}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              <span className="text-primary">~</span> Edit Device
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Branch Name</Label>
              <Input className="text-sm h-8 bg-background/50" value={editData.branchName} onChange={e => setEditData({...editData, branchName: e.target.value})} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">State Name</Label>
              <Input className="text-sm h-8 bg-background/50" value={editData.stateName} onChange={e => setEditData({...editData, stateName: e.target.value})} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select value={editData.status} onValueChange={(v: any) => setEditData({...editData, status: v})}>
                <SelectTrigger className="text-xs h-8 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Remark</Label>
              <Input className="text-sm h-8 bg-background/50" value={editData.remark} onChange={e => setEditData({...editData, remark: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setEditDevice(null)}>Cancel</Button>
            <Button size="sm" className="text-xs h-8" onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
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
    </div>
  );
}
