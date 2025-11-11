import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, CheckCircle2, PlayCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";
import { apiRequest } from "@/lib/queryClient";

export default function AdminDocumentation() {
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [testingModule, setTestingModule] = useState(false);
  const [moduleTestResult, setModuleTestResult] = useState<{ success: boolean; output: string } | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied successfully",
    });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const testTeamsModule = async () => {
    setTestingModule(true);
    setModuleTestResult(null);
    
    try {
      const res = await apiRequest("POST", "/api/admin/powershell/test-teams-module", {});
      const result = await res.json() as { success: boolean; output: string; error?: string };
      
      setModuleTestResult(result);
      
      if (result.success) {
        toast({
          title: "✓ Module test successful",
          description: "MicrosoftTeams module is properly installed",
        });
      } else {
        toast({
          title: "Module test failed",
          description: result.error || "Please check the installation",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Test failed",
        description: "Failed to test module installation",
        variant: "destructive",
      });
    } finally {
      setTestingModule(false);
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2">Setup Documentation</h1>
        <p className="text-muted-foreground">
          Complete guides for configuring Azure AD app registrations
        </p>
      </div>

      <Tabs defaultValue="operator" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operator" data-testid="tab-operator-docs">
            Operator Tenant Setup
          </TabsTrigger>
          <TabsTrigger value="customer" data-testid="tab-customer-docs">
            Customer Tenant Setup
          </TabsTrigger>
          <TabsTrigger value="powershell" data-testid="tab-powershell-docs">
            PowerShell Setup
          </TabsTrigger>
          <TabsTrigger value="guides" data-testid="tab-full-guides">
            Full Guides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operator Tenant App Registration</CardTitle>
              <CardDescription>
                Configure Azure AD authentication for operator sign-in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The operator tenant app registration enables your team to sign in using Microsoft accounts.
                  This is a single-tenant configuration that only requires basic authentication permissions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 1: Create App Registration</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Navigate to <strong>Microsoft Entra ID</strong> → <strong>App registrations</strong></li>
                  <li>Click <strong>New registration</strong></li>
                  <li>Configure:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><strong>Name</strong>: Teams Voice Manager - Operator Portal</li>
                      <li><strong>Supported account types</strong>: Accounts in this organizational directory only</li>
                      <li><strong>Redirect URI</strong>: Web → <code className="bg-muted px-1 rounded">{window.location.origin}/api/auth/callback</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6"
                          onClick={() => copyToClipboard(`${window.location.origin}/api/auth/callback`, "redirect-uri")}
                          data-testid="button-copy-redirect-uri"
                        >
                          {copiedSection === "redirect-uri" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </li>
                    </ul>
                  </li>
                  <li>Click <strong>Register</strong></li>
                  <li>Save <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 2: Create Client Secret</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Go to <strong>Certificates & secrets</strong></li>
                  <li>Click <strong>New client secret</strong></li>
                  <li>Add description and set expiration (12-24 months recommended)</li>
                  <li>Click <strong>Add</strong></li>
                  <li className="text-destructive font-semibold">⚠️ Immediately copy the Value (never shown again!)</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 3: Configure Environment Variables</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Add these secrets to your Replit project:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
                  <div>AZURE_TENANT_ID=&lt;your-tenant-id&gt;</div>
                  <div>AZURE_CLIENT_ID=&lt;your-client-id&gt;</div>
                  <div>AZURE_CLIENT_SECRET=&lt;your-client-secret&gt;</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Required Permissions</h3>
                <p className="text-sm text-muted-foreground">
                  ✅ <strong>Microsoft Graph</strong> → <code className="bg-muted px-1 rounded">User.Read</code> (Delegated) - Default permission is sufficient
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>No additional permissions needed!</strong> This app registration is only for operator authentication.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm">
                  <strong>💡 Tip:</strong> For complete step-by-step instructions with troubleshooting,
                  download the full documentation file from your project repository: <code className="bg-muted px-1 rounded">OPERATOR_TENANT_SETUP.md</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Tenant App Registration</CardTitle>
              <CardDescription>
                Configure Graph API permissions for each customer tenant you manage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Each customer tenant requires a dedicated app registration with Microsoft Graph API permissions
                  to query users, retrieve policies, and assign phone numbers.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 1: Create App Registration in Customer Tenant</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a> <strong>as customer tenant admin</strong></li>
                  <li>Navigate to <strong>Microsoft Entra ID</strong> → <strong>App registrations</strong></li>
                  <li>Click <strong>New registration</strong></li>
                  <li>Configure:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><strong>Name</strong>: Teams Voice Manager - Customer API Access</li>
                      <li><strong>Supported account types</strong>: Accounts in this organizational directory only</li>
                      <li><strong>Redirect URI</strong>: Leave blank</li>
                    </ul>
                  </li>
                  <li>Click <strong>Register</strong></li>
                  <li>Save <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 2: Create Client Secret</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Go to <strong>Certificates & secrets</strong></li>
                  <li>Click <strong>New client secret</strong></li>
                  <li>Add description and set expiration</li>
                  <li className="text-destructive font-semibold">⚠️ Copy the secret Value immediately!</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 3: Configure Microsoft Graph API Permissions</h3>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold">✅ NEW (October 2025): Full Teams management via Graph API beta</p>
                  <p className="text-xs text-muted-foreground mt-1">Telephone number assignment and policy assignment work natively via Graph API beta endpoints. Policy retrieval may use fallback values.</p>
                </div>
                <p className="text-sm font-semibold mb-3">Required Application Permissions (4 Total):</p>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="font-mono text-sm font-semibold">User.Read.All</div>
                    <div className="text-xs text-muted-foreground mt-1">Query Teams voice-enabled users (read-only)</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="font-mono text-sm font-semibold">TeamsUserConfiguration.Read.All</div>
                    <div className="text-xs text-muted-foreground mt-1">Read Teams user phone configurations</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg border-l-4 border-l-orange-500">
                    <div className="font-mono text-sm font-semibold flex items-center gap-2">
                      TeamSettings.ReadWrite.All
                      <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">Beta</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Assign and manage Teams telephone numbers via PATCH operations</div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg border-l-4 border-l-orange-500">
                    <div className="font-mono text-sm font-semibold flex items-center gap-2">
                      TeamsPolicyUserAssign.ReadWrite.All
                      <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">Beta</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Assign voice routing policies to users</div>
                  </div>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm mt-4">
                  <li>Go to <strong>API permissions</strong> → <strong>Add a permission</strong></li>
                  <li>Select <strong>Microsoft Graph</strong> → <strong>Application permissions</strong></li>
                  <li>Search for and add each permission above</li>
                  <li>Click <strong>Add permissions</strong></li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 4: Grant Admin Consent (REQUIRED)</h3>
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-3">
                  <p className="text-sm font-semibold">⚠️ CRITICAL: Application permissions require admin consent</p>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>On <strong>API permissions</strong> page, click <strong>Grant admin consent for [Organization]</strong></li>
                  <li>Click <strong>Yes</strong> to confirm</li>
                  <li>Verify all permissions show <strong>green checkmarks</strong></li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 5: Add Customer Tenant to Application</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to Teams Voice Manager as an operator</li>
                  <li>Click <strong>Add New Tenant</strong> in the tenant selector</li>
                  <li>Enter:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li>Tenant name (friendly name)</li>
                      <li>Tenant ID from Azure</li>
                      <li>App Registration ID</li>
                      <li>App Registration Secret</li>
                    </ul>
                  </li>
                  <li>Click <strong>Add Tenant</strong></li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Step 6: Verify Permissions (RECOMMENDED)</h3>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-3">
                  <p className="text-sm font-semibold">✅ Use the built-in validation feature to verify your setup</p>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to the <strong>Admin Panel</strong></li>
                  <li>Go to <strong>Customer Tenants</strong> section</li>
                  <li>Find your tenant and click <strong>Validate Permissions</strong></li>
                  <li>Review the results - all 4 permissions should show as "success":
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><strong>User.Read.All</strong>: Tested by querying users</li>
                      <li><strong>TeamsUserConfiguration.Read.All</strong>: Tested by reading Teams configurations</li>
                      <li><strong>TeamSettings.ReadWrite.All</strong>: Cannot test without changes (marked success if granted)</li>
                      <li><strong>TeamsPolicyUserAssign.ReadWrite.All</strong>: Cannot test without changes (marked success if granted)</li>
                    </ul>
                  </li>
                  <li>If any permission shows "Permission denied", re-check Step 4 (admin consent)</li>
                </ol>
              </div>

              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">✅ Graph API Beta Support (October 2025)</h4>
                <p className="text-sm mb-2">
                  <strong>Full Teams phone system management via Graph API beta</strong>
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  ✅ Teams telephone number (Line URI) assignment via Graph API beta<br/>
                  ✅ Voice routing policy assignment via Graph API beta<br/>
                  ⚠️ Policy retrieval uses fallback values (PowerShell may be needed for complete policy lists)
                </p>
                <p className="text-sm font-semibold mb-2">API Endpoints Used:</p>
                <div className="bg-black/10 dark:bg-white/10 p-3 rounded font-mono text-xs space-y-1">
                  <div>GET /beta/admin/teams/userConfigurations (read phone numbers)</div>
                  <div>POST /beta/admin/teams/policy/userAssignments/assign (assign policies)</div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  <strong>PowerShell for policy management:</strong> Use <code className="bg-muted px-1 rounded">Get-CsOnlineVoiceRoutingPolicy</code> to see available policies and <code className="bg-muted px-1 rounded">Get-CsOnlineUser</code> to verify assignments
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm">
                  <strong>💡 Tip:</strong> For complete instructions including troubleshooting and security best practices,
                  download the full documentation: <code className="bg-muted px-1 rounded">CUSTOMER_TENANT_SETUP.md</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="powershell" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PowerShell for Teams Administration</CardTitle>
              <CardDescription>
                Certificate-based authentication for secure, automated PowerShell operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 dark:bg-green-950 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="text-lg">✅</span> Certificate-Based Authentication
                </h4>
                <p className="text-sm mb-3">
                  Microsoft's recommended approach for automated PowerShell operations with Teams.
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground ml-2">
                  <li><strong>No user credentials stored</strong> - Only certificate thumbprint (public info)</li>
                  <li><strong>No MFA prompts</strong> - Fully automated authentication</li>
                  <li><strong>Fully automated operations</strong> - No interactive sign-in required</li>
                  <li><strong>Microsoft best practice</strong> - Industry-standard approach</li>
                  <li><strong>Instant revocation</strong> - Remove certificate from Azure AD to disable</li>
                </ul>
              </div>

              {/* Certificate-Based Authentication Section */}
              <div id="server-certificate-setup" className="scroll-mt-20">
                <h3 className="text-xl font-bold mb-4 border-b pb-2">🔐 Certificate-Based Authentication Setup</h3>

                <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-5 mb-4">
                  <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                    📖 Complete Setup Documentation
                  </h4>
                  <p className="text-sm mb-4">
                    Comprehensive step-by-step guides with troubleshooting, security best practices, and certificate management are available in your project repository at:
                    <code className="block bg-white/50 dark:bg-black/30 px-3 py-2 rounded mt-2 text-xs">
                      C:\inetpub\wwwroot\UCRManager\
                    </code>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="font-mono text-xs font-bold mb-1 text-blue-600 dark:text-blue-400">
                        SERVER_CERTIFICATE_SETUP.md
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Complete wizard for generating certificates on your Windows Server with verification steps
                      </div>
                      <div className="text-xs font-semibold">~4,000 words • 15 min read</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div className="font-mono text-xs font-bold mb-1 text-blue-600 dark:text-blue-400">
                        CUSTOMER_TENANT_POWERSHELL_SETUP.md
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Azure AD configuration, certificate upload, and permissions setup with troubleshooting
                      </div>
                      <div className="text-xs font-semibold">~4,500 words • 18 min read</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-200 dark:border-green-700">
                      <div className="font-mono text-xs font-bold mb-1 text-green-600 dark:text-green-400">
                        POWERSHELL_QUICKSTART.md
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Condensed 5-step setup guide for experienced admins
                      </div>
                      <div className="text-xs font-semibold">~800 words • 5 min read</div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded">
                    <p className="text-xs">
                      <strong>💡 Tip:</strong> Open these files in your favorite text editor or markdown viewer for the full experience. They include detailed command references, certificate tracking templates, and comprehensive troubleshooting sections.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Overview</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Certificate-based authentication uses Azure AD app registrations with self-signed certificates stored in the Windows Certificate Store.
                    This is Microsoft's recommended approach for automated PowerShell operations.
                  </p>
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                    <p className="text-sm font-semibold mb-2">✅ Benefits:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                      <li><strong>Zero credentials stored</strong> - Only certificate thumbprint (public info)</li>
                      <li><strong>No MFA needed</strong> - Fully automated authentication</li>
                      <li><strong>Least privilege access</strong> - Uses Teams Communications Administrator role (minimum permissions)</li>
                      <li><strong>Private key never leaves server</strong> - Stored in Windows Certificate Store</li>
                      <li><strong>Easy certificate rotation</strong> - Generate new, upload to Azure, update thumbprint</li>
                      <li><strong>Instant revocation</strong> - Remove from Azure AD to disable</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Quick Setup (15 minutes)</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-sm mb-2">Step 1: Generate Certificate on Server</h5>
                      <p className="text-sm text-muted-foreground mb-2">
                        Run the provided PowerShell script as Administrator on your Windows Server:
                      </p>
                      <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                        cd C:\inetpub\wwwroot\UCRManager\scripts<br/>
                        .\New-TeamsPowerShellCertificate.ps1 -TenantName "CustomerName"
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        This generates a 2048-bit RSA certificate and exports a .cer file for Azure upload.
                      </p>
                    </div>

                    <div id="customer-tenant-setup" className="scroll-mt-20">
                      <h5 className="font-semibold text-sm mb-2">Step 2: Upload Certificate to Azure AD (Customer Tenant)</h5>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Sign in to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a> (customer tenant)</li>
                        <li>Navigate to <strong>App registrations</strong> → Your app → <strong>Certificates & secrets</strong></li>
                        <li>Click <strong>Upload certificate</strong></li>
                        <li>Select the <code className="bg-muted px-1 rounded">.cer</code> file from Step 1</li>
                        <li>Click <strong>Add</strong></li>
                      </ol>
                      <p className="text-xs text-muted-foreground mt-3">
                        💡 <strong>Note:</strong> You must perform this step in the <strong>customer's Azure AD tenant</strong>, not your operator tenant. The certificate will be associated with the app registration in the customer's Azure AD.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-sm mb-2">Step 3: Assign Teams Communications Administrator Role</h5>
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
                        <p className="text-sm font-semibold mb-1">✅ Teams Communications Administrator</p>
                        <p className="text-xs text-muted-foreground">
                          This role provides the minimum permissions needed for phone number and voice routing policy management.
                          It's more secure than Teams Administrator or Global Administrator as it has a narrower scope.
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        <strong>To grant this role to your app registration:</strong>
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>In <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Azure Portal <ExternalLink className="h-3 w-3" /></a>, navigate to <strong>Microsoft Entra ID</strong></li>
                        <li>Go to <strong>Roles and administrators</strong></li>
                        <li>Search for and select <strong>Teams Communications Administrator</strong></li>
                        <li>Click <strong>Add assignments</strong></li>
                        <li>Search for your app registration by name (e.g., "Teams Voice Manager - Customer API Access")</li>
                        <li>Select the app registration and click <strong>Add</strong></li>
                        <li>Verify the assignment appears in the list</li>
                      </ol>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
                        ⚠️ <strong>Important:</strong> This role must be assigned to the app registration itself, not to a user account.
                        The app uses certificate authentication and operates with the permissions of the assigned role.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-sm mb-2">Step 4: Configure in Teams Voice Manager</h5>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Go to <strong>Admin Panel</strong> → <strong>Customer Tenants</strong></li>
                        <li>Select your tenant and click <strong>PowerShell Settings</strong></li>
                        <li>Click <strong>Add PowerShell Certificate Credentials</strong></li>
                        <li>Enter:
                          <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                            <li><strong>Application ID</strong>: From Azure App Registration</li>
                            <li><strong>Certificate Thumbprint</strong>: From certificate generation output</li>
                            <li><strong>Description</strong>: Optional note</li>
                          </ul>
                        </li>
                        <li>Click <strong>Add Credential</strong></li>
                        <li>Click <strong>Test Connection</strong> to verify!</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">🔧 Certificate Management</h4>
                  <p className="text-sm mb-2"><strong>View certificates on server:</strong></p>
                  <div className="bg-muted p-2 rounded-lg font-mono text-xs mb-3">
                    Get-ChildItem Cert:\LocalMachine\My | Where-Object &#123; $_.Subject -like "*TeamsPowerShell*" &#125;
                  </div>
                  <p className="text-sm mb-2"><strong>Certificate renewal (every 2 years):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                    <li>Generate new certificate with same TenantName</li>
                    <li>Upload new .cer to Azure AD (old cert still works)</li>
                    <li>Update thumbprint in Teams Voice Manager</li>
                    <li>Test connection</li>
                    <li>Remove old certificate from Azure AD</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Documentation Guides</CardTitle>
              <CardDescription>
                Full setup documentation with detailed instructions, troubleshooting, and best practices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DocumentationViewer filename="POWERSHELL_QUICKSTART.md" title="Quick Start Guide (5 minutes)" />
              <DocumentationViewer filename="SERVER_CERTIFICATE_SETUP.md" title="Server Certificate Setup (Detailed)" />
              <DocumentationViewer filename="CUSTOMER_TENANT_POWERSHELL_SETUP.md" title="Customer Tenant Azure AD Setup" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AdminLayout>
  );
}

function DocumentationViewer({ filename, title }: { filename: string; title: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [`/api/admin/documentation/${filename}`],
    enabled: isExpanded,
  });

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{filename}</p>
        </div>
        <Button variant="outline" size="sm">
          {isExpanded ? "Hide" : "View"} Documentation
        </Button>
      </div>
      {isExpanded && (
        <div className="border-t p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : data?.content ? (
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
              {data.content}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load documentation</p>
          )}
        </div>
      )}
    </div>
  );
}
