import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Server,
  Users,
  Phone,
  TrendingUp,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  UserPlus,
  PhoneIncoming,
} from "lucide-react";
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
  OutboundCallerID?: string;
  Mobile?: string;
  AuthID?: string;
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
  Id?: string;
  Number: string;
  TrunkId: number;
  TemplateFileName?: string;
}

interface ODataResponse<T> {
  value: T[];
  "@odata.count"?: number;
}

type DialogMode = "add" | "edit" | "delete" | null;

export default function ThreeCXManagement() {
  const [selectedTenant, setSelectedTenant] = useState<CustomerTenant | null>(null);
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // User dialog state
  const [userDialogMode, setUserDialogMode] = useState<DialogMode>(null);
  const [selectedUser, setSelectedUser] = useState<ThreeCXUser | null>(null);
  const [userFormData, setUserFormData] = useState({
    Number: "",
    FirstName: "",
    LastName: "",
    EmailAddress: "",
    OutboundCallerID: "",
    MobileNumber: "",
    Require2FA: false,
  });

  // Phone number dialog state
  const [phoneDialogMode, setPhoneDialogMode] = useState<DialogMode>(null);
  const [selectedPhone, setSelectedPhone] = useState<ThreeCXPhoneNumber | null>(null);
  const [phoneFormData, setPhoneFormData] = useState({
    Number: "",
    TrunkId: "",
  });

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
      const url = `/api/admin/tenant/${selectedTenant?.id}/3cx/system-info?mfaCode=${encodeURIComponent(mfaCode)}`;
      const res = await fetch(url, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Authentication failed");
      }

      setIsAuthenticated(true);
      setShowMfaDialog(false);

      toast({
        title: "Authentication Successful",
        description: "Successfully authenticated to 3CX server",
      });

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

  // ===== USER MUTATIONS =====

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const payload = { ...userData };
      if (credentials?.mfaEnabled) {
        payload.mfaCode = mfaCode;
      }

      const res = await fetch(`/api/admin/tenant/${selectedTenant?.id}/3cx/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create user");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "User/extension created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/users"] });
      setUserDialogMode(null);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: string; userData: any }) => {
      const payload = { ...userData };
      if (credentials?.mfaEnabled) {
        payload.mfaCode = mfaCode;
      }

      const res = await fetch(`/api/admin/tenant/${selectedTenant?.id}/3cx/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }

      return res.status === 204 ? { success: true } : await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "User/extension updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/users"] });
      setUserDialogMode(null);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/users/${userId}?mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/users/${userId}`;

      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "User/extension deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/users"] });
      setUserDialogMode(null);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ===== PHONE NUMBER MUTATIONS =====

  // Create phone number mutation
  const createPhoneMutation = useMutation({
    mutationFn: async (phoneData: any) => {
      const payload = { ...phoneData, TrunkId: parseInt(phoneData.TrunkId) };
      if (credentials?.mfaEnabled) {
        payload.mfaCode = mfaCode;
      }

      const res = await fetch(`/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create phone number");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Phone Number Created",
        description: "DID/phone number created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/phone-numbers"] });
      setPhoneDialogMode(null);
      resetPhoneForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update phone number mutation
  const updatePhoneMutation = useMutation({
    mutationFn: async ({ numberId, phoneData }: { numberId: string; phoneData: any }) => {
      const payload = { ...phoneData, TrunkId: parseInt(phoneData.TrunkId) };
      if (credentials?.mfaEnabled) {
        payload.mfaCode = mfaCode;
      }

      const res = await fetch(`/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers/${numberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update phone number");
      }

      return res.status === 204 ? { success: true } : await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Phone Number Updated",
        description: "DID/phone number updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/phone-numbers"] });
      setPhoneDialogMode(null);
      resetPhoneForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete phone number mutation
  const deletePhoneMutation = useMutation({
    mutationFn: async (numberId: string) => {
      const url = credentials?.mfaEnabled && mfaCode
        ? `/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers/${numberId}?mfaCode=${encodeURIComponent(mfaCode)}`
        : `/api/admin/tenant/${selectedTenant?.id}/3cx/phone-numbers/${numberId}`;

      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete phone number");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Phone Number Deleted",
        description: "DID/phone number deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenant/:tenantId/3cx/phone-numbers"] });
      setPhoneDialogMode(null);
      setSelectedPhone(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  // ===== FORM HANDLERS =====

  const resetUserForm = () => {
    setUserFormData({
      Number: "",
      FirstName: "",
      LastName: "",
      EmailAddress: "",
      OutboundCallerID: "",
      Mobile: "",
      Require2FA: false,
    });
    setSelectedUser(null);
  };

  const resetPhoneForm = () => {
    setPhoneFormData({
      Number: "",
      TrunkId: "",
    });
    setSelectedPhone(null);
  };

  const handleAddUser = () => {
    resetUserForm();
    setUserDialogMode("add");
  };

  const handleEditUser = (user: ThreeCXUser) => {
    setSelectedUser(user);
    setUserFormData({
      Number: user.Number || "",
      FirstName: user.FirstName || "",
      LastName: user.LastName || "",
      EmailAddress: user.EmailAddress || "",
      OutboundCallerID: user.OutboundCallerID || "",
      Mobile: user.Mobile || "",
      Require2FA: user.Require2FA || false,
    });
    setUserDialogMode("edit");
  };

  const handleDeleteUser = (user: ThreeCXUser) => {
    setSelectedUser(user);
    setUserDialogMode("delete");
  };

  const handleAddPhone = () => {
    resetPhoneForm();
    setPhoneDialogMode("add");
  };

  const handleEditPhone = (phone: ThreeCXPhoneNumber) => {
    setSelectedPhone(phone);
    setPhoneFormData({
      Number: phone.Number || "",
      TrunkId: phone.TrunkId?.toString() || "",
    });
    setPhoneDialogMode("edit");
  };

  const handleDeletePhone = (phone: ThreeCXPhoneNumber) => {
    setSelectedPhone(phone);
    setPhoneDialogMode("delete");
  };

  const handleUserSubmit = () => {
    if (userDialogMode === "add") {
      createUserMutation.mutate(userFormData);
    } else if (userDialogMode === "edit" && selectedUser) {
      updateUserMutation.mutate({
        userId: selectedUser.Id,
        userData: userFormData,
      });
    }
  };

  const handlePhoneSubmit = () => {
    if (phoneDialogMode === "add") {
      createPhoneMutation.mutate(phoneFormData);
    } else if (phoneDialogMode === "edit" && selectedPhone) {
      updatePhoneMutation.mutate({
        numberId: selectedPhone.Id || selectedPhone.Number,
        phoneData: phoneFormData,
      });
    }
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Users & Extensions
                  </CardTitle>
                  <CardDescription>
                    Manage 3CX users and extension assignments for {selectedTenant.tenantName}
                  </CardDescription>
                </div>
                {canFetchData && (
                  <Button onClick={handleAddUser} size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                )}
              </div>
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
                        <TableHead className="w-[80px]">Actions</TableHead>
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
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteUser(user)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                <div className="flex gap-2">
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
                  {canFetchData && (
                    <Button onClick={handleAddPhone} size="sm" disabled>
                      <PhoneIncoming className="w-4 h-4 mr-2" />
                      Add DID (Future)
                    </Button>
                  )}
                </div>
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
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.map((phone, idx) => (
                        <TableRow key={phone.Id || `${phone.Number}-${idx}`}>
                          <TableCell className="font-medium">{phone.Number}</TableCell>
                          <TableCell>{phone.TrunkId}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{phone.TemplateFileName || "-"}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditPhone(phone)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeletePhone(phone)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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

      {/* User Add/Edit Dialog */}
      <Dialog open={userDialogMode === "add" || userDialogMode === "edit"} onOpenChange={(open) => !open && setUserDialogMode(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userDialogMode === "add" ? "Add User/Extension" : "Edit User/Extension"}</DialogTitle>
            <DialogDescription>
              {userDialogMode === "add"
                ? "Create a new user and extension in 3CX"
                : `Update user ${selectedUser?.Number} - ${selectedUser?.DisplayName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-number">Extension Number *</Label>
              <Input
                id="user-number"
                value={userFormData.Number}
                onChange={(e) => setUserFormData({ ...userFormData, Number: e.target.value })}
                placeholder="e.g., 100"
                disabled={userDialogMode === "edit"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email Address *</Label>
              <Input
                id="user-email"
                type="email"
                value={userFormData.EmailAddress}
                onChange={(e) => setUserFormData({ ...userFormData, EmailAddress: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-firstname">First Name *</Label>
              <Input
                id="user-firstname"
                value={userFormData.FirstName}
                onChange={(e) => setUserFormData({ ...userFormData, FirstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-lastname">Last Name *</Label>
              <Input
                id="user-lastname"
                value={userFormData.LastName}
                onChange={(e) => setUserFormData({ ...userFormData, LastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-outbound">Outbound Caller ID</Label>
              <Input
                id="user-outbound"
                value={userFormData.OutboundCallerID}
                onChange={(e) => setUserFormData({ ...userFormData, OutboundCallerID: e.target.value })}
                placeholder="+15551234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-mobile">Mobile Number</Label>
              <Input
                id="user-mobile"
                value={userFormData.Mobile}
                onChange={(e) => setUserFormData({ ...userFormData, Mobile: e.target.value })}
                placeholder="+15551234567"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="user-2fa"
                  checked={userFormData.Require2FA}
                  onCheckedChange={(checked) => setUserFormData({ ...userFormData, Require2FA: checked as boolean })}
                />
                <Label htmlFor="user-2fa" className="font-normal cursor-pointer">
                  Require 2FA for this user
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUserSubmit}
              disabled={createUserMutation.isPending || updateUserMutation.isPending || !userFormData.Number || !userFormData.EmailAddress || !userFormData.FirstName || !userFormData.LastName}
            >
              {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {userDialogMode === "add" ? "Creating..." : "Updating..."}
                </>
              ) : (
                userDialogMode === "add" ? "Create User" : "Update User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Delete Confirmation Dialog */}
      <Dialog open={userDialogMode === "delete"} onOpenChange={(open) => !open && setUserDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User/Extension</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user {selectedUser?.Number} - {selectedUser?.DisplayName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogMode(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.Id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Number Add/Edit Dialog */}
      <Dialog open={phoneDialogMode === "add" || phoneDialogMode === "edit"} onOpenChange={(open) => !open && setPhoneDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{phoneDialogMode === "add" ? "Add Phone Number/DID" : "Edit Phone Number/DID"}</DialogTitle>
            <DialogDescription>
              {phoneDialogMode === "add"
                ? "Add a new DID to your 3CX system"
                : `Update phone number ${selectedPhone?.Number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number *</Label>
              <Input
                id="phone-number"
                value={phoneFormData.Number}
                onChange={(e) => setPhoneFormData({ ...phoneFormData, Number: e.target.value })}
                placeholder="+15551234567"
                disabled={phoneDialogMode === "edit"}
              />
              <p className="text-xs text-muted-foreground">
                Enter the full phone number with country code (e.g., +15551234567)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-trunk">Trunk *</Label>
              <Select
                value={phoneFormData.TrunkId}
                onValueChange={(value) => setPhoneFormData({ ...phoneFormData, TrunkId: value })}
              >
                <SelectTrigger id="phone-trunk">
                  <SelectValue placeholder="Select trunk" />
                </SelectTrigger>
                <SelectContent>
                  {trunks.map((trunk) => (
                    <SelectItem key={trunk.Id} value={trunk.Id.toString()}>
                      {trunk.Number} - {trunk.Gateway.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the trunk this DID will be associated with
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={handlePhoneSubmit}
              disabled={createPhoneMutation.isPending || updatePhoneMutation.isPending || !phoneFormData.Number || !phoneFormData.TrunkId}
            >
              {(createPhoneMutation.isPending || updatePhoneMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {phoneDialogMode === "add" ? "Creating..." : "Updating..."}
                </>
              ) : (
                phoneDialogMode === "add" ? "Create DID" : "Update DID"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Number Delete Confirmation Dialog */}
      <Dialog open={phoneDialogMode === "delete"} onOpenChange={(open) => !open && setPhoneDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Phone Number/DID</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete phone number {selectedPhone?.Number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogMode(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPhone && deletePhoneMutation.mutate(selectedPhone.Id || selectedPhone.Number)}
              disabled={deletePhoneMutation.isPending}
            >
              {deletePhoneMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Phone Number"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
