import { useState } from "react";
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
import { Loader2, Users, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { TeamsUser, VoiceRoutingPolicy, CustomerTenant } from "@shared/schema";

interface BulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTenant: CustomerTenant | null;
}

interface BulkAssignment {
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
  const [phoneNumberPrefix, setPhoneNumberPrefix] = useState("tel:+1");
  const [startingNumber, setStartingNumber] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Fetch Teams users
  const { data: teamsUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/teams/users", selectedTenant?.id],
    enabled: !!selectedTenant && open,
  });

  // Fetch routing policies
  const { data: routingPolicies, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ["/api/teams/routing-policies", selectedTenant?.id],
    enabled: !!selectedTenant && open,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (assignments: BulkAssignment[]) => {
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

  const handleUserToggle = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === (teamsUsers as TeamsUser[])?.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set((teamsUsers as TeamsUser[])?.map(u => u.id) || []));
    }
  };

  const handleSubmit = () => {
    if (!selectedTenant || selectedUsers.size === 0 || !selectedPolicy) {
      toast({
        title: "Missing information",
        description: "Please select users and a routing policy",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number prefix
    if (!phoneNumberPrefix.startsWith("tel:+")) {
      toast({
        title: "Invalid phone number prefix",
        description: "Prefix must start with 'tel:+' (e.g., tel:+1)",
        variant: "destructive",
      });
      return;
    }

    // Generate assignments with sequential phone numbers
    const assignments: BulkAssignment[] = [];
    const userList = (teamsUsers as TeamsUser[]).filter(u => selectedUsers.has(u.id));
    let baseNumber = parseInt(startingNumber) || 1;

    userList.forEach((user, index) => {
      const phoneNumber = startingNumber 
        ? `${phoneNumberPrefix}${(baseNumber + index).toString().padStart(startingNumber.length, '0')}`
        : `${phoneNumberPrefix}${index + baseNumber}`;

      assignments.push({
        userId: user.id,
        userName: user.displayName,
        phoneNumber,
        routingPolicy: selectedPolicy,
      });
    });

    // Validate all generated phone numbers
    const invalidNumbers = assignments.filter(a => !validatePhoneNumber(a.phoneNumber).isValid);
    if (invalidNumbers.length > 0) {
      toast({
        title: "Invalid phone numbers generated",
        description: `${invalidNumbers.length} phone numbers failed validation. Please check your prefix and starting number.`,
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
    setPhoneNumberPrefix("tel:+1");
    setStartingNumber("");
    setSelectedPolicy("");
    setResults([]);
    setProgress(0);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const users = (teamsUsers as TeamsUser[]) || [];
  const policies = (routingPolicies as VoiceRoutingPolicy[]) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bulk Voice Configuration
          </DialogTitle>
          <DialogDescription>
            Assign phone numbers and routing policies to multiple users at once
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
          <div className="space-y-6">
            {/* User Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Select Users</Label>
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

              {isLoadingUsers ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-48 border rounded-md p-4">
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => handleUserToggle(user.id)}
                          data-testid={`checkbox-user-${user.id}`}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.userPrincipalName}
                            {user.lineUri && ` • Current: ${user.lineUri}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <p className="text-xs text-muted-foreground">
                {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Phone Number Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone-prefix" className="text-sm font-semibold">
                  Phone Number Prefix
                </Label>
                <Input
                  id="phone-prefix"
                  value={phoneNumberPrefix}
                  onChange={(e) => setPhoneNumberPrefix(e.target.value)}
                  placeholder="tel:+1"
                  data-testid="input-phone-prefix"
                />
                <p className="text-xs text-muted-foreground">
                  E.g., tel:+1 for US numbers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="starting-number" className="text-sm font-semibold">
                  Starting Number (Optional)
                </Label>
                <Input
                  id="starting-number"
                  value={startingNumber}
                  onChange={(e) => setStartingNumber(e.target.value)}
                  placeholder="5551000"
                  data-testid="input-starting-number"
                />
                <p className="text-xs text-muted-foreground">
                  Sequential numbers will be generated
                </p>
              </div>
            </div>

            {/* Routing Policy */}
            <div className="space-y-2">
              <Label htmlFor="routing-policy" className="text-sm font-semibold">
                Voice Routing Policy
              </Label>
              {isLoadingPolicies ? (
                <div className="h-11 flex items-center justify-center border rounded-md">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
                  <SelectTrigger className="h-11" data-testid="select-bulk-routing-policy">
                    <SelectValue placeholder="Select a routing policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((policy) => (
                      <SelectItem key={policy.id} value={policy.name}>
                        {policy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview */}
            {selectedUsers.size > 0 && selectedPolicy && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold">Preview</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedUsers.size} users will be assigned numbers starting with {phoneNumberPrefix}
                      {startingNumber && ` from ${startingNumber}`} and policy {selectedPolicy}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing assignments...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
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
              disabled={selectedUsers.size === 0 || !selectedPolicy || isProcessing}
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
    </Dialog>
  );
}
