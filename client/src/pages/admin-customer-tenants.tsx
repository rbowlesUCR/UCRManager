import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, Edit, Trash2, Eye, EyeOff, ShieldCheck, CheckCircle, XCircle, Terminal, AlertCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CustomerTenant } from "@shared/schema";

interface PermissionValidationResult {
  permission: string;
  status: "success" | "error";
  message: string;
  errorCode?: string;
}

interface PowerShellCredentials {
  id: string;
  tenantId: string;
  username: string;
  password: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PowerShellCredentialsResponse {
  exists: boolean;
  credentials?: PowerShellCredentials;
}

export default function AdminCustomerTenants() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<CustomerTenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<CustomerTenant | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [validatingTenant, setValidatingTenant] = useState<CustomerTenant | null>(null);
  const [validationResults, setValidationResults] = useState<PermissionValidationResult[]>([]);
  
  // PowerShell credentials state
  const [psConfigTenant, setPsConfigTenant] = useState<CustomerTenant | null>(null);
  const [psUsername, setPsUsername] = useState("");
  const [psPassword, setPsPassword] = useState("");
  const [psDescription, setPsDescription] = useState("");
  const [showPsPassword, setShowPsPassword] = useState(false);
  const [testOutput, setTestOutput] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    tenantId: "",
    tenantName: "",
    appRegistrationId: "",
    appRegistrationSecret: "",
    isActive: true,
  });

  const { data: tenants = [], isLoading } = useQuery<CustomerTenant[]>({
    queryKey: ["/api/admin/customer-tenants"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/customer-tenants", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customer-tenants"] });
      toast({
        title: "Success",
        description: "Customer tenant created successfully",
      });
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer tenant",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/admin/customer-tenants/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customer-tenants"] });
      toast({
        title: "Success",
        description: "Customer tenant updated successfully",
      });
      resetForm();
      setEditingTenant(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer tenant",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/customer-tenants/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customer-tenants"] });
      toast({
        title: "Success",
        description: "Customer tenant deleted successfully",
      });
      setDeletingTenant(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer tenant",
        variant: "destructive",
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/customer-tenants/${id}/validate`);
      return await res.json();
    },
    onSuccess: (data: { results: PermissionValidationResult[] }) => {
      setValidationResults(data.results);
      const allPassed = data.results.every(r => r.status === "success");
      toast({
        title: allPassed ? "All Permissions Valid" : "Permission Issues Found",
        description: allPassed 
          ? "All required permissions are properly configured" 
          : "Some permissions are missing or incorrectly configured",
        variant: allPassed ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate customer tenant permissions",
        variant: "destructive",
      });
      setValidatingTenant(null);
    },
  });

  const { data: psCredentials, refetch: refetchPsCredentials } = useQuery<PowerShellCredentialsResponse>({
    queryKey: ["/api/admin/tenants", psConfigTenant?.id, "powershell-credentials"],
    enabled: !!psConfigTenant,
  });

  const updatePsCredentialsMutation = useMutation({
    mutationFn: async ({ tenantId, data }: { tenantId: string; data: { username: string; encryptedPassword: string; description: string; isActive: boolean } }) => {
      const res = await apiRequest("PUT", `/api/admin/tenants/${tenantId}/powershell-credentials`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", psConfigTenant?.id, "powershell-credentials"] });
      toast({
        title: "PowerShell credentials saved",
        description: "Teams PowerShell credentials have been updated successfully",
      });
      refetchPsCredentials();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save credentials",
        description: error.message || "Failed to update PowerShell credentials",
        variant: "destructive",
      });
    },
  });

  const testPsConnectionMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiRequest("POST", `/api/admin/tenants/${tenantId}/powershell/test-connection`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      setTestOutput(data.output || "");
      if (data.success) {
        toast({
          title: "Connection test successful",
          description: "PowerShell connection to Microsoft Teams is working",
        });
      } else {
        toast({
          title: "Connection test failed",
          description: data.error || "Failed to connect to Microsoft Teams PowerShell",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Test failed",
        description: error.message || "Failed to test PowerShell connection",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      tenantId: "",
      tenantName: "",
      appRegistrationId: "",
      appRegistrationSecret: "",
      isActive: true,
    });
    setShowSecret(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (tenant: CustomerTenant) => {
    setFormData({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      appRegistrationId: tenant.appRegistrationId || "",
      appRegistrationSecret: "****************",
      isActive: tenant.isActive,
    });
    setEditingTenant(tenant);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfigurePs = (tenant: CustomerTenant) => {
    setPsConfigTenant(tenant);
    // Don't clear fields here - let useEffect handle populating them when data loads
    setShowPsPassword(false);
    setTestOutput("");
  };

  const handlePsCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!psUsername) {
      toast({
        title: "Validation error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }

    if (!psConfigTenant) return;

    updatePsCredentialsMutation.mutate({
      tenantId: psConfigTenant.id,
      data: {
        username: psUsername,
        encryptedPassword: psPassword,
        description: psDescription,
        isActive: true,
      },
    });
  };

  const handleTestConnection = () => {
    if (!psConfigTenant) return;
    setTestOutput("");
    testPsConnectionMutation.mutate(psConfigTenant.id);
  };

  useEffect(() => {
    if (psCredentials && psCredentials.exists && psCredentials.credentials) {
      setPsUsername(psCredentials.credentials.username);
      setPsPassword(psCredentials.credentials.password);
      setPsDescription(psCredentials.credentials.description || "");
    } else if (psCredentials && !psCredentials.exists) {
      // No credentials exist for this tenant - clear the form
      setPsUsername("");
      setPsPassword("");
      setPsDescription("");
    }
  }, [psCredentials]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Customer Tenants</h2>
            <p className="text-muted-foreground">
              Manage customer Azure AD tenants and app registrations
            </p>
          </div>
          <Button onClick={handleCreate} data-testid="button-create-tenant">
            <Plus className="mr-2 h-4 w-4" />
            Add Tenant
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Customer Tenants
            </CardTitle>
            <CardDescription>
              All customer tenants including inactive ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No customer tenants found. Add your first tenant to get started.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Tenant ID</TableHead>
                      <TableHead>App Registration ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                        <TableCell className="font-medium">{tenant.tenantName}</TableCell>
                        <TableCell className="font-mono text-sm">{tenant.tenantId}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {tenant.appRegistrationId || <span className="text-muted-foreground">Not set</span>}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              tenant.isActive
                                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400"
                            }`}
                          >
                            {tenant.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setValidatingTenant(tenant);
                                setValidationResults([]);
                                validateMutation.mutate(tenant.id);
                              }}
                              disabled={validateMutation.isPending}
                              data-testid={`button-validate-${tenant.id}`}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfigurePs(tenant)}
                              data-testid={`button-configure-ps-${tenant.id}`}
                            >
                              <Terminal className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(tenant)}
                              data-testid={`button-edit-${tenant.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingTenant(tenant)}
                              data-testid={`button-delete-${tenant.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isCreateDialogOpen || !!editingTenant} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingTenant(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTenant ? "Edit Customer Tenant" : "Add Customer Tenant"}
              </DialogTitle>
              <DialogDescription>
                {editingTenant
                  ? "Update customer tenant information and app registration details"
                  : "Add a new customer tenant with Azure AD app registration details"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Tenant Name *</Label>
                  <Input
                    id="tenantName"
                    value={formData.tenantName}
                    onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                    placeholder="Contoso Corporation"
                    required
                    data-testid="input-tenant-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenantId">Azure Tenant ID *</Label>
                  <Input
                    id="tenantId"
                    value={formData.tenantId}
                    onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                    disabled={!!editingTenant}
                    data-testid="input-tenant-id"
                  />
                  {editingTenant && (
                    <p className="text-sm text-muted-foreground">
                      Tenant ID cannot be changed after creation
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appRegistrationId">App Registration ID (Client ID)</Label>
                  <Input
                    id="appRegistrationId"
                    value={formData.appRegistrationId}
                    onChange={(e) => setFormData({ ...formData, appRegistrationId: e.target.value })}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    data-testid="input-app-registration-id"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appRegistrationSecret">App Registration Secret (Client Secret)</Label>
                  <div className="relative">
                    <Input
                      id="appRegistrationSecret"
                      type={showSecret ? "text" : "password"}
                      value={formData.appRegistrationSecret}
                      onChange={(e) => setFormData({ ...formData, appRegistrationSecret: e.target.value })}
                      placeholder={editingTenant ? "Leave masked to keep existing" : "Enter client secret"}
                      data-testid="input-app-registration-secret"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecret(!showSecret)}
                      data-testid="button-toggle-secret-visibility"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {editingTenant && formData.appRegistrationSecret === "****************" && (
                    <p className="text-sm text-muted-foreground">
                      Client secret is encrypted. Leave as masked to keep existing value.
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-is-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingTenant(null);
                    resetForm();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-tenant"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Tenant"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingTenant} onOpenChange={(open) => !open && setDeletingTenant(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Customer Tenant?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingTenant?.tenantName}"? This action cannot be undone.
                All associated configuration profiles and audit logs will remain but won't be accessible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingTenant && deleteMutation.mutate(deletingTenant.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Validation Results Dialog */}
        <Dialog open={!!validatingTenant} onOpenChange={(open) => !open && setValidatingTenant(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Permission Validation Results</DialogTitle>
              <DialogDescription>
                {validatingTenant?.tenantName} - Testing Microsoft Graph API permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {validateMutation.isPending ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Validating permissions...</p>
                </div>
              ) : validationResults.length > 0 ? (
                <div className="space-y-3">
                  {validationResults.map((result, index) => (
                    <Card key={index} data-testid={`validation-result-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                              {result.status === "success" ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              {result.permission}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {result.message}
                            </CardDescription>
                            {result.errorCode && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Error Code: {result.errorCode}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                onClick={() => setValidatingTenant(null)}
                data-testid="button-close-validation"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PowerShell Credentials Dialog */}
        <Dialog open={!!psConfigTenant} onOpenChange={(open) => {
          if (!open) {
            setPsConfigTenant(null);
            setPsUsername("");
            setPsPassword("");
            setPsDescription("");
            setShowPsPassword(false);
            setTestOutput("");
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                PowerShell Credentials - {psConfigTenant?.tenantName}
              </DialogTitle>
              <DialogDescription>
                Configure Microsoft Teams PowerShell credentials for this tenant
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div>
                  <strong>Required Admin Permissions:</strong>
                </div>
                <ul className="text-xs space-y-1 ml-4 list-disc">
                  <li><strong>Teams Administrator</strong> or <strong>Global Administrator</strong> role required</li>
                  <li>Account must support basic authentication (modern auth with MFA may not work)</li>
                  <li>MicrosoftTeams PowerShell module must be installed on the server</li>
                </ul>
                <div className="text-xs mt-2">
                  <strong>PowerShell Operations:</strong> Phone number assignment (<code className="text-xs">Set-CsPhoneNumberAssignment</code>), 
                  policy listing (<code className="text-xs">Get-CsOnlineVoiceRoutingPolicy</code>), and policy assignment.
                </div>
                <div className="text-xs mt-2 text-amber-600 dark:text-amber-500">
                  <strong>Note:</strong> Test connection may fail if MFA is required on the account or if the MicrosoftTeams module isn't installed. 
                  PowerShell operations will still work if credentials are valid.
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handlePsCredentialsSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ps-username">User Principal Name *</Label>
                <Input
                  id="ps-username"
                  type="text"
                  value={psUsername}
                  onChange={(e) => setPsUsername(e.target.value)}
                  placeholder="admin@tenant.onmicrosoft.com"
                  data-testid="input-ps-username"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The UPN of a service account with Teams admin permissions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ps-password">Password</Label>
                <div className="relative">
                  <Input
                    id="ps-password"
                    type={showPsPassword ? "text" : "password"}
                    value={psPassword}
                    onChange={(e) => setPsPassword(e.target.value)}
                    placeholder="Enter password or leave unchanged"
                    data-testid="input-ps-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPsPassword(!showPsPassword)}
                    data-testid="button-toggle-ps-password"
                  >
                    {showPsPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password is encrypted before storage. Leave as masked (****************) to keep existing password.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ps-description">Description (Optional)</Label>
                <Textarea
                  id="ps-description"
                  value={psDescription}
                  onChange={(e) => setPsDescription(e.target.value)}
                  placeholder="e.g., Service account for Teams PowerShell operations"
                  data-testid="input-ps-description"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={updatePsCredentialsMutation.isPending}
                  data-testid="button-save-ps-credentials"
                >
                  {updatePsCredentialsMutation.isPending ? "Saving..." : "Save Credentials"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testPsConnectionMutation.isPending || !psCredentials?.exists}
                  data-testid="button-test-ps-connection"
                >
                  {testPsConnectionMutation.isPending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                  )}
                  Test Connection
                </Button>
              </div>

              {testOutput && (
                <div className="mt-4 space-y-2">
                  <Label>Test Output</Label>
                  <div className="bg-muted p-3 rounded-md font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto" data-testid="text-test-output">
                    {testOutput}
                  </div>
                </div>
              )}
            </form>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPsConfigTenant(null);
                  setPsUsername("");
                  setPsPassword("");
                  setPsDescription("");
                  setShowPsPassword(false);
                  setTestOutput("");
                }}
                data-testid="button-close-ps-dialog"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
