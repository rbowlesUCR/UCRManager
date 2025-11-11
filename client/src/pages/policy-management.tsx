import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Shield, Users, RotateCcw } from "lucide-react";
import { TenantSelector } from "@/components/tenant-selector";
import { UserSearchCombobox } from "@/components/user-search-combobox";
import type { TeamsUser, CustomerTenant, PolicyType, TeamsPolicy, policyTypeConfig } from "@shared/schema";
import { policyTypeConfig as policyConfig } from "@shared/schema";

export default function PolicyManagement() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<CustomerTenant | null>(null);
  const [selectedUser, setSelectedUser] = useState<TeamsUser | null>(null);
  const [selectedPolicyType, setSelectedPolicyType] = useState<PolicyType>("voiceRouting");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");

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

  // Fetch policies for the selected policy type
  const { data: policiesData, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ["/api/teams/policies", selectedPolicyType, selectedTenant?.id],
    enabled: !!selectedTenant && !!selectedPolicyType,
    queryFn: async () => {
      const res = await fetch(`/api/teams/policies/${selectedPolicyType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ tenantId: selectedTenant?.id }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Failed to fetch ${selectedPolicyType} policies:`, text);
        throw new Error(`${res.status}: ${text}`);
      }
      const data = await res.json();
      console.log(`[PolicyManagement] Retrieved ${selectedPolicyType} policies:`, data);
      return data;
    },
  });

  const policies = policiesData?.policies || [];

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (selectedTenant) {
      setSelectedUser(null);
      setSelectedPolicyId("");
      console.log(`[PolicyManagement] Tenant changed to: ${selectedTenant.tenantName}`);
    }
  }, [selectedTenant?.id]);

  // Clear selection when policy type changes
  useEffect(() => {
    setSelectedPolicyId("");
  }, [selectedPolicyType]);

  // Mutation to assign policy
  const assignPolicyMutation = useMutation({
    mutationFn: async (data: {
      tenantId: string;
      userPrincipalName: string;
      policyType: PolicyType;
      policyName: string;
    }) => {
      return await apiRequest("POST", "/api/teams/assign-policy", data);
    },
    onSuccess: (_, variables) => {
      const policyDisplayName = policyConfig[variables.policyType].displayName;
      toast({
        title: "Policy assigned successfully",
        description: `${policyDisplayName} has been assigned to ${selectedUser?.displayName}`,
      });
      // Reset selection
      setSelectedPolicyId("");
      // Refetch users to get updated data
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
    },
    onError: (error: Error, variables) => {
      const policyDisplayName = policyConfig[variables.policyType].displayName;
      toast({
        title: `Failed to assign ${policyDisplayName}`,
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
      setSelectedPolicyId("");
      queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset policy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssignPolicy = () => {
    if (!selectedTenant || !selectedUser || !selectedPolicyId) {
      toast({
        title: "Missing information",
        description: "Please select a tenant, user, and policy",
        variant: "destructive",
      });
      return;
    }

    // Find the policy to get its name
    const policy = policies.find((p: TeamsPolicy) => p.id === selectedPolicyId);
    if (!policy) {
      toast({
        title: "Policy not found",
        description: "The selected policy could not be found",
        variant: "destructive",
      });
      return;
    }

    assignPolicyMutation.mutate({
      tenantId: selectedTenant.id,
      userPrincipalName: selectedUser.userPrincipalName,
      policyType: selectedPolicyType,
      policyName: policy.name,
    });
  };

  // Get available policy types
  const policyTypes = Object.keys(policyConfig) as PolicyType[];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Policy Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage Microsoft Teams policies for users across all policy types
        </p>
      </div>

      {/* Tenant Selection */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Customer Tenant</CardTitle>
          <CardDescription>
            Select a customer tenant to manage policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSelector
            selectedTenant={selectedTenant}
            onSelectTenant={setSelectedTenant}
          />
        </CardContent>
      </Card>

      {/* Policy Management Interface */}
      {selectedTenant && (
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Policy Assignment
            </CardTitle>
            <CardDescription>
              Select a user and assign policies across different policy types
            </CardDescription>
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
            </div>

            {/* Policy Type Tabs */}
            {selectedUser && (
              <Tabs
                value={selectedPolicyType}
                onValueChange={(value) => setSelectedPolicyType(value as PolicyType)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-5 h-auto">
                  {policyTypes.map((type) => (
                    <TabsTrigger
                      key={type}
                      value={type}
                      className="text-xs px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {policyConfig[type].displayName}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {policyTypes.map((type) => (
                  <TabsContent key={type} value={type} className="space-y-4 mt-6">
                    {/* Policy Type Description */}
                    <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          {policyConfig[type].displayName}
                        </p>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        PowerShell cmdlets: {policyConfig[type].powerShellCmdGet}, {policyConfig[type].powerShellCmdGrant}
                      </p>
                    </div>

                    {/* Policy Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="policy-select" className="text-sm font-semibold">
                        Select Policy
                      </Label>
                      {isLoadingPolicies ? (
                        <div className="h-11 flex items-center justify-center border rounded-md">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <Select
                          value={selectedPolicyId}
                          onValueChange={setSelectedPolicyId}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={`Select a ${policyConfig[type].displayName.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {policies.length === 0 ? (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                No policies available
                              </div>
                            ) : (
                              policies.map((policy: TeamsPolicy) => (
                                <SelectItem key={policy.id} value={policy.id}>
                                  <div className="flex flex-col">
                                    <span>{policy.name}</span>
                                    {policy.description && (
                                      <span className="text-xs text-muted-foreground">{policy.description}</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Assign Button */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleAssignPolicy}
                        disabled={
                          !selectedPolicyId ||
                          assignPolicyMutation.isPending
                        }
                        className="h-11 px-6"
                      >
                        {assignPolicyMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Assign Policy
                          </>
                        )}
                      </Button>
                      {selectedPolicyType === "voiceRouting" && selectedUser && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Reset voice routing policy to Global for ${selectedUser.displayName}?`)) {
                              resetPolicyMutation.mutate(selectedUser.userPrincipalName);
                            }
                          }}
                          disabled={resetPolicyMutation.isPending}
                          className="h-11 px-6"
                        >
                          {resetPolicyMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reset to Global
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedTenant && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a Customer Tenant</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a customer tenant from the dropdown above to start managing policies
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
