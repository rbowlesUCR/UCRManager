import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Server, Users, Phone, TrendingUp, Settings, CheckCircle, AlertCircle, Loader2, Lock, RefreshCw } from "lucide-react";
import { TenantSelector } from "@/components/tenant-selector";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { CustomerTenant } from "@shared/schema";

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

interface ThreeCXUser {
  Id: string;
  Number: string;
  FirstName: string;
  LastName: string;
  DisplayName: string;
  EmailAddress: string;
  Require2FA: boolean;
}

interface ThreeCXTrunk {
  Id: number;
  Number: string;
  IsOnline: boolean;
  Direction: string;
  Gateway: {
    Name: string;
    Type: string;
    Host: string;
    Port: number;
    Internal: boolean;
  };
}

interface ThreeCXPhoneNumber {
  Number: string;
  TrunkId: number;
  TemplateFileName: string;
}

interface ODataResponse<T> {
  value: T[];
  "@odata.count"?: number;
}

export default function ThreeCXManagement() {
  const [selectedTenant, setSelectedTenant] = useState<CustomerTenant | null>(null);
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const { toast } = useToast();

  // Fetch existing credentials when tenant is selected
  const { data: credentials, isLoading: loadingCredentials } = useQuery<ThreeCXCredentials>({
    queryKey: ["/api/admin/tenant/:tenantId/3cx-credentials", selectedTenant?.id],
    enabled: !!selectedTenant,
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenant/${selectedTenant?.id}/3cx-credentials`, {
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

  // Determine if we can fetch data (authenticated or MFA not required)
  const canFetchData = !!selectedTenant && !!credentials && (isAuthenticated || !credentials.mfaEnabled);

  // Fetch users/extensions
  const { data: usersData, isLoading: loadingUsers, error: usersError, refetch: refetchUsers } = useQuery<ODataResponse<ThreeCXUser>>({
    queryKey: ["/api/admin/tenant/:tenantId/3cx/users", selectedTenant?.id, mfaCode],
    enabled: canFetchData,
    queryFn: async () => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/users?count=true&mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/users?count=true`;

      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      return await res.json();
    },
  });

  // Fetch trunks
  const { data: trunksData, isLoading: loadingTrunks, error: trunksError, refetch: refetchTrunks } = useQuery<ODataResponse<ThreeCXTrunk>>({
    queryKey: ["/api/admin/tenant/:tenantId/3cx/trunks", selectedTenant?.id, mfaCode],
    enabled: canFetchData,
    queryFn: async () => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/trunks?mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/trunks`;

      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch trunks");
      }
      return await res.json();
    },
  });

  // Fetch phone numbers/DIDs
  const { data: phoneNumbersData, isLoading: loadingPhoneNumbers, error: phoneNumbersError, refetch: refetchPhoneNumbers } = useQuery<ODataResponse<ThreeCXPhoneNumber>>({
    queryKey: ["/api/admin/tenant/:tenantId/3cx/phone-numbers", selectedTenant?.id, mfaCode],
    enabled: canFetchData,
    queryFn: async () => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers?mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers`;

      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch phone numbers");
      }
      return await res.json();
    },
  });

  const users = usersData?.value || [];
  const trunks = trunksData?.value || [];
  const phoneNumbers = phoneNumbersData?.value || [];
  const usersCount = usersData?.["@odata.count"] ?? users.length;
  const hasError = usersError || trunksError || phoneNumbersError;

  // Handle authentication button click
  const handleAuthenticate = () => {
    if (!credentials) {
      toast({
        title: "Error",
        description: "No credentials configured for this tenant",
        variant: "destructive",
      });
      return;
    }

    if (credentials.mfaEnabled) {
      setMfaCode("");
      setShowMfaDialog(true);
    } else {
      // No MFA needed, just mark as authenticated and fetch data
      setIsAuthenticated(true);
    }
  };

  // Handle MFA code submission
  const handleMfaSubmit = async () => {
    if (!mfaCode) {
      toast({
        title: "Validation Error",
        description: "Please enter your MFA code",
        variant: "destructive",
      });
      return;
    }

    setAuthenticating(true);
    try {
      // Test authentication by calling system info endpoint
      const url = `/api/admin/tenant/${selectedTenant?.id}/3cx/system-info?mfaCode=${encodeURIComponent(mfaCode)}`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Authentication failed");
      }

      // Success - mark as authenticated and close dialog
      setIsAuthenticated(true);
      setShowMfaDialog(false);

      toast({
        title: "Authentication Successful",
        description: "Successfully authenticated to 3CX server",
      });

      // Trigger data refetch
      refetchUsers();
      refetchTrunks();
      refetchPhoneNumbers();
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to authenticate to 3CX server",
        variant: "destructive",
      });
    } finally {
      setAuthenticating(false);
    }
  };

  // Sync mutation
  const syncNumbers = useMutation({
    mutationFn: async () => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/sync-numbers?mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/sync-numbers`;

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sync numbers");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: `Synced: ${data.synced}, Updated: ${data.updated}, Total: ${data.total}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync phone numbers",
        variant: "destructive",
      });
    },
  });

  const handleSyncNumbers = () => {
    if (!isAuthenticated && credentials?.mfaEnabled) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate first before syncing numbers",
        variant: "destructive",
      });
      return;
    }
    syncNumbers.mutate();
  };

  // Reset authentication when tenant changes
  const handleTenantChange = (tenant: CustomerTenant | null) => {
    setSelectedTenant(tenant);
    setIsAuthenticated(false);
    setMfaCode("");
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Server className="w-6 h-6" />
          3CX Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage 3CX phone system integration, users, extensions, and trunks
        </p>
      </div>

      {/* Tenant Selection */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Customer Tenant</CardTitle>
          <CardDescription>
            Select a customer tenant to manage 3CX integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSelector
            selectedTenant={selectedTenant}
            onSelectTenant={handleTenantChange}
          />
        </CardContent>
      </Card>

      {/* 3CX Configuration Status - Show when tenant is selected */}
      {selectedTenant && (
        <>
          {/* Credentials Status */}
          {loadingCredentials ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </CardContent>
            </Card>
          ) : (
            <Alert variant={credentials ? "default" : "destructive"}>
              <AlertDescription className="flex items-start gap-3">
                {credentials ? (
                  <>
                    <CheckCircle className="w-5 h-5 mt-0.5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">3CX Credentials Configured</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Server: {credentials.serverUrl} | Username: {credentials.username} | MFA: {credentials.mfaEnabled ? "Enabled" : "Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(credentials.updatedAt).toLocaleString()} by {credentials.lastModifiedBy}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setLocation("/admin/customer-tenants")}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Update Credentials
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">3CX Credentials Required</p>
                      <p className="text-sm mt-1">
                        Configure 3CX server credentials in the Admin Customer Tenants section before using 3CX features.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setLocation("/admin/customer-tenants")}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configure Credentials
                      </Button>
                    </div>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Authentication Button */}
          {credentials && !canFetchData && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="flex items-center justify-between py-6">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Authentication Required</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {credentials.mfaEnabled
                        ? "Please authenticate with your MFA code to access 3CX data"
                        : "Please authenticate to access 3CX data"}
                    </p>
                  </div>
                </div>
                <Button onClick={handleAuthenticate} disabled={authenticating}>
                  {authenticating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Authenticate
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Authenticated Status */}
          {credentials && canFetchData && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <span className="font-medium">Authenticated</span> - You can now view and manage 3CX data
              </AlertDescription>
            </Alert>
          )}

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Extensions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="text-2xl font-bold"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : usersError ? (
                  <div className="text-2xl font-bold text-red-500">!</div>
                ) : (
                  <div className="text-2xl font-bold">{usersCount}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {loadingUsers ? "Loading..." : usersError ? "Error loading" : "Active users"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">DID Numbers</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingPhoneNumbers ? (
                  <div className="text-2xl font-bold"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : phoneNumbersError ? (
                  <div className="text-2xl font-bold text-red-500">!</div>
                ) : (
                  <div className="text-2xl font-bold">{phoneNumbers.length}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {loadingPhoneNumbers ? "Loading..." : phoneNumbersError ? "Error loading" : "Phone numbers"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trunks</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingTrunks ? (
                  <div className="text-2xl font-bold"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : trunksError ? (
                  <div className="text-2xl font-bold text-red-500">!</div>
                ) : (
                  <div className="text-2xl font-bold">{trunks.length}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {loadingTrunks ? "Loading..." : trunksError ? "Error loading" : "SIP trunks"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Call Activity</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {hasError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {usersError && <div>Failed to load users: {(usersError as Error).message}</div>}
                {trunksError && <div>Failed to load trunks: {(trunksError as Error).message}</div>}
                {phoneNumbersError && <div>Failed to load phone numbers: {(phoneNumbersError as Error).message}</div>}
              </AlertDescription>
            </Alert>
          )}

          {/* Users/Extensions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users & Extensions
              </CardTitle>
              <CardDescription>
                Manage 3CX users and extension assignments for {selectedTenant.tenantName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : users.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Extension</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>2FA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.Id}>
                          <TableCell className="font-medium">{user.Number}</TableCell>
                          <TableCell>{user.DisplayName || `${user.FirstName} ${user.LastName}`}</TableCell>
                          <TableCell>{user.EmailAddress}</TableCell>
                          <TableCell>
                            {user.Require2FA ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No users found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trunks Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                SIP Trunks
              </CardTitle>
              <CardDescription>
                View and manage SIP trunk configurations for {selectedTenant.tenantName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTrunks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : trunks.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Direction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trunks.map((trunk) => (
                        <TableRow key={trunk.Id}>
                          <TableCell className="font-medium">{trunk.Number}</TableCell>
                          <TableCell>{trunk.Gateway.Name}</TableCell>
                          <TableCell>{trunk.Gateway.Type}</TableCell>
                          <TableCell>{trunk.Gateway.Host || (trunk.Gateway.Internal ? "Internal" : "-")}</TableCell>
                          <TableCell>{trunk.Gateway.Port || "-"}</TableCell>
                          <TableCell>
                            {trunk.IsOnline ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                Online
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Offline</span>
                            )}
                          </TableCell>
                          <TableCell>{trunk.Direction}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Server className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No trunks configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Phone Numbers Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Phone Numbers & DIDs
                  </CardTitle>
                  <CardDescription>
                    Manage phone numbers and DID assignments for {selectedTenant.tenantName}
                  </CardDescription>
                </div>
                {canFetchData && phoneNumbers.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncNumbers}
                    disabled={syncNumbers.isPending}
                  >
                    {syncNumbers.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync to Number Management
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingPhoneNumbers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : phoneNumbers.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Trunk ID</TableHead>
                        <TableHead>Template</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.map((phone, idx) => (
                        <TableRow key={`${phone.Number}-${idx}`}>
                          <TableCell className="font-medium">{phone.Number}</TableCell>
                          <TableCell>{phone.TrunkId}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{phone.TemplateFileName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Phone className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No phone numbers configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!selectedTenant && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Server className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a Customer Tenant</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a customer tenant from the dropdown above to start managing 3CX integration
            </p>
          </CardContent>
        </Card>
      )}

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
                setAuthenticating(false);
              }}
              disabled={authenticating}
            >
              Cancel
            </Button>
            <Button onClick={handleMfaSubmit} disabled={authenticating}>
              {authenticating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Authenticate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
