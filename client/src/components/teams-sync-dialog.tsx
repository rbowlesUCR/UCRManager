import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CustomerTenant } from "@shared/schema";

interface TeamsSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: CustomerTenant;
  onSyncComplete: () => void;
  autoSync?: boolean;  // New prop to trigger automatic sync
}

export function TeamsSyncDialog({ open, onOpenChange, tenant, onSyncComplete, autoSync = false }: TeamsSyncDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [selectedToUpdate, setSelectedToUpdate] = useState<Set<string>>(new Set());

  const handleSync = async () => {
    setIsLoading(true);
    try {
      console.log("[TeamsSyncDialog] Starting sync for tenant:", tenant.id);
      const response = await apiRequest("POST", `/api/numbers/sync-from-teams/${tenant.id}`, {});
      const data = await response.json();
      console.log("[TeamsSyncDialog] Sync data received:", data);
      setSyncData(data);

      // Select all by default
      setSelectedToAdd(new Set(data.changes.toAdd.map((c: any) => c.lineUri)));
      setSelectedToUpdate(new Set(data.changes.toUpdate.map((c: any) => c.lineUri)));
      console.log("[TeamsSyncDialog] Selected counts - Add:", data.changes.toAdd.length, "Update:", data.changes.toUpdate.length);

      toast({
        title: "Sync complete",
        description: `Found ${data.summary.toAdd + data.summary.toUpdate} changes`,
      });
    } catch (error: any) {
      console.error("[TeamsSyncDialog] Sync error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with Teams",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!syncData) return;

    const selectedChanges = [
      ...syncData.changes.toAdd.filter((c: any) => selectedToAdd.has(c.lineUri)),
      ...syncData.changes.toUpdate.filter((c: any) => selectedToUpdate.has(c.lineUri)),
    ];

    if (selectedChanges.length === 0) {
      toast({
        title: "No changes selected",
        description: "Please select at least one change to apply",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      console.log("[TeamsSyncDialog] Applying changes:", selectedChanges);
      const response = await apiRequest("POST", "/api/numbers/apply-sync", {
        tenantId: tenant.id,
        selectedChanges,
      });
      const result = await response.json();
      console.log("[TeamsSyncDialog] Apply result:", result);

      toast({
        title: "Sync applied successfully",
        description: `Added: ${result.added}, Updated: ${result.updated}`,
      });

      onSyncComplete();
      onOpenChange(false);
      setSyncData(null);
    } catch (error: any) {
      console.error("[TeamsSyncDialog] Apply error:", error);
      toast({
        title: "Failed to apply changes",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const toggleAllToAdd = () => {
    if (selectedToAdd.size === syncData?.changes.toAdd.length) {
      setSelectedToAdd(new Set());
    } else {
      setSelectedToAdd(new Set(syncData?.changes.toAdd.map((c: any) => c.lineUri)));
    }
  };

  const toggleAllToUpdate = () => {
    if (selectedToUpdate.size === syncData?.changes.toUpdate.length) {
      setSelectedToUpdate(new Set());
    } else {
      setSelectedToUpdate(new Set(syncData?.changes.toUpdate.map((c: any) => c.lineUri)));
    }
  };

  // Auto-sync when dialog opens if autoSync prop is true
  useEffect(() => {
    if (open && autoSync && !syncData && !isLoading) {
      console.log("[TeamsSyncDialog] Auto-syncing for tenant:", tenant.id);
      handleSync();
    }
  }, [open, autoSync]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSyncData(null);
      setSelectedToAdd(new Set());
      setSelectedToUpdate(new Set());
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent closing while syncing or applying
    if (!newOpen && (isLoading || isApplying)) {
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sync from Microsoft Teams
          </DialogTitle>
          <DialogDescription>
            Compare phone numbers from Teams with your local database and select changes to apply
          </DialogDescription>
        </DialogHeader>

        {!syncData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            {isLoading ? (
              <>
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Syncing phone numbers from Teams...
                </p>
              </>
            ) : (
              <>
                <RefreshCw className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click "Start Sync" to fetch phone numbers from Teams
                </p>
                <Button onClick={handleSync}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start Sync
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{syncData.summary.teamsTotal}</p>
                <p className="text-xs text-muted-foreground">In Teams</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{syncData.summary.localTotal}</p>
                <p className="text-xs text-muted-foreground">In Database</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{syncData.summary.toAdd}</p>
                <p className="text-xs text-muted-foreground">To Add</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{syncData.summary.toUpdate}</p>
                <p className="text-xs text-muted-foreground">To Update</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">{syncData.summary.unchanged}</p>
                <p className="text-xs text-muted-foreground">Unchanged</p>
              </div>
            </div>

            {/* Changes Tabs */}
            <Tabs defaultValue="add" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="add">
                  To Add ({syncData.summary.toAdd})
                </TabsTrigger>
                <TabsTrigger value="update">
                  To Update ({syncData.summary.toUpdate})
                </TabsTrigger>
                <TabsTrigger value="unchanged">
                  Unchanged ({syncData.summary.unchanged})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="space-y-4">
                {syncData.changes.toAdd.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={selectedToAdd.size === syncData.changes.toAdd.length}
                        onCheckedChange={toggleAllToAdd}
                      />
                      <span>Select all ({selectedToAdd.size} selected)</span>
                    </div>
                    <div className="border rounded-lg max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Line URI</TableHead>
                            <TableHead>Display Name</TableHead>
                            <TableHead>UPN</TableHead>
                            <TableHead>Policy</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncData.changes.toAdd.map((change: any) => (
                            <TableRow key={change.lineUri}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedToAdd.has(change.lineUri)}
                                  onCheckedChange={() => {
                                    const newSet = new Set(selectedToAdd);
                                    if (newSet.has(change.lineUri)) {
                                      newSet.delete(change.lineUri);
                                    } else {
                                      newSet.add(change.lineUri);
                                    }
                                    setSelectedToAdd(newSet);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm">{change.lineUri}</TableCell>
                              <TableCell>{change.displayName || "-"}</TableCell>
                              <TableCell className="text-sm">{change.userPrincipalName || "-"}</TableCell>
                              <TableCell className="text-sm">{change.onlineVoiceRoutingPolicy || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
                    <p>No new numbers to add</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="update" className="space-y-4">
                {syncData.changes.toUpdate.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={selectedToUpdate.size === syncData.changes.toUpdate.length}
                        onCheckedChange={toggleAllToUpdate}
                      />
                      <span>Select all ({selectedToUpdate.size} selected)</span>
                    </div>
                    <div className="border rounded-lg max-h-96 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Line URI</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Local Value</TableHead>
                            <TableHead>Teams Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncData.changes.toUpdate.map((change: any) => {
                            const changes = [];
                            if (change.local.displayName !== change.teams.displayName) {
                              changes.push({ field: "Display Name", local: change.local.displayName, teams: change.teams.displayName });
                            }
                            if (change.local.userPrincipalName !== change.teams.userPrincipalName) {
                              changes.push({ field: "UPN", local: change.local.userPrincipalName, teams: change.teams.userPrincipalName });
                            }
                            if (change.local.onlineVoiceRoutingPolicy !== change.teams.onlineVoiceRoutingPolicy) {
                              changes.push({ field: "Policy", local: change.local.onlineVoiceRoutingPolicy, teams: change.teams.onlineVoiceRoutingPolicy });
                            }

                            return changes.map((diff, idx) => (
                              <TableRow key={`${change.lineUri}-${idx}`}>
                                {idx === 0 && (
                                  <TableCell rowSpan={changes.length}>
                                    <Checkbox
                                      checked={selectedToUpdate.has(change.lineUri)}
                                      onCheckedChange={() => {
                                        const newSet = new Set(selectedToUpdate);
                                        if (newSet.has(change.lineUri)) {
                                          newSet.delete(change.lineUri);
                                        } else {
                                          newSet.add(change.lineUri);
                                        }
                                        setSelectedToUpdate(newSet);
                                      }}
                                    />
                                  </TableCell>
                                )}
                                {idx === 0 && (
                                  <TableCell rowSpan={changes.length} className="font-mono text-sm">{change.lineUri}</TableCell>
                                )}
                                <TableCell><Badge variant="outline">{diff.field}</Badge></TableCell>
                                <TableCell className="text-sm text-red-600">{diff.local || "-"}</TableCell>
                                <TableCell className="text-sm text-green-600">{diff.teams || "-"}</TableCell>
                              </TableRow>
                            ));
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
                    <p>No updates needed</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="unchanged">
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
                  <p>{syncData.summary.unchanged} numbers are in sync</p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading || isApplying}>
            Cancel
          </Button>
          {syncData && (
            <Button onClick={handleSync} variant="outline" disabled={isLoading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
          {syncData && (
            <Button onClick={handleApply} disabled={isApplying || (selectedToAdd.size === 0 && selectedToUpdate.size === 0)}>
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                `Apply Selected (${selectedToAdd.size + selectedToUpdate.size})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
