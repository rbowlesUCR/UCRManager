import { useState } from "react";
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operator" data-testid="tab-operator-docs">
            Operator Tenant Setup
          </TabsTrigger>
          <TabsTrigger value="customer" data-testid="tab-customer-docs">
            Customer Tenant Setup
          </TabsTrigger>
          <TabsTrigger value="powershell" data-testid="tab-powershell-docs">
            PowerShell Setup
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
                Configure per-tenant PowerShell credentials for operations not available via Graph API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Replit Platform Limitation Warning */}
              <div className="bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="text-lg">⚠️</span> Replit Platform Limitation
                </h4>
                <p className="text-sm mb-3">
                  <strong>PowerShell script execution does NOT work on Replit platform (development OR production deployments).</strong>
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  PowerShell requires TTY (terminal) capabilities that aren't available in Replit's containerized environment. According to Replit's documentation, both development workspaces and production deployments run in containers without direct TTY access.
                </p>
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded p-3 mt-3">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">💡 Solution:</p>
                  <p className="text-sm text-blue-900 dark:text-blue-100 mt-1 mb-2">
                    To use PowerShell features, deploy this application to a compatible platform:
                  </p>
                  <ul className="list-disc list-inside text-sm text-blue-900 dark:text-blue-100 ml-2 space-y-1">
                    <li><strong>Azure App Service</strong> (recommended for Teams integration)</li>
                    <li><strong>AWS EC2</strong> or <strong>Google Cloud Compute Engine</strong></li>
                    <li><strong>Digital Ocean</strong>, <strong>Linode</strong>, or any VPS</li>
                    <li><strong>Your own server</strong> with PowerShell 7.5+ installed</li>
                  </ul>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded p-3 mt-3">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">✓ What's ready:</p>
                  <ul className="list-disc list-inside text-sm text-green-900 dark:text-green-100 mt-1 ml-2 space-y-1">
                    <li>PowerShell 7.5.1 is installed correctly</li>
                    <li>MicrosoftTeams module is pre-installed</li>
                    <li>All code is ready - just needs compatible hosting</li>
                    <li>You can configure credentials now for when you deploy</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Overview</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Some Microsoft Teams operations require PowerShell because Graph API endpoints don't exist yet:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li><strong>Phone number assignment</strong>: <code className="bg-muted px-1 rounded">Set-CsPhoneNumberAssignment</code> (Graph API alternative exists but may have limitations)</li>
                  <li><strong>Policy listing</strong>: <code className="bg-muted px-1 rounded">Get-CsOnlineVoiceRoutingPolicy</code> (No Graph API equivalent)</li>
                  <li><strong>Advanced configurations</strong>: Various Teams-specific settings not exposed via Graph API</li>
                </ul>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">⚠️ Per-Tenant Credentials</h4>
                <p className="text-sm">
                  PowerShell credentials are configured <strong>per customer tenant</strong>. Each tenant can have its own optional service account for PowerShell operations.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Required Administrator Roles</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  The service account must have one of these roles in the customer tenant:
                </p>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg border-l-4 border-l-green-500">
                    <div className="font-semibold text-sm">Teams Administrator</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ✅ Recommended - Provides necessary permissions for phone number assignment and voice routing policies
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="font-semibold text-sm">Global Administrator</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ✅ Works but provides more permissions than needed
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Server Prerequisites</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li><strong>PowerShell 7.x</strong> must be installed (tested with 7.4.2)</li>
                  <li><strong>MicrosoftTeams PowerShell module</strong> must be installed:
                    <div className="bg-muted p-3 rounded-lg font-mono text-sm mt-2">
                      Install-Module -Name MicrosoftTeams -Force -AllowClobber
                    </div>
                  </li>
                  <li>Verify installation:
                    <div className="bg-muted p-3 rounded-lg font-mono text-sm mt-2">
                      Get-Module -ListAvailable -Name MicrosoftTeams
                    </div>
                  </li>
                </ol>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">🧪 Test Module Installation</h4>
                    <p className="text-sm">
                      Click the button to verify that the MicrosoftTeams PowerShell module is properly installed on this server.
                    </p>
                  </div>
                  <Button
                    onClick={testTeamsModule}
                    disabled={testingModule}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    data-testid="button-test-teams-module"
                  >
                    {testingModule ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Test Module
                      </>
                    )}
                  </Button>
                </div>
                
                {moduleTestResult && (
                  <div className={`mt-4 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap ${
                    moduleTestResult.success 
                      ? "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100" 
                      : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100"
                  }`}>
                    {moduleTestResult.output}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Authentication Requirements</h3>
                <div className="space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">⚠️ Basic Authentication Required</h4>
                    <p className="text-sm">
                      The service account must support <strong>username/password authentication</strong>. Accounts with MFA enabled or modern authentication requirements may not work with automated PowerShell scripts.
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">💡 Recommended Setup</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                      <li>Create a dedicated service account (e.g., <code className="bg-muted px-1 rounded">teamsadmin@tenant.onmicrosoft.com</code>)</li>
                      <li>Assign <strong>Teams Administrator</strong> role</li>
                      <li>Use a strong, unique password (store securely)</li>
                      <li><strong>Do not enable MFA</strong> on this service account</li>
                      <li>Configure conditional access to restrict sign-in to specific IPs if needed</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Common Issues & Solutions</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">❌ "Test Connection" button fails</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                      <p><strong>Possible causes:</strong></p>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                        <li>MicrosoftTeams PowerShell module not installed on server</li>
                        <li>MFA enabled on the service account</li>
                        <li>Conditional access policies blocking authentication</li>
                        <li>Invalid credentials</li>
                        <li>Network connectivity issues</li>
                      </ul>
                      <p className="mt-3"><strong>Solutions:</strong></p>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                        <li>Install MicrosoftTeams module on the server</li>
                        <li>Disable MFA on the service account (use conditional access for IP restrictions instead)</li>
                        <li>Verify credentials are correct</li>
                        <li>Check that the account has Teams Administrator role</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">❌ "Permission denied" errors during operations</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                      <p><strong>Solution:</strong> Verify the service account has <strong>Teams Administrator</strong> or <strong>Global Administrator</strong> role in Azure AD</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">❌ Phone number assignment fails</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
                      <p><strong>Prerequisites for phone number assignment:</strong></p>
                      <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                        <li>User must have a Teams license assigned</li>
                        <li>User must have Teams Phone System (MCOEV) license</li>
                        <li>Phone number must be in E.164 format (e.g., +12065551234)</li>
                        <li>If phone number was set in on-premises AD, clear it first and sync to M365</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Configuring Credentials</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in to the <strong>Admin Panel</strong></li>
                  <li>Go to <strong>Customer Tenants</strong></li>
                  <li>Find the tenant you want to configure</li>
                  <li>Click the <strong>Terminal icon</strong> (Configure PowerShell)</li>
                  <li>Enter:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li><strong>User Principal Name</strong>: Service account UPN (e.g., teamsadmin@tenant.onmicrosoft.com)</li>
                      <li><strong>Password</strong>: Service account password (encrypted before storage)</li>
                      <li><strong>Description</strong>: Optional note about the account</li>
                    </ul>
                  </li>
                  <li>Click <strong>Save Credentials</strong></li>
                  <li>(Optional) Click <strong>Test Connection</strong> to verify (may fail if module not installed, but operations will still work)</li>
                </ol>
              </div>

              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">✅ Security Notes</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Passwords are encrypted with AES-256-GCM before storage</li>
                  <li>Credentials are passed to PowerShell via environment variables (not written to disk)</li>
                  <li>Each tenant has its own optional credentials - not required for all tenants</li>
                  <li>Credentials are only used when operators explicitly request PowerShell operations</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm">
                  <strong>💡 Important:</strong> If the "Test Connection" button fails but your credentials are valid, the PowerShell operations will still work when operators use them. The test may fail due to MFA or module installation, but actual operations bypass these issues.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AdminLayout>
  );
}
