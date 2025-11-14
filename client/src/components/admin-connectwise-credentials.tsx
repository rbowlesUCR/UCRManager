import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, CheckCircle, Server, Lock, Ticket } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectWiseCredentials {
  id: string;
  tenantId: string;
  baseUrl: string;
  companyId: string;
  defaultTimeMinutes: number;
  autoUpdateStatus: boolean;
  defaultStatusId: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

interface AdminConnectWiseCredentialsProps {
  tenantId: string;
  tenantName: string;
}

export function AdminConnectWiseCredentials({ tenantId, tenantName }: AdminConnectWiseCredentialsProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [defaultTimeMinutes, setDefaultTimeMinutes] = useState(15);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState(false);
  const [defaultStatusId, setDefaultStatusId] = useState("");
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showClientId, setShowClientId] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing credentials
  const { data: credentials, isLoading: loadingCredentials } = useQuery<ConnectWiseCredentials>({
    queryKey: [`/api/admin/tenant/${tenantId}/connectwise-credentials`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenant/${tenantId}/connectwise-credentials`, {
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
      setBaseUrl(credentials.baseUrl || "");
      setCompanyId(credentials.companyId || "");
      setDefaultTimeMinutes(credentials.defaultTimeMinutes || 15);
      setAutoUpdateStatus(credentials.autoUpdateStatus || false);
      setDefaultStatusId(credentials.defaultStatusId?.toString() || "");
      // Don't populate sensitive keys for security
      setPublicKey("");
      setPrivateKey("");
      setClientId("");
    } else {
      setBaseUrl("");
      setCompanyId("");
      setPublicKey("");
      setPrivateKey("");
      setClientId("");
      setDefaultTimeMinutes(15);
      setAutoUpdateStatus(false);
      setDefaultStatusId("");
    }
  }, [credentials]);

  // Save credentials mutation
  const saveCredentials = useMutation({
    mutationFn: async () => {
      const payload: any = {
        baseUrl,
        companyId,
        publicKey,
        privateKey,
        clientId,
        defaultTimeMinutes,
        autoUpdateStatus,
        defaultStatusId: defaultStatusId ? parseInt(defaultStatusId) : null,
      };

      return await apiRequest("POST", `/api/admin/tenant/${tenantId}/connectwise-credentials`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "ConnectWise credentials saved successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/admin/tenant/${tenantId}/connectwise-credentials`],
      });
      // Clear sensitive fields after save
      setPublicKey("");
      setPrivateKey("");
      setClientId("");
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
      return await apiRequest("DELETE", `/api/admin/tenant/${tenantId}/connectwise-credentials`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "ConnectWise credentials deleted successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/admin/tenant/${tenantId}/connectwise-credentials`],
      });
      setBaseUrl("");
      setCompanyId("");
      setPublicKey("");
      setPrivateKey("");
      setClientId("");
      setDefaultTimeMinutes(15);
      setAutoUpdateStatus(false);
      setDefaultStatusId("");
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
    // Validation
    if (!baseUrl) {
      toast({
        title: "Validation Error",
        description: "Base URL is required",
        variant: "destructive",
      });
      return;
    }

    if (!companyId) {
      toast({
        title: "Validation Error",
        description: "Company ID is required",
        variant: "destructive",
      });
      return;
    }

    // If this is a new credential entry, require all API keys
    if (!credentials && (!publicKey || !privateKey || !clientId)) {
      toast({
        title: "Validation Error",
        description: "Public Key, Private Key, and Client ID are required for new credentials",
        variant: "destructive",
      });
      return;
    }

    // If updating and any key is provided, all must be provided
    if (credentials && (publicKey || privateKey || clientId)) {
      if (!publicKey || !privateKey || !clientId) {
        toast({
          title: "Validation Error",
          description: "If updating API keys, all three (Public Key, Private Key, Client ID) must be provided",
          variant: "destructive",
        });
        return;
      }
    }

    if (defaultTimeMinutes < 1 || defaultTimeMinutes > 480) {
      toast({
        title: "Validation Error",
        description: "Default time must be between 1 and 480 minutes",
        variant: "destructive",
      });
      return;
    }

    saveCredentials.mutate();
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete the ConnectWise credentials for this tenant?")) {
      deleteCredentials.mutate();
    }
  };

  if (loadingCredentials) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              ConnectWise Manage API Credentials
            </CardTitle>
            <CardDescription>
              Configure API credentials for ConnectWise Manage PSA integration
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
              This ConnectWise configuration is linked to <strong>{tenantName}</strong>. Voice configuration changes can be automatically logged to ConnectWise tickets.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6">
            {/* Base URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                Base URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://na.myconnectwise.net"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your ConnectWise server URL (e.g., https://na.myconnectwise.net, https://eu.myconnectwise.net)
              </p>
            </div>

            {/* Company ID */}
            <div className="space-y-2">
              <Label htmlFor="companyId">
                Company ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyId"
                type="text"
                placeholder="yourcompany"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your ConnectWise company identifier (found in System &gt; Setup Tables &gt; Company)
              </p>
            </div>

            {/* Public Key (API Member ID) */}
            <div className="space-y-2">
              <Label htmlFor="publicKey">
                Public Key (API Member ID) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="publicKey"
                  type={showPublicKey ? "text" : "password"}
                  placeholder={credentials ? "Enter new public key to update" : "Enter public key"}
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPublicKey(!showPublicKey)}
                >
                  {showPublicKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your API member identifier (create in System &gt; Members &gt; API Members)
              </p>
            </div>

            {/* Private Key (API Member Password) */}
            <div className="space-y-2">
              <Label htmlFor="privateKey">
                Private Key (API Member Password) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="privateKey"
                  type={showPrivateKey ? "text" : "password"}
                  placeholder={credentials ? "Enter new private key to update" : "Enter private key"}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {credentials && (
                <p className="text-xs text-muted-foreground">
                  Leave API keys blank to keep existing credentials
                </p>
              )}
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="clientId">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="clientId"
                  type={showClientId ? "text" : "password"}
                  placeholder={credentials ? "Enter new client ID to update" : "Enter client ID"}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowClientId(!showClientId)}
                >
                  {showClientId ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your developer client ID (register at https://developer.connectwise.com/ClientID)
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4">Default Time Entry Settings</h3>

              {/* Default Time Minutes */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="defaultTimeMinutes">
                  Default Time (minutes)
                </Label>
                <Input
                  id="defaultTimeMinutes"
                  type="number"
                  min="1"
                  max="480"
                  value={defaultTimeMinutes}
                  onChange={(e) => setDefaultTimeMinutes(parseInt(e.target.value) || 15)}
                />
                <p className="text-xs text-muted-foreground">
                  Default time logged for each voice configuration change (1-480 minutes)
                </p>
              </div>

              {/* Auto Update Status */}
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 mb-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-status-toggle" className="text-base">
                    Auto-Update Ticket Status
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically update ticket status when changes are logged
                  </p>
                </div>
                <Switch
                  id="auto-status-toggle"
                  checked={autoUpdateStatus}
                  onCheckedChange={setAutoUpdateStatus}
                />
              </div>

              {/* Default Status ID (only if auto-update is enabled) */}
              {autoUpdateStatus && (
                <div className="space-y-2">
                  <Label htmlFor="defaultStatusId">
                    Default Status ID
                  </Label>
                  <Input
                    id="defaultStatusId"
                    type="number"
                    placeholder="e.g., 123"
                    value={defaultStatusId}
                    onChange={(e) => setDefaultStatusId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The status ID to set when auto-updating tickets (found in ConnectWise: System &gt; Setup Tables &gt; Service Board &gt; Statuses)
                  </p>
                </div>
              )}
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
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteCredentials.isPending}
              >
                {deleteCredentials.isPending ? "Deleting..." : "Delete Credentials"}
              </Button>
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
  );
}
