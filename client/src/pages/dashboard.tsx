import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, X, Users, Phone, Upload, Terminal, Settings2, PhoneOff, RotateCcw, List } from "lucide-react";
import { TenantSelector } from "@/components/tenant-selector";
import { UserSearchCombobox } from "@/components/user-search-combobox";
import { BulkAssignmentDialog } from "@/components/bulk-assignment-dialog";
import { ConfigurationProfiles } from "@/components/configuration-profiles";
import { PowerShellMfaModal } from "@/components/powershell-mfa-modal";
import { PhoneNumberPickerDialog } from "@/components/phone-number-picker-dialog";
import type { TeamsUser, VoiceRoutingPolicy, CustomerTenant, ConfigurationProfile, FeatureFlag } from "@shared/schema";

interface UserVoiceConfig {
  displayName: string;
  userPrincipalName: string;
  lineUri: string | null;
  voiceRoutingPolicy: string | null;
  enterpriseVoiceEnabled: boolean;
  hostedVoiceMail: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<CustomerTenant | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamsUser | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; message: string } | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showPowerShellModal, setShowPowerShellModal] = useState(false);
  const [powershellPolicies, setPowershellPolicies] = useState<VoiceRoutingPolicy[] | null>(null);
  const [activeTab, setActiveTab] = useState("configuration");
  const [showPhonePickerDialog, setShowPhonePickerDialog] = useState(false);

  // Fetch Teams users when tenant is selected
  const { data: teamsUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/teams/users", selectedTenant?.id],
    enabled: !!selectedTenant,
    queryFn: async () => {
      const res = await fetch(`/api/teams/users?tenantId=${selectedTenant?.id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
  });

  // Fetch voice routing policies when tenant is selected via PowerShell certificate auth
  const { data: graphPolicies, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ["/api/powershell/get-policies", selectedTenant?.id],
    enabled: !!selectedTenant,
    queryFn: async () => {
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
        console.error(`Failed to fetch policies via PowerShell: ${text}`);
        throw new Error(`${res.status}: ${text}`);
      }
      const data = await res.json();

      console.log("[Dashboard] PowerShell policies response:", data);

      // The PowerShell endpoint returns { success: true, policies: [...] }
      if (data.success && data.policies) {
        console.log(`[Dashboard] Retrieved ${data.policies.length} policies via PowerShell`);
        return data.policies;
      }

      // Fallback to empty array if no policies
      console.warn("[Dashboard] No policies returned from PowerShell");
      return [];
    },
  });

  // Use PowerShell policies if available, otherwise use Graph API policies
  const routingPolicies = powershellPolicies || graphPolicies;

  // Fetch bulk assignment feature flag
  const { data: bulkAssignmentFlag } = useQuery<FeatureFlag>({
    queryKey: ["/api/feature-flags/bulk_assignment"],
    queryFn: async () => {
      const res = await fetch("/api/feature-flags/bulk_assignment", {
        credentials: "include",
      });
      if (!res.ok) {
        return { isEnabled: false }; // Default to disabled if fetch fails
      }
      return await res.json();
    },
  });

  // Check if bulk assignment feature is enabled
  const isBulkAssignmentEnabled = bulkAssignmentFlag?.isEnabled ?? false;

  // Fetch current voice configuration for selected user via PowerShell
  const { data: userVoiceConfig, isLoading: isLoadingVoiceConfig } = useQuery<UserVoiceConfig>({
    queryKey: ["/api/teams/user-voice-config", selectedTenant?.id, selectedUser?.userPrincipalName],
    enabled: !!selectedTenant && !!selectedUser,
    queryFn: async () => {
      const res = await fetch(
        `/api/teams/user-voice-config?tenantId=${selectedTenant?.id}&userPrincipalName=${encodeURIComponent(selectedUser!.userPrincipalName)}`,
        {
          credentials: "include",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
  });

  // Auto-populate form fields when user voice config is loaded
  useEffect(() => {
    if (userVoiceConfig && selectedUser) {
      // Populate phone number if user has one assigned
      if (userVoiceConfig.lineUri) {
        console.log(`[Dashboard] Auto-populating phone number: ${userVoiceConfig.lineUri}`);
        // Strip tel: prefix for display
        const displayNumber = userVoiceConfig.lineUri.startsWith("tel:")
          ? userVoiceConfig.lineUri.substring(4)
          : userVoiceConfig.lineUri;
        setPhoneNumber(displayNumber);
        setPhoneValidation(validatePhoneNumber(displayNumber));
      } else {
        setPhoneNumber("");
        setPhoneValidation(null);
      }

      // Populate voice routing policy if user has one assigned
      if (userVoiceConfig.voiceRoutingPolicy && routingPolicies) {
        const policyName = userVoiceConfig.voiceRoutingPolicy;
        console.log(`[Dashboard] Looking for policy to auto-populate: ${policyName}`);

        // Find matching policy by name (policy.name might have "Tag:" prefix, userVoiceConfig doesn't)
        const matchingPolicy = (routingPolicies as VoiceRoutingPolicy[]).find((p) => {
          const normalizedPolicyName = p.name.replace(/^Tag:/i, "").trim();
          const normalizedUserPolicy = policyName.replace(/^Tag:/i, "").trim();
          return normalizedPolicyName.toLowerCase() === normalizedUserPolicy.toLowerCase();
        });

        if (matchingPolicy) {
          console.log(`[Dashboard] Auto-populating policy ID: ${matchingPolicy.id} (${matchingPolicy.name})`);
          setSelectedPolicy(matchingPolicy.id);
        } else {
          console.warn(`[Dashboard] No matching policy found for: ${policyName}`);
          setSelectedPolicy("");
        }
      } else {
        setSelectedPolicy("");
      }
    } else if (!selectedUser) {
      // Clear fields when no user is selected
      setPhoneNumber("");
      setSelectedPolicy("");
      setPhoneValidation(null);
    }
  }, [userVoiceConfig, selectedUser, routingPolicies]);

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (selectedTenant) {
      // Clear selected user when tenant changes
      setSelectedUser(null);
      setPhoneNumber("");
      setSelectedPolicy("");
      setPhoneValidation(null);
      setPowershellPolicies(null); // Clear PowerShell policies from previous tenant

      // Invalidate and refetch users and policies for the new tenant
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/routing-policies", selectedTenant.id] });

      console.log(`[Dashboard] Auto-refreshing data for tenant: ${selectedTenant.tenantName}`);
    }
  }, [selectedTenant?.id]); // Only run when tenant ID changes

  const assignVoiceMutation = useMutation({
    mutationFn: async (data: {
      tenantId: string;
      userId: string;
      phoneNumber: string;
      routingPolicy: string;
    }) => {
      return await apiRequest("POST", "/api/teams/assign-voice", data);
    },
    onSuccess: async () => {
      toast({
        title: "Voice configuration saved",
        description: "Phone number and routing policy have been assigned successfully",
      });

      // Automatically sync numbers from Teams to update inventory
      if (selectedTenant) {
        try {
          console.log("[Dashboard] Auto-syncing numbers after assignment for tenant:", selectedTenant.id);

          // Fetch sync data
          const syncResponse = await apiRequest("POST", `/api/numbers/sync-from-teams/${selectedTenant.id}`, {});
          const syncData = await syncResponse.json();

          // Auto-apply all changes
          const allChanges = [
            ...syncData.changes.toAdd,
            ...syncData.changes.toUpdate.map((c: any) => ({ ...c, action: 'update' })),
          ];

          if (allChanges.length > 0) {
            console.log("[Dashboard] Auto-applying", allChanges.length, "changes");
            const applyResponse = await apiRequest("POST", "/api/numbers/apply-sync", {
              tenantId: selectedTenant.id,
              selectedChanges: allChanges,
            });
            const result = await applyResponse.json();

            console.log("[Dashboard] Auto-sync complete. Added:", result.added, "Updated:", result.updated);

            // Show subtle notification about sync
            toast({
              title: "Number inventory updated",
              description: `Synced ${result.added + result.updated} phone numbers from Teams`,
            });
          } else {
            console.log("[Dashboard] No changes to sync");
          }
        } catch (error: any) {
          console.error("[Dashboard] Auto-sync error:", error);
          // Don't show error toast - silent failure for background sync
        }
      }

      // Reset form
      setSelectedUser(null);
      setPhoneNumber("");
      setSelectedPolicy("");
      setPhoneValidation(null);
      // Refetch users and voice config to get updated data
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams/user-voice-config", selectedTenant?.id, selectedUser.userPrincipalName] });
      }
      // Also invalidate number inventory queries so Number Management updates
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign voice configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to remove phone number assignment from Teams
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ userPrincipalName, phoneNumber }: { userPrincipalName: string; phoneNumber: string }) => {
      const response = await apiRequest("POST", "/api/numbers/remove-assignment", {
        tenantId: selectedTenant?.id,
        userPrincipalName,
        phoneNumber,
        phoneNumberType: "DirectRouting",
      });
      return await response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Phone number removed",
        description: data.message || "The phone number assignment has been removed from Teams",
      });

      // Automatically sync numbers from Teams to update inventory
      if (selectedTenant) {
        try {
          console.log("[Dashboard] Auto-syncing numbers after removal for tenant:", selectedTenant.id);

          // Fetch sync data
          const syncResponse = await apiRequest("POST", `/api/numbers/sync-from-teams/${selectedTenant.id}`, {});
          const syncData = await syncResponse.json();

          // Auto-apply all changes
          const allChanges = [
            ...syncData.changes.toAdd,
            ...syncData.changes.toUpdate.map((c: any) => ({ ...c, action: 'update' })),
          ];

          if (allChanges.length > 0) {
            console.log("[Dashboard] Auto-applying", allChanges.length, "changes after removal");
            await apiRequest("POST", "/api/numbers/apply-sync", {
              tenantId: selectedTenant.id,
              selectedChanges: allChanges,
            });
          }
        } catch (error: any) {
          console.error("[Dashboard] Auto-sync error after removal:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams/user-voice-config", selectedTenant?.id, selectedUser.userPrincipalName] });
      }
      // Also invalidate number inventory queries so Number Management updates
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove phone number",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to reset voice routing policy to Global
  const resetPolicyMutation = useMutation({
    mutationFn: async (userPrincipalName: string) => {
      const response = await apiRequest("POST", "/api/numbers/reset-policy", {
        tenantId: selectedTenant?.id,
        userPrincipalName,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Policy reset to Global",
        description: data.message || "Voice routing policy has been reset to default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/teams/user-voice-config", selectedTenant?.id, selectedUser.userPrincipalName] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset policy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validate phone number format (E.164 format: +1234567890)
  const validatePhoneNumber = (number: string): { isValid: boolean; message: string } => {
    if (!number) {
      return { isValid: false, message: "" };
    }

    // Strip tel: prefix if present (for backwards compatibility)
    const numberPart = number.startsWith("tel:") ? number.substring(4) : number;

    // Check if it starts with +
    if (!numberPart.startsWith("+")) {
      return { isValid: false, message: "Number must start with +" };
    }

    // Check if the rest contains only digits (E.164 allows 1-15 digits after +)
    const digitsOnly = numberPart.substring(1);
    if (!/^\d{1,15}$/.test(digitsOnly)) {
      return { isValid: false, message: "Must contain 1-15 digits (E.164 format)" };
    }

    // Typically need at least 7 digits for a valid phone number (country code + subscriber)
    if (digitsOnly.length < 7) {
      return { isValid: false, message: "Must contain at least 7 digits" };
    }

    return { isValid: true, message: "Valid phone number format" };
  };

  // Handle phone number change with validation
  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    if (value) {
      setPhoneValidation(validatePhoneNumber(value));
    } else {
      setPhoneValidation(null);
    }
  };

  const handleSave = () => {
    if (!selectedTenant || !selectedUser || !phoneNumber || !selectedPolicy) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number before saving
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      toast({
        title: "Invalid phone number",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    // Ensure phone number has tel: prefix for PowerShell
    const normalizedPhoneNumber = phoneNumber.startsWith("tel:") ? phoneNumber : `tel:${phoneNumber}`;

    assignVoiceMutation.mutate({
      tenantId: selectedTenant.id,
      userId: selectedUser.id,
      phoneNumber: normalizedPhoneNumber,
      routingPolicy: selectedPolicy,
    });
  };

  const handleCancel = () => {
    setSelectedUser(null);
    setPhoneNumber("");
    setSelectedPolicy("");
    setPhoneValidation(null);
  };

  const handleApplyProfile = (profile: ConfigurationProfile) => {
    // Apply profile values to the form, but keep selected user
    setPhoneNumber(profile.phoneNumberPrefix);
    setSelectedPolicy(profile.defaultRoutingPolicy);
    handlePhoneNumberChange(profile.phoneNumberPrefix);

    // Switch to configuration tab
    setActiveTab("configuration");

    toast({
      title: "Profile applied",
      description: `"${profile.profileName}" has been applied. You can now customize the phone number and save.`,
    });

    // Scroll to top so user can see the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Voice Configuration
        </h1>
        <p className="text-muted-foreground mt-2">
          Assign phone numbers and routing policies to Teams users
        </p>
      </div>

      {/* Tenant Selection */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Customer Tenant</CardTitle>
          <CardDescription>
            Select an existing customer tenant or add a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSelector
            selectedTenant={selectedTenant}
            onSelectTenant={setSelectedTenant}
          />
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      {selectedTenant && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="configuration" className="flex items-center gap-2 py-3">
              <Users className="w-4 h-4" />
              User Configuration
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-2 py-3">
              <Settings2 className="w-4 h-4" />
              Configuration Profiles
            </TabsTrigger>
          </TabsList>

          {/* User Configuration Tab */}
          <TabsContent value="configuration" className="mt-6">
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      User Voice Configuration
                    </CardTitle>
                    <CardDescription>
                      Select a Teams voice-enabled user and configure their phone settings
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowPowerShellModal(true)}
                      className="h-10"
                      data-testid="button-powershell"
                    >
                      <Terminal className="w-4 h-4 mr-2" />
                      PowerShell
                    </Button>
                    {isBulkAssignmentEnabled && (
                      <Button
                        variant="outline"
                        onClick={() => setShowBulkDialog(true)}
                        className="h-10"
                        data-testid="button-bulk-assign"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Bulk Assign
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
          <CardContent className="space-y-6">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user-select" className="text-sm font-semibold">
                Teams User
              </Label>
              <UserSearchCombobox
                users={(teamsUsers as TeamsUser[]) || []}
                isLoading={isLoadingUsers}
                selectedUser={selectedUser}
                onSelectUser={setSelectedUser}
              />
              {selectedUser && (
                <p className="text-xs text-muted-foreground">
                  {selectedUser.mail || selectedUser.userPrincipalName}
                </p>
              )}

              {/* Current Voice Configuration */}
              {selectedUser && isLoadingVoiceConfig && (
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Loading current configuration...
                    </p>
                  </div>
                </div>
              )}

              {selectedUser && userVoiceConfig && !isLoadingVoiceConfig && (
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Current Configuration
                    </p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 dark:text-blue-300">Phone Number:</span>
                      <span className="font-mono font-medium text-blue-900 dark:text-blue-100">
                        {userVoiceConfig.lineUri || "Not assigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 dark:text-blue-300">Voice Policy:</span>
                      <span className="font-mono font-medium text-blue-900 dark:text-blue-100">
                        {userVoiceConfig.voiceRoutingPolicy || "Not assigned"}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {userVoiceConfig.lineUri && (
                        <>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400"
                            onClick={() => {
                              if (userVoiceConfig.lineUri) {
                                setPhoneNumber(userVoiceConfig.lineUri);
                                handlePhoneNumberChange(userVoiceConfig.lineUri);
                              }
                              if (userVoiceConfig.voiceRoutingPolicy && routingPolicies) {
                                // Normalize policy name for matching (remove Tag: prefix, trim, lowercase)
                                const normalizedUserPolicy = userVoiceConfig.voiceRoutingPolicy
                                  .replace(/^Tag:/i, "")
                                  .trim()
                                  .toLowerCase();

                                console.log('[Load Values] Looking for policy:', {
                                  raw: userVoiceConfig.voiceRoutingPolicy,
                                  normalized: normalizedUserPolicy,
                                  availablePolicies: (routingPolicies as VoiceRoutingPolicy[]).map(p => ({
                                    id: p.id,
                                    name: p.name
                                  }))
                                });

                                // Find policy by matching normalized names or IDs
                                const matchingPolicy = (routingPolicies as VoiceRoutingPolicy[]).find((p) => {
                                  const normalizedPolicyName = p.name.replace(/^Tag:/i, "").trim().toLowerCase();
                                  const normalizedPolicyId = p.id.replace(/^Tag:/i, "").trim().toLowerCase();

                                  return normalizedPolicyName === normalizedUserPolicy ||
                                         normalizedPolicyId === normalizedUserPolicy;
                                });

                                if (matchingPolicy) {
                                  console.log('[Load Values] Found matching policy:', matchingPolicy);
                                  setSelectedPolicy(matchingPolicy.id);
                                } else {
                                  console.warn('[Load Values] No matching policy found for:', userVoiceConfig.voiceRoutingPolicy);
                                  toast({
                                    title: "Policy not found",
                                    description: `Could not find policy "${userVoiceConfig.voiceRoutingPolicy}" in the available policies`,
                                    variant: "destructive",
                                  });
                                }
                              }
                              toast({
                                title: "Form pre-filled",
                                description: "Current values have been loaded into the form",
                              });
                            }}
                          >
                            Load values →
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-red-600 dark:text-red-400"
                            onClick={() => {
                              if (confirm(`Remove phone number ${userVoiceConfig.lineUri} from ${selectedUser?.displayName}?`)) {
                                removeAssignmentMutation.mutate({
                                  userPrincipalName: selectedUser!.userPrincipalName,
                                  phoneNumber: userVoiceConfig.lineUri!,
                                });
                              }
                            }}
                            disabled={removeAssignmentMutation.isPending}
                          >
                            {removeAssignmentMutation.isPending ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin inline" /> Removing...</>
                            ) : (
                              <><PhoneOff className="w-3 h-3 mr-1 inline" /> Remove Phone</>
                            )}
                          </Button>
                        </>
                      )}
                      {userVoiceConfig.voiceRoutingPolicy && userVoiceConfig.voiceRoutingPolicy !== "Global" && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-orange-600 dark:text-orange-400"
                          onClick={() => {
                            if (confirm(`Reset voice routing policy to Global for ${selectedUser?.displayName}?`)) {
                              resetPolicyMutation.mutate(selectedUser!.userPrincipalName);
                            }
                          }}
                          disabled={resetPolicyMutation.isPending}
                        >
                          {resetPolicyMutation.isPending ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin inline" /> Resetting...</>
                          ) : (
                            <><RotateCcw className="w-3 h-3 mr-1 inline" /> Reset to Global</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone-number" className="text-sm font-semibold">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number (Line URI)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="phone-number"
                  type="text"
                  placeholder="+15551234567"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  className={`h-11 flex-1 ${
                    phoneValidation && !phoneValidation.isValid
                      ? "border-destructive focus-visible:ring-destructive"
                      : phoneValidation && phoneValidation.isValid
                      ? "border-green-500 focus-visible:ring-green-500"
                      : ""
                  }`}
                  disabled={!selectedUser}
                  data-testid="input-phone-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPhonePickerDialog(true)}
                  disabled={!selectedUser || !selectedTenant}
                  className="h-11"
                  title="Select from available numbers"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              {phoneValidation && (
                <p
                  className={`text-xs ${
                    phoneValidation.isValid ? "text-green-600 dark:text-green-400" : "text-destructive"
                  }`}
                  data-testid="text-phone-validation"
                >
                  {phoneValidation.message}
                </p>
              )}
              {!phoneValidation && (
                <p className="text-xs text-muted-foreground">
                  Format: tel:+[country code][phone number] (e.g., tel:+15551234567). Click <List className="w-3 h-3 inline" /> to select from inventory.
                </p>
              )}
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
                <Select
                  value={selectedPolicy}
                  onValueChange={setSelectedPolicy}
                  disabled={!selectedUser}
                >
                  <SelectTrigger className="h-11" data-testid="select-routing-policy">
                    <SelectValue placeholder="Select a routing policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {(routingPolicies as VoiceRoutingPolicy[])?.map((policy) => (
                      <SelectItem key={policy.id} value={policy.id}>
                        {policy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={
                  !selectedUser ||
                  !phoneNumber ||
                  !selectedPolicy ||
                  (phoneValidation && !phoneValidation.isValid) ||
                  assignVoiceMutation.isPending
                }
                className="h-11 px-6"
                data-testid="button-save-config"
              >
                {assignVoiceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={assignVoiceMutation.isPending}
                className="h-11 px-6"
                data-testid="button-cancel"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Profiles Tab */}
          <TabsContent value="profiles" className="mt-6">
            <ConfigurationProfiles
              selectedTenant={selectedTenant}
              onApplyProfile={handleApplyProfile}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Bulk Assignment Dialog */}
      <BulkAssignmentDialog
        open={showBulkDialog}
        onOpenChange={setShowBulkDialog}
        selectedTenant={selectedTenant}
      />

      {/* PowerShell MFA Modal */}
      {selectedTenant && (
        <PowerShellMfaModal
          isOpen={showPowerShellModal}
          onClose={() => setShowPowerShellModal(false)}
          tenantId={selectedTenant.id}
          tenantName={selectedTenant.tenantName}
          onSuccess={() => {
            toast({
              title: "PowerShell Connected",
              description: "Successfully connected to Microsoft Teams PowerShell",
            });
          }}
          onPoliciesRetrieved={(policies) => {
            setPowershellPolicies(policies);
            toast({
              title: "Policies Retrieved",
              description: `Retrieved ${policies.length} voice routing policies from PowerShell`,
            });
          }}
        />
      )}

      {/* Phone Number Picker Dialog */}
      <PhoneNumberPickerDialog
        open={showPhonePickerDialog}
        onOpenChange={setShowPhonePickerDialog}
        tenant={selectedTenant}
        onSelectNumber={(number) => {
          setPhoneNumber(number);
          handlePhoneNumberChange(number);
        }}
        currentNumber={phoneNumber}
      />

      {/* Empty State */}
      {!selectedTenant && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a Customer Tenant</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose an existing customer tenant from the dropdown above, or add a new tenant to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
