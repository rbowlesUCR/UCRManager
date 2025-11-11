import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Upload, CheckCircle2, XCircle, AlertCircle, List } from "lucide-react";
import { PhoneNumberPickerDialog } from "./phone-number-picker-dialog";
import type { TeamsUser, VoiceRoutingPolicy, CustomerTenant } from "@shared/schema";

interface BulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTenant: CustomerTenant | null;
}

interface UserAssignment {
  userId: string;
  userName: string;
  phoneNumber: string;
  routingPolicy: string;
}

interface BulkResult {
  userId: string;
  userName: string;
  success: boolean;
  error?: string;
}

export function BulkAssignmentDialog({ open, onOpenChange, selectedTenant }: BulkAssignmentDialogProps) {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userAssignments, setUserAssignments] = useState<Map<string, UserAssignment>>(new Map());
  const [results, setResults] = useState<BulkResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phonePickerUserId, setPhonePickerUserId] = useState<string | null>(null);

  // Fetch Teams users
  const { data: teamsUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/teams/users", selectedTenant?.id],
    enabled: !!selectedTenant && open,
  });

  // Fetch routing policies via PowerShell (same as Dashboard)
  const { data: routingPoliciesData, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ["/api/powershell/get-policies", selectedTenant?.id],
    enabled: !!selectedTenant && open,
    queryFn: async () => {
      console.log("[BulkAssignment] Fetching policies for tenant:", selectedTenant?.id);
      const res = await fetch(`/api/powershell/get-policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ tenantId: selectedTenant?.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[BulkAssignment] Failed to fetch policies: ${text}`);
        throw new Error(`${res.status}: ${text}`);
      }
      const data = await res.json();
      console.log("[BulkAssignment] PowerShell policies response:", data);

      // The PowerShell endpoint returns { success: true, policies: [...] }
      if (data.success && data.policies) {
        console.log(`[BulkAssignment] Retrieved ${data.policies.length} policies`);
        return data.policies;
      }

      console.warn("[BulkAssignment] No policies returned from PowerShell");
      return [];
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (assignments: UserAssignment[]) => {
      const response = await apiRequest("POST", "/api/teams/bulk-assign-voice", {
        tenantId: selectedTenant!.id,
        assignments,
      });
      return await response.json();
    },
    onMutate: () => {
      setProgress(0);
    },
    onSuccess: (data: { results: BulkResult[] }) => {
      setResults(data.results);
      setIsProcessing(false);
      setProgress(100);
      const successCount = data.results.filter(r => r.success).length;
      const failCount = data.results.filter(r => !r.success).length;

      toast({
        title: "Bulk assignment complete",
        description: `${successCount} successful, ${failCount} failed`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      // Refetch users to get updated data
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      setProgress(0);
      toast({
        title: "Bulk assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validate phone number format (tel: URI with E.164)
  const validatePhoneNumber = (number: string): { isValid: boolean; message: string } => {
    if (!number) {
      return { isValid: false, message: "Phone number is required" };
    }

    // Check if it starts with tel:
    if (!number.startsWith("tel:")) {
      return { isValid: false, message: "Must start with 'tel:'" };
    }

    // Extract the number part after tel:
    const numberPart = number.substring(4);

    // Check if it starts with +
    if (!numberPart.startsWith("+")) {
      return { isValid: false, message: "Number must start with + after tel:" };
    }

    // Check if the rest contains only digits (E.164 allows 1-15 digits after +)
    const digitsOnly = numberPart.substring(1);
    if (!/^\d{1,15}$/.test(digitsOnly)) {
      return { isValid: false, message: "Must contain 1-15 digits (E.164 format)" };
    }

    // Typically need at least 7 digits for a valid phone number
    if (digitsOnly.length < 7) {
      return { isValid: false, message: "Must contain at least 7 digits" };
    }

    return { isValid: true, message: "Valid" };
  };

  const handleUserToggle = (userId: string, userName: string) => {
    const newSet = new Set(selectedUsers);
    const newAssignments = new Map(userAssignments);

    if (newSet.has(userId)) {
      newSet.delete(userId);
      newAssignments.delete(userId);
    } else {
      newSet.add(userId);
      // Initialize assignment with empty values
      newAssignments.set(userId, {
        userId,
        userName,
        phoneNumber: "",
        routingPolicy: "",
      });
    }

    setSelectedUsers(newSet);
    setUserAssignments(newAssignments);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === (teamsUsers as TeamsUser[])?.length) {
      setSelectedUsers(new Set());
      setUserAssignments(new Map());
    } else {
      const allUsers = (teamsUsers as TeamsUser[]) || [];
      const newSet = new Set(allUsers.map(u => u.id));
      const newAssignments = new Map<string, UserAssignment>();

      allUsers.forEach(user => {
        newAssignments.set(user.id, {
          userId: user.id,
          userName: user.displayName,
          phoneNumber: "",
          routingPolicy: "",
        });
      });

      setSelectedUsers(newSet);
      setUserAssignments(newAssignments);
    }
  };

  const updateUserAssignment = (userId: string, field: 'phoneNumber' | 'routingPolicy', value: string) => {
    const newAssignments = new Map(userAssignments);
    const assignment = newAssignments.get(userId);
    if (assignment) {
      assignment[field] = value;
      newAssignments.set(userId, assignment);
      setUserAssignments(newAssignments);
    }
  };

  const handleSubmit = () => {
    if (!selectedTenant || selectedUsers.size === 0) {
      toast({
        title: "Missing information",
        description: "Please select users to configure",
        variant: "destructive",
      });
      return;
    }

    // Validate all assignments
    const assignments = Array.from(userAssignments.values());
    const missingData = assignments.filter(a => !a.phoneNumber || !a.routingPolicy);

    if (missingData.length > 0) {
      toast({
        title: "Incomplete assignments",
        description: `${missingData.length} user(s) are missing phone number or routing policy`,
        variant: "destructive",
      });
      return;
    }

    // Validate all phone numbers
    const invalidNumbers = assignments.filter(a => !validatePhoneNumber(a.phoneNumber).isValid);
    if (invalidNumbers.length > 0) {
      toast({
        title: "Invalid phone numbers",
        description: `${invalidNumbers.length} phone number(s) failed validation. Please check the format (e.g., tel:+15551234567)`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    // Simulate progress updates (since we can't stream from backend)
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 5, 90));
    }, 300);

    bulkAssignMutation.mutate(assignments, {
      onSettled: () => {
        clearInterval(progressInterval);
      },
    });
  };

  const handleClose = () => {
    setSelectedUsers(new Set());
    setUserAssignments(new Map());
    setResults([]);
    setProgress(0);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const users = (teamsUsers as TeamsUser[]) || [];
  const policies = (routingPoliciesData as VoiceRoutingPolicy[]) || [];

  // Debug logging
  useEffect(() => {
    if (open && selectedTenant) {
      console.log("[BulkAssignment] Dialog opened");
      console.log("[BulkAssignment] Users:", users.length);
      console.log("[BulkAssignment] Policies:", policies.length);
      console.log("[BulkAssignment] Policy data:", policies);
    }
  }, [open, selectedTenant, users.length, policies.length]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Voice Configuration
          </DialogTitle>
          <DialogDescription>
            Select users and assign individual phone numbers and routing policies
          </DialogDescription>
        </DialogHeader>

        {results.length > 0 ? (
          // Results view
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold">Bulk assignment complete</p>
                <p className="text-sm text-muted-foreground">
                  {results.filter(r => r.success).length} successful, {results.filter(r => !r.success).length} failed
                </p>
              </div>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="font-medium">{result.userName}</span>
                    </div>
                    {result.error && (
                      <span className="text-xs text-destructive">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button onClick={handleClose} data-testid="button-close-results">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Configuration view
          <div className="space-y-4">
            {/* User Selection Header */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Select Users and Configure</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={isLoadingUsers}
                data-testid="button-select-all-users"
              >
                {selectedUsers.size === users.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            {isLoadingUsers || isLoadingPolicies ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* User Configuration List */}
                <ScrollArea className="h-[500px] border rounded-md">
                  <div className="p-4 space-y-4">
                    {users.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No users available</p>
                      </div>
                    ) : (
                      users.map((user) => (
                        <div
                          key={user.id}
                          className={`p-4 border rounded-lg ${
                            selectedUsers.has(user.id) ? "border-primary bg-accent/50" : "border-border"
                          }`}
                        >
                          {/* User Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <Checkbox
                              checked={selectedUsers.has(user.id)}
                              onCheckedChange={() => handleUserToggle(user.id, user.displayName)}
                              data-testid={`checkbox-user-${user.id}`}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{user.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {user.userPrincipalName}
                              </p>
                              {user.lineUri && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Current: {user.lineUri}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Configuration Fields - Only show if selected */}
                          {selectedUsers.has(user.id) && (
                            <div className="grid grid-cols-2 gap-3 mt-3 pl-8">
                              {/* Phone Number Input */}
                              <div className="space-y-1">
                                <Label htmlFor={`phone-${user.id}`} className="text-xs">
                                  Phone Number
                                </Label>
                                <div className="flex gap-1">
                                  <Input
                                    id={`phone-${user.id}`}
                                    value={userAssignments.get(user.id)?.phoneNumber || ""}
                                    onChange={(e) => updateUserAssignment(user.id, 'phoneNumber', e.target.value)}
                                    placeholder="tel:+15551234567"
                                    className="h-9 text-sm flex-1"
                                    data-testid={`input-phone-${user.id}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPhonePickerUserId(user.id)}
                                    className="h-9 px-2"
                                    title="Select from inventory"
                                  >
                                    <List className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Routing Policy Dropdown */}
                              <div className="space-y-1">
                                <Label htmlFor={`policy-${user.id}`} className="text-xs">
                                  Routing Policy
                                </Label>
                                <Select
                                  value={userAssignments.get(user.id)?.routingPolicy || ""}
                                  onValueChange={(value) => updateUserAssignment(user.id, 'routingPolicy', value)}
                                >
                                  <SelectTrigger className="h-9 text-sm" data-testid={`select-policy-${user.id}`}>
                                    <SelectValue placeholder="Select policy" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {policies.map((policy) => (
                                      <SelectItem key={policy.id} value={policy.name}>
                                        {policy.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Summary */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected</span>
                  {selectedUsers.size > 0 && (
                    <span>
                      {Array.from(userAssignments.values()).filter(a => a.phoneNumber && a.routingPolicy).length} / {selectedUsers.size} configured
                    </span>
                  )}
                </div>

                {/* Processing Progress */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processing assignments...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {results.length === 0 && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
              data-testid="button-cancel-bulk"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedUsers.size === 0 || isProcessing}
              data-testid="button-submit-bulk"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Assign to {selectedUsers.size} Users
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Phone Number Picker Dialog */}
      {phonePickerUserId && (
        <PhoneNumberPickerDialog
          open={phonePickerUserId !== null}
          onOpenChange={(open) => {
            if (!open) setPhonePickerUserId(null);
          }}
          tenant={selectedTenant}
          onSelectNumber={(number) => {
            if (phonePickerUserId) {
              updateUserAssignment(phonePickerUserId, 'phoneNumber', number);
              setPhonePickerUserId(null);
            }
          }}
          currentNumber={phonePickerUserId ? userAssignments.get(phonePickerUserId)?.phoneNumber || "" : ""}
        />
      )}
    </Dialog>
  );
}
