import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Plus, Edit2, Check, X, FileText, TestTube, Key, Hash, Sparkles, Download, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PowerShellCredential {
  id: string;
  tenantId: string;
  appId: string;
  certificateThumbprint: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminPowerShellCredentialsProps {
  tenantId: string;
  tenantName: string;
}

export function AdminPowerShellCredentials({ tenantId, tenantName }: AdminPowerShellCredentialsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [certData, setCertData] = useState<{
    thumbprint: string;
    subject: string;
    expirationDate: string;
    filename: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    appId: "",
    certificateThumbprint: "",
    description: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch credentials
  const { data: credentials = [], isLoading } = useQuery<PowerShellCredential[]>({
    queryKey: [`/api/admin/tenant/${tenantId}/powershell-credentials`],
  });

  // Create credential mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", `/api/admin/tenant/${tenantId}/powershell-credentials`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenant/${tenantId}/powershell-credentials`] });
      toast({ title: "Success", description: "PowerShell certificate credentials added successfully" });
      setIsAdding(false);
      setFormData({ appId: "", certificateThumbprint: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update credential mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<typeof formData>) => {
      const res = await apiRequest("PUT", `/api/admin/tenant/${tenantId}/powershell-credentials/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenant/${tenantId}/powershell-credentials`] });
      toast({ title: "Success", description: "PowerShell certificate credentials updated successfully" });
      setEditingId(null);
      setFormData({ appId: "", certificateThumbprint: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete credential mutation
  const deleteMutation = useMutation({
    mutationFn: async (credId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/tenant/${tenantId}/powershell-credentials/${credId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenant/${tenantId}/powershell-credentials`] });
      toast({ title: "Success", description: "PowerShell credentials deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/tenant/${tenantId}/powershell-credentials/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tenant/${tenantId}/powershell-credentials`] });
      toast({ title: "Success", description: "Credential status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (cred: PowerShellCredential) => {
    setEditingId(cred.id);
    setFormData({
      appId: cred.appId,
      certificateThumbprint: cred.certificateThumbprint,
      description: cred.description || "",
    });
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ appId: "", certificateThumbprint: "", description: "" });
  };

  // Test connection function
  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await apiRequest("POST", `/api/admin/tenants/${tenantId}/powershell/test-connection`, {});
      const result = await res.json();

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.output || "Successfully connected to Microsoft Teams using certificate authentication"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to Microsoft Teams",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to test connection",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Validate certificate thumbprint format
  const validateThumbprint = (thumbprint: string): boolean => {
    // Should be 40 hex characters
    return /^[A-Fa-f0-9]{40}$/.test(thumbprint.replace(/\s/g, ''));
  };

  // Generate certificate
  const handleGenerateCertificate = async () => {
    setIsGenerating(true);
    try {
      const res = await apiRequest("POST", `/api/admin/powershell/generate-certificate`, {
        tenantName,
        validityYears: 2,
      });
      const result = await res.json();

      if (result.success && result.certificateThumbprint) {
        const filename = `TeamsPowerShell-${tenantName.replace(/[^a-zA-Z0-9-]/g, '')}.cer`;
        setCertData({
          thumbprint: result.certificateThumbprint,
          subject: result.certificateSubject || '',
          expirationDate: result.expirationDate || '',
          filename,
        });
        setShowCertDialog(true);
        toast({
          title: "Certificate Generated",
          description: "Certificate created successfully! Download and upload to Azure AD."
        });
      } else {
        toast({
          title: "Generation Failed",
          description: result.error || "Failed to generate certificate",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate certificate",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Download certificate
  const handleDownloadCertificate = () => {
    if (!certData) return;
    window.open(`/api/admin/powershell/download-certificate/${certData.filename}`, '_blank');
  };

  // Copy thumbprint to clipboard
  const handleCopyThumbprint = () => {
    if (!certData) return;
    navigator.clipboard.writeText(certData.thumbprint);
    toast({
      title: "Copied",
      description: "Certificate thumbprint copied to clipboard"
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PowerShell Credentials</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PowerShell Certificate Credentials for {tenantName}</CardTitle>
        <CardDescription>
          Configure certificate-based authentication for Microsoft Teams PowerShell operations. No user credentials or MFA required!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Documentation Alert */}
        <Alert className="border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
          <FileText className="h-5 w-5" />
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <strong className="text-base">Certificate-Based Authentication (Recommended)</strong>
                <p className="text-sm mt-1">
                  This uses Azure AD app registration with certificate authentication.
                  <strong> No user passwords stored, no MFA prompts needed!</strong>
                </p>
              </div>
              <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  📖 Complete Setup Documentation:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <a
                    href="/admin/documentation#server-certificate-setup"
                    className="flex items-start gap-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <span className="text-lg">🖥️</span>
                    <div>
                      <div className="font-semibold text-blue-700 dark:text-blue-300">Server Certificate Setup</div>
                      <div className="text-xs text-muted-foreground">Generate certificates on your Windows Server</div>
                    </div>
                  </a>
                  <a
                    href="/admin/documentation#customer-tenant-setup"
                    className="flex items-start gap-2 p-2 bg-green-100 dark:bg-green-900/30 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <span className="text-lg">☁️</span>
                    <div>
                      <div className="font-semibold text-green-700 dark:text-green-300">Customer Tenant Setup</div>
                      <div className="text-xs text-muted-foreground">Upload certificates to Azure AD</div>
                    </div>
                  </a>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  💡 <strong>Also available as markdown files</strong> in <code className="bg-muted px-1 rounded">C:\inetpub\wwwroot\UCRManager\</code> for detailed step-by-step instructions with troubleshooting
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="default"
            onClick={handleGenerateCertificate}
            disabled={isGenerating}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Certificate"}
          </Button>
          {credentials.length > 0 && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              <TestTube className="h-4 w-4 mr-2" />
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
          )}
        </div>

        {/* Existing Credentials List */}
        {credentials.length > 0 && (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    App ID: {cred.appId}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Thumbprint: {cred.certificateThumbprint}
                  </div>
                  {cred.description && (
                    <div className="text-sm text-muted-foreground mt-1">{cred.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${cred.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {cred.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Added {new Date(cred.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActiveMutation.mutate({ id: cred.id, isActive: !cred.isActive })}
                  >
                    {cred.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(cred)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete these credentials?')) {
                        deleteMutation.mutate(cred.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Form */}
        {isAdding ? (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="appId">Application (Client) ID *</Label>
              <Input
                id="appId"
                type="text"
                placeholder="12345678-1234-1234-1234-123456789abc"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                From Azure AD App Registration → Overview → Application (client) ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificateThumbprint">Certificate Thumbprint *</Label>
              <Input
                id="certificateThumbprint"
                type="text"
                placeholder="A1B2C3D4E5F6... (40 hex characters)"
                value={formData.certificateThumbprint}
                onChange={(e) => setFormData({ ...formData, certificateThumbprint: e.target.value.replace(/\s/g, '') })}
                required
                className={formData.certificateThumbprint && !validateThumbprint(formData.certificateThumbprint) ? "border-red-500" : ""}
              />
              <p className="text-xs text-muted-foreground">
                From certificate generation output or Windows Certificate Store
              </p>
              {formData.certificateThumbprint && !validateThumbprint(formData.certificateThumbprint) && (
                <p className="text-xs text-red-500">
                  Must be 40 hexadecimal characters (0-9, A-F)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                type="text"
                placeholder="e.g., Production certificate for Teams PowerShell"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  (formData.certificateThumbprint && !validateThumbprint(formData.certificateThumbprint))
                }
              >
                <Check className="h-4 w-4 mr-2" />
                {editingId ? 'Update' : 'Add'} Credential
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add PowerShell Certificate Credentials
          </Button>
        )}
      </CardContent>

      {/* Certificate Generation Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              Certificate Generated Successfully!
            </DialogTitle>
            <DialogDescription>
              Your PowerShell certificate has been created. Follow these steps to complete the setup.
            </DialogDescription>
          </DialogHeader>

          {certData && (
            <div className="space-y-4">
              {/* Step 1: Download Certificate */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Download Certificate File
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Download the .cer file to upload to Azure AD
                </p>
                <Button onClick={handleDownloadCertificate} variant="default">
                  <Download className="h-4 w-4 mr-2" />
                  Download {certData.filename}
                </Button>
              </div>

              {/* Step 2: Certificate Details */}
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Certificate Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Certificate Thumbprint</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded text-xs font-mono break-all">
                        {certData.thumbprint}
                      </code>
                      <Button size="sm" variant="outline" onClick={handleCopyThumbprint}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded text-sm mt-1">
                      {certData.subject}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expiration Date</Label>
                    <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded text-sm mt-1">
                      {certData.expirationDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Next Steps */}
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Next Steps in Azure Portal
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Azure Portal</a> (customer tenant)</li>
                  <li>Navigate to <strong>App registrations</strong> → Your app → <strong>Certificates & secrets</strong></li>
                  <li>Click <strong>Upload certificate</strong> and select the downloaded .cer file</li>
                  <li>Go to <strong>API permissions</strong> → Grant permissions (User.Read.All, Organization.Read.All)</li>
                  <li>Click <strong>Grant admin consent</strong></li>
                  <li className="text-red-600 font-semibold">⭐ CRITICAL: Go to <strong>Entra ID</strong> → <strong>Roles and administrators</strong> → Search for <strong>"Teams Administrator"</strong> → Add your app as an assignment</li>
                  <li>Return here and save the App ID and certificate thumbprint in the form below</li>
                </ol>
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded text-xs">
                  <strong>⚠️ Without the Teams Administrator role, PowerShell commands will fail!</strong> The role assignment enables your app to modify phone numbers and voice policies.
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  📖 See <a href="/admin/documentation#customer-tenant-setup" className="text-blue-600 hover:underline">detailed setup guide</a> for complete instructions
                </div>
              </div>

              {/* Auto-fill button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setFormData({
                      ...formData,
                      certificateThumbprint: certData.thumbprint,
                    });
                    setShowCertDialog(false);
                    setIsAdding(true);
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Use This Certificate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
