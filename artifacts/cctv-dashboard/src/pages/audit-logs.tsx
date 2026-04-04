import { useState } from "react";
import { format } from "date-fns";
import { ClipboardList, Activity } from "lucide-react";
import { 
  useListAuditLogs,
  getListAuditLogsQueryKey
} from "@workspace/api-client-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: logsData, isLoading } = useListAuditLogs(
    { limit, offset: page * limit },
    { query: { queryKey: getListAuditLogsQueryKey({ limit, offset: page * limit }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            Complete record of system changes and user actions.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 w-[200px]">Timestamp</TableHead>
                <TableHead className="w-[150px]">User</TableHead>
                <TableHead className="w-[150px]">Action Type</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : logsData?.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
                      No audit logs found.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                logsData?.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="pl-6 text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {log.username || 'System'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs bg-muted">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.description}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
