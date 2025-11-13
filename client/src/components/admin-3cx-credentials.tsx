import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, CheckCircle, Server, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ThreeCXCredentials {
  id: string;
  tenantId: string;
  serverUrl: string;
  username: string;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

interface Admin3CXCredentialsProps {
  tenantId: string;
  tenantName: string;
}

export function Admin3CXCredentials({ tenantId, tenantName }: Admin3CXCredentialsProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing credentials
  const { data: credentials, isLoading: loadingCredentials } = useQuery<ThreeCXCredentials>({
    queryKey: [`/api/admin/tenant/${tenantId}/3cx-credentials`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenant/${tenantId}/3cx-credentials`, {
        credentials: "include",
      });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch credentials");
      }
      return await res.json();
    },
  });

  // Populate form when credentials are loaded
  useEffect(() => {
    if (credentials) {
      setServerUrl(credentials.serverUrl || "");
      setUsername(credentials.username || "");
      setMfaEnabled(credentials.mfaEnabled || false);
      setPassword(""); // Don't populate password for security
    } else {
      setServerUrl("");
      setUsername("");
      setPassword("");
      setMfaEnabled(false);
    }
  }, [credentials]);

  // Save credentials mutation
  const saveCredentials = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/tenant/${tenantId}/3cx-credentials`, {
        serverUrl,
        username,
        password,
        mfaEnabled,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "3CX credentials saved successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/admin/tenant/${tenantId}/3cx-credentials`],
      });
      setPassword(""); // Clear password after save
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save credentials",
        variant: "destructive",
      });
    },
  });

  // Delete credentials mutation
  const deleteCredentials = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/admin/tenant/${tenantId}/3cx-credentials`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "3CX credentials deleted successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/admin/tenant/${tenantId}/3cx-credentials`],
      });
      setServerUrl("");
      setUsername("");
      setPassword("");
      setMfaEnabled(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete credentials",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!serverUrl || !username || !password) {
      toast({
        title: "Validation Error",
        description: "Server URL, username, and password are required",
        variant: "destructive",
      });
      return;
    }
    saveCredentials.mutate();
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete the 3CX credentials for this tenant?")) {
      deleteCredentials.mutate();
    }
  };

  const handleTestConnection = async () => {
    if (!credentials) {
      toast({
        title: "Error",
        description: "Please save credentials before testing connection",
        variant: "destructive",
      });
      return;
    }

    if (credentials.mfaEnabled) {
      setMfaCode("");
      setShowMfaDialog(true);
    } else {
      await testConnection(null);
    }
  };

  const testConnection = async (mfaCodeValue: string | null) => {
    setTestingConnection(true);
    try {
      await apiRequest("POST", `/api/admin/tenant/${tenantId}/3cx-credentials/test`, {
        mfaCode: mfaCodeValue,
      });

      toast({
        title: "Connection Successful",
        description: `Successfully connected to 3CX server at ${credentials?.serverUrl}`,
      });
      setShowMfaDialog(false);
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to 3CX server",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleMfaSubmit = () => {
    if (!mfaCode) {
      toast({
        title: "Validation Error",
        description: "Please enter your MFA code",
        variant: "destructive",
      });
      return;
    }
    testConnection(mfaCode);
  };

  if (loadingCredentials) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                3CX Server Credentials
              </CardTitle>
              <CardDescription>
                Configure authentication credentials for the 3CX phone system
              </CardDescription>
            </div>
            {credentials && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                Configured
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Tenant Association Info */}
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription>
                This 3CX server is linked to <strong>{tenantName}</strong>. Phone numbers synced from this 3CX system will be added to this customer tenant's number inventory.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6">
              {/* Server URL */}
              <div className="space-y-2">
                <Label htmlFor="serverUrl">
                  3CX Server URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="serverUrl"
                  type="url"
                  placeholder="https://your-3cx-server.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The full URL to your 3CX server (e.g., https://pbx.example.com:5001)
                </p>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Numeric username (e.g., 100)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  3CX uses numeric usernames for authentication
                </p>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={credentials ? "Enter new password to update" : "Enter password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {credentials && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep existing password
                  </p>
                )}
              </div>

              {/* MFA Toggle */}
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="mfa-toggle" className="text-base">
                    Multi-Factor Authentication (MFA)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable if your 3CX server requires MFA. You'll be prompted for the code when testing connection.
                  </p>
                </div>
                <Switch
                  id="mfa-toggle"
                  checked={mfaEnabled}
                  onCheckedChange={setMfaEnabled}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={saveCredentials.isPending}
              >
                {saveCredentials.isPending ? "Saving..." : credentials ? "Update Credentials" : "Save Credentials"}
              </Button>

              {credentials && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteCredentials.isPending}
                  >
                    {deleteCredentials.isPending ? "Deleting..." : "Delete Credentials"}
                  </Button>
                </>
              )}
            </div>

            {credentials && (
              <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">Credential Information</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Created: {new Date(credentials.createdAt).toLocaleString()} by {credentials.createdBy}</p>
                  <p>Last Updated: {new Date(credentials.updatedAt).toLocaleString()} by {credentials.lastModifiedBy}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MFA Code Dialog */}
      <Dialog open={showMfaDialog} onOpenChange={setShowMfaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Multi-Factor Authentication</DialogTitle>
            <DialogDescription>
              Your 3CX server requires MFA. Please enter your authentication code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">MFA Code</Label>
              <Input
                id="mfa-code"
                type="text"
                placeholder="Enter your MFA code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleMfaSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMfaDialog(false);
                setTestingConnection(false);
              }}
              disabled={testingConnection}
            >
              Cancel
            </Button>
            <Button onClick={handleMfaSubmit} disabled={testingConnection}>
              {testingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
