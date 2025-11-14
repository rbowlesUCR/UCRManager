import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Phone, Search, CheckCircle2, AlertCircle, Database, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomerTenant, PhoneNumberInventory, CountryCode } from "@shared/schema";

interface PhoneNumberPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: CustomerTenant | null;
  onSelectNumber: (phoneNumber: string) => void;
  currentNumber?: string;
}

type DialogStep = "sync" | "commit" | "select";

interface SyncResult {
  summary: {
    teamsTotal: number;
    localTotal: number;
    toAdd: number;
    toUpdate: number;
    unchanged: number;
  };
  changes: {
    toAdd: any[];
    toUpdate: any[];
    unchanged: any[];
  };
}

export function PhoneNumberPickerDialog({
  open,
  onOpenChange,
  tenant,
  onSelectNumber,
  currentNumber
}: PhoneNumberPickerDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<DialogStep>("sync");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumberInventory | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("sync");
      setSyncResult(null);
      setSearchQuery("");
      setCountryFilter("all");
      setSelectedNumber(null);
    }
  }, [open]);

  // Auto-start sync when dialog opens
  useEffect(() => {
    if (open && tenant && step === "sync" && !isSyncing && !syncResult) {
      handleSync();
    }
  }, [open, tenant, step]);

  // Fetch available countries for the tenant
  const { data: availableCountries } = useQuery<CountryCode[]>({
    queryKey: ["/api/numbers/available-countries", tenant?.id],
    enabled: !!tenant && step === "select",
    queryFn: async () => {
      const res = await fetch(`/api/numbers/available-countries?tenantId=${tenant!.id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
  });

  // Fetch available phone numbers
  const { data: phoneNumbers, isLoading: isLoadingNumbers, refetch: refetchNumbers } = useQuery({
    queryKey: ["/api/numbers/available", tenant?.id, countryFilter],
    enabled: !!tenant && step === "select",
    queryFn: async () => {
      let url = `/api/numbers?tenantId=${tenant!.id}&status=available`;
      if (countryFilter && countryFilter !== "all") {
        url += `&countryCode=${encodeURIComponent(countryFilter)}`;
      }
      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
  });

  // Mutation to commit sync changes
  const commitMutation = useMutation({
    mutationFn: async (changes: any) => {
      // Transform changes to match the API format: { tenantId, selectedChanges: [...] }
      const allChanges = [
        ...changes.toAdd,
        ...changes.toUpdate.map((c: any) => ({ ...c, action: 'update' })),
      ];
      return await apiRequest("POST", "/api/numbers/apply-sync", {
        tenantId: tenant!.id,
        selectedChanges: allChanges,
      });
    },
    onSuccess: () => {
      toast({
        title: "Sync committed",
        description: "Phone numbers have been synced to local database",
      });
      setStep("select");
      refetchNumbers();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to commit sync",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSync = async () => {
    if (!tenant) return;

    setIsSyncing(true);
    try {
      const response = await fetch(`/api/numbers/sync-from-teams/${tenant.id}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data: SyncResult = await response.json();
      setSyncResult(data);

      // If no changes, skip directly to select
      if (data.summary.toAdd === 0 && data.summary.toUpdate === 0) {
        toast({
          title: "Database is up to date",
          description: "No changes needed from Teams sync",
        });
        setStep("select");
      } else {
        setStep("commit");
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync from Teams",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCommit = () => {
    if (!syncResult) return;

    commitMutation.mutate({
      toAdd: syncResult.changes.toAdd,
      toUpdate: syncResult.changes.toUpdate,
    });
  };

  const handleSelect = () => {
    if (selectedNumber) {
      onSelectNumber(selectedNumber.lineUri);
      onOpenChange(false);
    }
  };

  const filteredNumbers = phoneNumbers?.filter((num: PhoneNumberInventory) => {
    const query = searchQuery.toLowerCase();
    return (
      num.lineUri.toLowerCase().includes(query) ||
      num.displayName?.toLowerCase().includes(query) ||
      num.location?.toLowerCase().includes(query) ||
      num.numberRange?.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        {/* STEP 1: Syncing */}
        {step === "sync" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Syncing from Teams
              </DialogTitle>
              <DialogDescription>
                Fetching phone numbers from Microsoft Teams to ensure local database is up to date...
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Querying Teams for assigned phone numbers...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This includes both users and resource accounts
              </p>
            </div>
          </>
        )}

        {/* STEP 2: Commit Changes */}
        {step === "commit" && syncResult && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Sync Results
              </DialogTitle>
              <DialogDescription>
                Review changes and commit to local database
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {syncResult.summary.toAdd}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">To Add</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {syncResult.summary.toUpdate}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">To Update</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {syncResult.summary.unchanged}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Unchanged</p>
                </div>
              </div>

              {/* Changes Preview */}
              <ScrollArea className="h-[200px] border rounded-lg p-4">
                <div className="space-y-2">
                  {syncResult.changes.toAdd.slice(0, 10).map((change, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-mono">{change.lineUri}</span>
                      <span className="text-muted-foreground">
                        {change.displayName || change.userPrincipalName}
                      </span>
                    </div>
                  ))}
                  {syncResult.changes.toUpdate.slice(0, 10).map((change, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-blue-500" />
                      <span className="font-mono">{change.lineUri}</span>
                      <span className="text-muted-foreground">Updated assignment</span>
                    </div>
                  ))}
                  {(syncResult.changes.toAdd.length + syncResult.changes.toUpdate.length > 10) && (
                    <p className="text-xs text-muted-foreground italic">
                      ... and {syncResult.changes.toAdd.length + syncResult.changes.toUpdate.length - 10} more changes
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCommit} disabled={commitMutation.isPending}>
                {commitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Commit to Database
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 3: Select Number */}
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Select Available Phone Number
              </DialogTitle>
              <DialogDescription>
                Choose from {filteredNumbers?.length || 0} available numbers in the local database
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Filters */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={countryFilter} onValueChange={(value) => setCountryFilter(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {availableCountries?.map((country) => (
                      <SelectItem key={country.id} value={country.countryCode}>
                        {country.flag} {country.countryName} ({country.countryCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by number, name, location, or range..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              {/* Number List */}
              {isLoadingNumbers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredNumbers && filteredNumbers.length > 0 ? (
                <ScrollArea className="h-[400px] border rounded-lg">
                  <div className="space-y-2 p-4">
                    {filteredNumbers.map((number: PhoneNumberInventory) => (
                      <button
                        key={number.id}
                        onClick={() => setSelectedNumber(number)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedNumber?.id === number.id
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-mono font-semibold text-sm">
                              {number.lineUri}
                            </p>
                            {number.displayName && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {number.displayName}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              {number.location && (
                                <Badge variant="outline" className="text-xs">
                                  {number.location}
                                </Badge>
                              )}
                              {number.numberRange && (
                                <Badge variant="secondary" className="text-xs">
                                  {number.numberRange}
                                </Badge>
                              )}
                              {number.carrier && (
                                <Badge variant="outline" className="text-xs">
                                  {number.carrier}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {selectedNumber?.id === number.id && (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No available phone numbers found</p>
                  <p className="text-sm mt-2">
                    {searchQuery
                      ? "Try a different search query"
                      : "Add numbers to inventory first"}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSelect} disabled={!selectedNumber}>
                <Phone className="w-4 h-4 mr-2" />
                Select Number
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
