import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, AlertCircle, Download, Undo2 } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import type { AuditLog } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminAuditLogs() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: auditLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const rollbackMutation = useMutation({
    mutationFn: async (logId: string) => {
      const response = await apiRequest("POST", `/api/teams/rollback/${logId}`, {});
      return await response.json();
    },
    onSuccess: () => {
      setRollbackDialogOpen(false);
      setSelectedLog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({
        title: "Rollback successful",
        description: "The change has been reverted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rollback failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRollbackClick = (log: AuditLog) => {
    setSelectedLog(log);
    setRollbackDialogOpen(true);
  };

  const handleConfirmRollback = () => {
    if (selectedLog) {
      rollbackMutation.mutate(selectedLog.id);
    }
  };

  const canRollback = (log: AuditLog) => {
    return (
      log.status === "success" &&
      log.targetUserId &&
      (log.previousPhoneNumber || log.previousRoutingPolicy) &&
      log.changeType !== "rollback"
    );
  };

  const filteredLogs = auditLogs?.filter((log) => {
    const query = searchQuery.toLowerCase();
    return (
      log.operatorEmail.toLowerCase().includes(query) ||
      log.operatorName.toLowerCase().includes(query) ||
      log.tenantName.toLowerCase().includes(query) ||
      log.targetUserName.toLowerCase().includes(query) ||
      log.changeDescription.toLowerCase().includes(query)
    );
  });

  const exportToCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      return;
    }

    // CSV headers
    const headers = [
      "Timestamp",
      "Operator Name",
      "Operator Email",
      "Tenant Name",
      "Tenant ID",
      "Target User Name",
      "Target User UPN",
      "Change Type",
      "Change Description",
      "Phone Number",
      "Routing Policy",
      "Status",
      "Error Message",
    ];

    // CSV rows with normalized values
    const rows = filteredLogs.map((log) => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.operatorName || "",
      log.operatorEmail || "",
      log.tenantName || "",
      log.tenantId || "",
      log.targetUserName || "",
      log.targetUserUpn || "",
      log.changeType || "",
      log.changeDescription || "",
      log.phoneNumber || "",
      log.routingPolicy || "",
      log.status || "",
      log.errorMessage || "",
    ]);

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Generate CSV content
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(String).map(escapeCSV).join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Change History
            </CardTitle>
            <CardDescription>
              Complete audit trail of all Teams voice configuration changes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar and Export */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by operator, tenant, user, or change description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-9"
                  data-testid="input-search-logs"
                />
              </div>
              <Button
                onClick={exportToCSV}
                disabled={!filteredLogs || filteredLogs.length === 0}
                className="h-11"
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">OPERATOR</TableHead>
                      <TableHead className="font-semibold">TENANT</TableHead>
                      <TableHead className="font-semibold">USER</TableHead>
                      <TableHead className="font-semibold">CHANGE</TableHead>
                      <TableHead className="font-semibold">DATE/TIME</TableHead>
                      <TableHead className="font-semibold">STATUS</TableHead>
                      <TableHead className="font-semibold w-[80px]">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{log.operatorName}</div>
                            <div className="text-xs text-muted-foreground">{log.operatorEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.tenantName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{log.targetUserName}</div>
                            <div className="text-xs text-muted-foreground">{log.targetUserUpn}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">{log.changeDescription}</div>
                            {log.phoneNumber && (
                              <div className="text-xs text-muted-foreground">
                                Phone: {log.phoneNumber}
                              </div>
                            )}
                            {log.routingPolicy && (
                              <div className="text-xs text-muted-foreground">
                                Policy: {log.routingPolicy}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.status === "success" ? "default" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-status-${log.status}`}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canRollback(log) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRollbackClick(log)}
                              title="Rollback this change"
                              data-testid={`button-rollback-${log.id}`}
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
                  {searchQuery ? (
                    <Search className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? "No matching logs found" : "No audit logs yet"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {searchQuery
                    ? "Try adjusting your search criteria"
                    : "Audit logs will appear here when operators make changes"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent data-testid="dialog-rollback-confirm">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              Are you sure you want to rollback this change? This will revert the user's voice configuration to the previous values.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">User:</div>
                <div>{selectedLog.targetUserName}</div>
                
                <div className="font-medium">Current Phone:</div>
                <div>{selectedLog.phoneNumber || "-"}</div>
                
                <div className="font-medium">Current Policy:</div>
                <div>{selectedLog.routingPolicy || "-"}</div>
                
                <div className="font-medium text-destructive">Rollback to Phone:</div>
                <div className="text-destructive">{selectedLog.previousPhoneNumber || "(none)"}</div>
                
                <div className="font-medium text-destructive">Rollback to Policy:</div>
                <div className="text-destructive">{selectedLog.previousRoutingPolicy || "(none)"}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackDialogOpen(false)}
              disabled={rollbackMutation.isPending}
              data-testid="button-cancel-rollback"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRollback}
              disabled={rollbackMutation.isPending}
              data-testid="button-confirm-rollback"
            >
              {rollbackMutation.isPending ? "Rolling back..." : "Confirm Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
