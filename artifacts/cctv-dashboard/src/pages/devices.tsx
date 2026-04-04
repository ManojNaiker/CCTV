import { useState } from "react";
import { format } from "date-fns";
import { Search, Plus, MoreHorizontal, FileEdit, Trash2, Video } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListDevices,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
  getListDevicesQueryKey
} from "@workspace/api-client-react";
import { DeviceStatus } from "@workspace/api-client-react/src/generated/api.schemas";

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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Devices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createData, setCreateData] = useState({ serialNumber: "", branchName: "", stateName: "", remark: "" });

  const [editDevice, setEditDevice] = useState<any>(null);
  const [editData, setEditData] = useState({ branchName: "", stateName: "", status: "online" as any, remark: "" });

  const [deleteDevice, setDeleteDevice] = useState<any>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Inventory</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all CCTV cameras across branches.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by branch or serial number..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : devices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center">
                        <Video className="h-8 w-8 mb-2 opacity-20" />
                        No devices found matching your criteria.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  devices?.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-medium">{device.branchName}</TableCell>
                      <TableCell className="font-mono text-xs">{device.serialNumber}</TableCell>
                      <TableCell>{device.stateName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={device.status === 'online' ? 'default' : device.status === 'offline' ? 'destructive' : 'secondary'}
                          className={device.status === 'online' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                        >
                          {device.status}
                        </Badge>
                        {device.status === 'offline' && device.offlineDays && device.offlineDays > 0 && (
                          <span className="ml-2 text-xs text-destructive font-medium">
                            {device.offlineDays}d
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {device.lastSeenAt ? format(new Date(device.lastSeenAt), "MMM d, yyyy HH:mm") : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[200px]" title={device.remark || ""}>
                          {device.remark || <span className="text-muted-foreground italic">None</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(device)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              Edit Device
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => setDeleteDevice(device)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Device
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
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input value={createData.serialNumber} onChange={e => setCreateData({...createData, serialNumber: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Branch Name</Label>
              <Input value={createData.branchName} onChange={e => setCreateData({...createData, branchName: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>State Name</Label>
              <Input value={createData.stateName} onChange={e => setCreateData({...createData, stateName: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Remark</Label>
              <Input value={createData.remark} onChange={e => setCreateData({...createData, remark: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !createData.serialNumber || !createData.branchName}>Add Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDevice} onOpenChange={(open) => !open && setEditDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device: {editDevice?.serialNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Branch Name</Label>
              <Input value={editData.branchName} onChange={e => setEditData({...editData, branchName: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>State Name</Label>
              <Input value={editData.stateName} onChange={e => setEditData({...editData, stateName: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={editData.status} onValueChange={(v: any) => setEditData({...editData, status: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Remark</Label>
              <Input value={editData.remark} onChange={e => setEditData({...editData, remark: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDevice} onOpenChange={(open) => !open && setDeleteDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Are you sure you want to delete the device at {deleteDevice?.branchName} ({deleteDevice?.serialNumber})? This action cannot be undone.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDevice(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
