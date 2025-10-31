import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminLayout } from "@/components/admin-layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, Key, AlertCircle, CheckCircle2, Cloud } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OperatorConfig {
  id: string;
  azureTenantId: string;
  azureClientId: string;
  azureClientSecret: string;
  redirectUri: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Username change state
  const [newUsername, setNewUsername] = useState("");

  // Operator config state
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [showClientSecret, setShowClientSecret] = useState(false);

  // Fetch operator config
  const { data: operatorConfig, isLoading: isLoadingConfig } = useQuery<OperatorConfig>({
    queryKey: ["/api/admin/operator-config"],
  });

  // Update state when config is loaded
  useEffect(() => {
    if (operatorConfig) {
      setAzureTenantId(operatorConfig.azureTenantId);
      setAzureClientId(operatorConfig.azureClientId);
      setAzureClientSecret(operatorConfig.azureClientSecret); // Will be masked "****************"
      setRedirectUri(operatorConfig.redirectUri);
    }
  }, [operatorConfig]);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/admin/change-password", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed successfully",
        description: "Your admin password has been updated",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changeUsernameMutation = useMutation({
    mutationFn: async (data: { newUsername: string }) => {
      const response = await apiRequest("PUT", "/api/admin/username", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change username");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Username changed successfully",
        description: `Your username has been updated to ${data.username}`,
      });
      setNewUsername("");
      // Reload the page to update the session with new username
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change username",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOperatorConfigMutation = useMutation({
    mutationFn: async (data: { azureTenantId: string; azureClientId: string; azureClientSecret: string; redirectUri: string }) => {
      const response = await apiRequest("PUT", "/api/admin/operator-config", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update operator configuration");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Operator configuration updated",
        description: "Azure AD credentials have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operator-config"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!newUsername || newUsername.trim() === "") {
      toast({
        title: "Validation error",
        description: "New username is required",
        variant: "destructive",
      });
      return;
    }

    if (newUsername.length < 3) {
      toast({
        title: "Validation error",
        description: "Username must be at least 3 characters long",
        variant: "destructive",
      });
      return;
    }

    changeUsernameMutation.mutate({ newUsername: newUsername.trim() });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "New password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (newPassword === currentPassword) {
      toast({
        title: "Validation error",
        description: "New password must be different from current password",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleOperatorConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!azureTenantId || !azureClientId || !redirectUri) {
      toast({
        title: "Validation error",
        description: "Azure Tenant ID, Client ID, and Redirect URI are required",
        variant: "destructive",
      });
      return;
    }

    updateOperatorConfigMutation.mutate({
      azureTenantId,
      azureClientId,
      azureClientSecret,
      redirectUri,
    });
  };

  const autoDetectRedirectUri = () => {
    const currentUrl = window.location.origin;
    const autoDetectedUri = `${currentUrl}/api/auth/callback`;
    setRedirectUri(autoDetectedUri);
    toast({
      title: "Redirect URI auto-detected",
      description: autoDetectedUri,
    });
  };

  const passwordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: "", color: "" };
    if (password.length < 8) return { strength: 1, label: "Too short", color: "text-destructive" };
    
    let strength = 1;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 2, label: "Weak", color: "text-orange-500" };
    if (strength <= 3) return { strength: 3, label: "Medium", color: "text-yellow-500" };
    return { strength: 4, label: "Strong", color: "text-green-500" };
  };

  const passwordCheck = passwordStrength(newPassword);

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage your admin account security and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Current Admin Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your local admin account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Username</Label>
                <div className="mt-1 text-sm font-medium" data-testid="text-admin-username">
                  admin
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Role</Label>
                <div className="mt-1 text-sm font-medium">Local Administrator</div>
              </div>
            </CardContent>
          </Card>

          {/* Change Username */}
          <Card>
            <CardHeader>
              <CardTitle>Change Username</CardTitle>
              <CardDescription>
                Update your local admin username (requires re-login)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Changing your username will update your login credentials. You'll need to sign in again with the new username.
                </AlertDescription>
              </Alert>

              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-username">New Username</Label>
                  <Input
                    id="new-username"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter new username"
                    data-testid="input-new-username"
                  />
                  <p className="text-sm text-muted-foreground">
                    Username must be at least 3 characters long
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={changeUsernameMutation.isPending || !newUsername}
                    data-testid="button-update-username"
                  >
                    {changeUsernameMutation.isPending && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    )}
                    Update Username
                  </Button>
                  {newUsername && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewUsername("")}
                      data-testid="button-cancel-username"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your admin password to maintain account security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Default credentials:</strong> If you haven't changed your password yet, 
                  the default password is <code className="bg-muted px-1 rounded">admin123</code>. 
                  Please change it immediately for security.
                </AlertDescription>
              </Alert>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      data-testid="input-current-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      data-testid="button-toggle-current-password"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 8 characters)"
                      data-testid="input-new-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      data-testid="button-toggle-new-password"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {newPassword && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            passwordCheck.strength === 1 ? "bg-destructive w-1/4" :
                            passwordCheck.strength === 2 ? "bg-orange-500 w-1/2" :
                            passwordCheck.strength === 3 ? "bg-yellow-500 w-3/4" :
                            "bg-green-500 w-full"
                          }`}
                        />
                      </div>
                      <span className={passwordCheck.color}>{passwordCheck.label}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters. Use a mix of letters, numbers, and symbols for better security.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      data-testid="input-confirm-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {confirmPassword && confirmPassword === newPassword && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Passwords match
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full"
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Operator Azure AD Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Operator Azure AD Configuration
              </CardTitle>
              <CardDescription>
                Manage Azure AD credentials used for operator authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security:</strong> The Client Secret is encrypted and cannot be viewed once saved. 
                  Leave the secret field unchanged (or enter the masked value) to keep the existing secret.
                </AlertDescription>
              </Alert>

              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">Loading configuration...</p>
                </div>
              ) : (
                <form onSubmit={handleOperatorConfigSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="azure-tenant-id">Azure Tenant ID</Label>
                    <Input
                      id="azure-tenant-id"
                      type="text"
                      value={azureTenantId}
                      onChange={(e) => setAzureTenantId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      data-testid="input-azure-tenant-id"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The Directory (tenant) ID from your Azure AD app registration
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="azure-client-id">Azure Client ID (Application ID)</Label>
                    <Input
                      id="azure-client-id"
                      type="text"
                      value={azureClientId}
                      onChange={(e) => setAzureClientId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      data-testid="input-azure-client-id"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The Application (client) ID from your Azure AD app registration
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="azure-client-secret">Azure Client Secret</Label>
                    <div className="relative">
                      <Input
                        id="azure-client-secret"
                        type={showClientSecret ? "text" : "password"}
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        placeholder="Enter new secret or leave unchanged"
                        data-testid="input-azure-client-secret"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        data-testid="button-toggle-client-secret"
                      >
                        {showClientSecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The client secret value from your Azure AD app registration. Leave as masked (****************) to keep existing secret.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="redirect-uri">OAuth Redirect URI</Label>
                    <div className="flex gap-2">
                      <Input
                        id="redirect-uri"
                        type="text"
                        value={redirectUri}
                        onChange={(e) => setRedirectUri(e.target.value)}
                        placeholder="https://your-domain.com/api/auth/callback"
                        data-testid="input-redirect-uri"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={autoDetectRedirectUri}
                        data-testid="button-auto-detect-uri"
                        className="whitespace-nowrap"
                      >
                        Auto-detect
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The redirect URI for OAuth authentication. This must match exactly what's configured in your Azure AD app registration.
                      Click "Auto-detect" to use the current domain.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={updateOperatorConfigMutation.isPending}
                    className="w-full"
                    data-testid="button-save-operator-config"
                  >
                    {updateOperatorConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Security Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle>Security Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Use a strong, unique password</p>
                  <p className="text-muted-foreground">At least 12 characters with letters, numbers, and symbols</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Change your password regularly</p>
                  <p className="text-muted-foreground">Update your password every 90 days</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Never share your credentials</p>
                  <p className="text-muted-foreground">Keep your password confidential at all times</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Sign out when done</p>
                  <p className="text-muted-foreground">Always log out from shared or public computers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
