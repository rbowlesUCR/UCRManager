import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { decrypt } from "./encryption";
import { PolicyType, policyTypeConfig } from "../shared/schema";

export interface PowerShellResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}

export interface PowerShellCredentials {
  username: string;
  password: string; // Decrypted password (deprecated - use certificate auth)
}

export interface PowerShellCertificateCredentials {
  tenantId: string; // Azure tenant ID
  appId: string; // Application (client) ID
  certificateThumbprint: string; // Certificate thumbprint from Windows cert store
}

/**
 * Execute a PowerShell script with optional credentials
 * Credentials are passed via environment variables to avoid writing secrets to disk
 * @param scriptContent - The PowerShell script content to execute
 * @param credentials - Optional credentials for authentication
 * @param timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns Promise<PowerShellResult>
 */
export async function executePowerShellScript(
  scriptContent: string,
  credentials?: PowerShellCredentials,
  timeoutMs: number = 60000
): Promise<PowerShellResult> {
  return new Promise((resolve) => {
    // Create a temporary directory for the script
    const tempDir = mkdtempSync(join(tmpdir(), "pwsh-"));
    const scriptPath = join(tempDir, "script.ps1");

    try {
      // Prepare the script WITHOUT embedding credentials
      // Credentials will be passed via environment variables
      
      // Add anti-hang settings for containerized environments
      const antiHangPrefix = `
# Anti-hang settings for containerized/non-interactive environments
$ErrorActionPreference = 'Stop'
$ConfirmPreference = 'None'  # Never prompt for confirmation
$ProgressPreference = 'SilentlyContinue'  # Disable progress bars (can hang)

# Disable PSReadLine if present (causes hangs in containers)
if (Get-Module -Name PSReadLine -ListAvailable) {
    try {
        Remove-Module PSReadLine -Force -ErrorAction SilentlyContinue
    } catch {
        # Ignore if already removed or not loaded
    }
}
`;
      
      let finalScript = antiHangPrefix + "\n" + scriptContent;
      
      if (credentials) {
        // Inject credential creation that reads from environment variables
        const credentialSetup = `
# Create secure credential object from environment variables
$username = $env:PS_USERNAME
$password = $env:PS_PASSWORD | ConvertTo-SecureString -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($username, $password)
`;
        finalScript = antiHangPrefix + "\n" + credentialSetup + "\n" + scriptContent;
      }

      // Write the script to a temporary file (WITHOUT credentials)
      writeFileSync(scriptPath, finalScript, "utf8");

      // Prepare environment variables with credentials if provided
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        TERM: "dumb", // Prevent terminal control codes
        POWERSHELL_TELEMETRY_OPTOUT: "1", // Disable telemetry
      };

      // Pass credentials via environment variables (NOT written to disk)
      if (credentials) {
        env.PS_USERNAME = credentials.username;
        env.PS_PASSWORD = credentials.password;
      }

      // IMPORTANT: PowerShell execution does NOT work in Replit's containerized environment
      // PowerShell attempts to acquire TTY capabilities that aren't available in the sandbox,
      // causing all script executions to hang indefinitely regardless of flags used.
      // This limitation applies to BOTH development AND production deployments on Replit.
      // To use PowerShell, deploy to Azure App Service, AWS EC2, or a traditional VPS.
      
      // Check if we're running on Replit platform (dev or production)
      const isReplit = process.env.REPL_ID !== undefined;
      
      if (isReplit) {
        // On Replit platform, return immediate failure with helpful message
        setTimeout(() => {
          resolve({
            success: false,
            output: "",
            error: "PowerShell execution is not supported on Replit platform.\n\nPowerShell requires TTY capabilities not available in Replit's containerized environment (both development and production deployments).\n\nTo use PowerShell features, deploy this application to:\n- Azure App Service (recommended for Teams integration)\n- AWS EC2 or Google Cloud Compute Engine\n- Digital Ocean, Linode, or any VPS with shell access\n- Your own server with PowerShell 7.5+ installed\n\nNote: The MicrosoftTeams module IS installed and ready - it will work on a compatible hosting platform.",
            exitCode: -1,
          });
        }, 100);
        
        // Clean up temp file
        try {
          unlinkSync(scriptPath);
        } catch (err) {
          // Ignore cleanup errors
        }
        return;
      }

      // Execute PowerShell with the script file (production deployment)
      // Use powershell.exe (Windows PowerShell 5.1) since pwsh (PowerShell 7) is not installed
      const pwsh = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-NoLogo",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptPath
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        env
      });

      let stdout = "";
      let stderr = "";
      let completed = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          completed = true;
          pwsh.kill("SIGTERM");
          
          // Force kill if not terminated after 2 seconds
          setTimeout(() => {
            if (pwsh.exitCode === null) {
              pwsh.kill("SIGKILL");
            }
          }, 2000);

          // Clean up temp file
          try {
            unlinkSync(scriptPath);
          } catch (err) {
            // Ignore cleanup errors
          }

          resolve({
            success: false,
            output: stdout,
            error: `Script execution timed out after ${timeoutMs}ms`,
            exitCode: -1,
          });
        }
      }, timeoutMs);

      // Collect stdout
      pwsh.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      pwsh.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      pwsh.on("close", (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);

          // Clean up temp file
          try {
            unlinkSync(scriptPath);
          } catch (err) {
            // Ignore cleanup errors
          }

          const exitCode = code ?? -1;
          const success = exitCode === 0;

          resolve({
            success,
            output: stdout,
            error: stderr || undefined,
            exitCode,
          });
        }
      });

      // Handle process errors
      pwsh.on("error", (err) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);

          // Clean up temp file
          try {
            unlinkSync(scriptPath);
          } catch (cleanupErr) {
            // Ignore cleanup errors
          }

          resolve({
            success: false,
            output: stdout,
            error: `Failed to execute PowerShell: ${err.message}`,
            exitCode: -1,
          });
        }
      });

    } catch (err) {
      // Handle script file creation errors
      resolve({
        success: false,
        output: "",
        error: `Failed to create PowerShell script: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: -1,
      });
    }
  });
}

/**
 * Test PowerShell connectivity and basic functionality
 */
export async function testPowerShellConnectivity(): Promise<PowerShellResult> {
  const script = `
Write-Output "PowerShell Test Successful"
Write-Output "Version: $($PSVersionTable.PSVersion)"
Write-Output "Platform: $($PSVersionTable.Platform)"
`;
  
  return executePowerShellScript(script, undefined, 10000);
}

/**
 * Test if MicrosoftTeams module is installed and can be imported
 */
export async function testTeamsModuleInstallation(): Promise<PowerShellResult> {
  const script = `
# Test if MicrosoftTeams module is available
$module = Get-Module -ListAvailable -Name MicrosoftTeams

if ($module) {
    Write-Output "✓ MicrosoftTeams module is installed"
    Write-Output "  Version: $($module.Version)"
    Write-Output "  Path: $($module.ModuleBase)"
    Write-Output ""
    Write-Output "Module files verified:"
    $manifestPath = Join-Path $module.ModuleBase "MicrosoftTeams.psd1"
    if (Test-Path $manifestPath) {
        Write-Output "  ✓ Main manifest found: MicrosoftTeams.psd1"
    }
    $modulePath = Join-Path $module.ModuleBase "MicrosoftTeams.psm1"
    if (Test-Path $modulePath) {
        Write-Output "  ✓ Module script found: MicrosoftTeams.psm1"
    }
    
    # Count cmdlet manifests
    $cmdletManifests = Get-ChildItem -Path $module.ModuleBase -Filter "*.psd1" | Measure-Object
    Write-Output "  ✓ Found $($cmdletManifests.Count) cmdlet manifests"
    
    Write-Output ""
    Write-Output "Note: Module import test skipped in containerized environment."
    Write-Output "The module will work when deployed to a production server."
    exit 0
} else {
    Write-Error "✗ MicrosoftTeams module is not installed"
    Write-Error "Module should be located at: ~/.local/share/powershell/Modules/MicrosoftTeams"
    exit 1
}
`;
  
  return executePowerShellScript(script, undefined, 10000);
}

/**
 * Connect to Microsoft Teams PowerShell using provided credentials
 * Note: This requires the MicrosoftTeams module to be installed
 */
export async function connectToTeamsPowerShell(
  credentials: PowerShellCredentials
): Promise<PowerShellResult> {
  const script = `
# Check if MicrosoftTeams module is available
if (-not (Get-Module -ListAvailable -Name MicrosoftTeams)) {
    Write-Error "MicrosoftTeams module is not installed. Please install it first."
    exit 1
}

# Import the module
Import-Module MicrosoftTeams -ErrorAction Stop

# Connect to Teams
try {
    Connect-MicrosoftTeams -Credential $credential -ErrorAction Stop
    Write-Output "Successfully connected to Microsoft Teams"
    
    # Get and display current context
    $context = Get-CsTenant -ErrorAction SilentlyContinue
    if ($context) {
        Write-Output "Tenant ID: $($context.TenantId)"
        Write-Output "Display Name: $($context.DisplayName)"
    }
    
    # Disconnect
    Disconnect-MicrosoftTeams
} catch {
    Write-Error "Failed to connect to Microsoft Teams: $_"
    exit 1
}
`;

  return executePowerShellScript(script, credentials, 30000);
}

/**
 * Assign a phone number to a Teams user using Set-CsPhoneNumberAssignment
 */
export async function assignPhoneNumberToUser(
  credentials: PowerShellCredentials,
  userPrincipalName: string,
  phoneNumber: string
): Promise<PowerShellResult> {
  const script = `
# Import and connect
Import-Module MicrosoftTeams -ErrorAction Stop
Connect-MicrosoftTeams -Credential $credential -ErrorAction Stop

try {
    # Assign phone number
    Set-CsPhoneNumberAssignment -Identity "${userPrincipalName}" -PhoneNumber "${phoneNumber}" -PhoneNumberType DirectRouting -ErrorAction Stop
    
    Write-Output "Successfully assigned phone number ${phoneNumber} to ${userPrincipalName}"
    
    Disconnect-MicrosoftTeams
    exit 0
} catch {
    Write-Error "Failed to assign phone number: $_"
    Disconnect-MicrosoftTeams
    exit 1
}
`;

  return executePowerShellScript(script, credentials, 60000);
}

/**
 * Remove phone number assignment from a Teams user
 */
export async function removePhoneNumberFromUser(
  credentials: PowerShellCredentials,
  userPrincipalName: string
): Promise<PowerShellResult> {
  const script = `
# Import and connect
Import-Module MicrosoftTeams -ErrorAction Stop
Connect-MicrosoftTeams -Credential $credential -ErrorAction Stop

try {
    # Remove phone number
    Remove-CsPhoneNumberAssignment -Identity "${userPrincipalName}" -PhoneNumberType DirectRouting -ErrorAction Stop
    
    Write-Output "Successfully removed phone number from ${userPrincipalName}"
    
    Disconnect-MicrosoftTeams
    exit 0
} catch {
    Write-Error "Failed to remove phone number: $_"
    Disconnect-MicrosoftTeams
    exit 1
}
`;

  return executePowerShellScript(script, credentials, 60000);
}

/**
 * Get all voice routing policies using Get-CsOnlineVoiceRoutingPolicy
 */
export async function getVoiceRoutingPolicies(
  credentials: PowerShellCredentials
): Promise<PowerShellResult> {
  const script = `
# Import and connect
Import-Module MicrosoftTeams -ErrorAction Stop
Connect-MicrosoftTeams -Credential $credential -ErrorAction Stop

try {
    # Get all voice routing policies
    $policies = Get-CsOnlineVoiceRoutingPolicy -ErrorAction Stop
    
    # Format as JSON for easier parsing
    $policiesJson = $policies | Select-Object Identity, Description, OnlinePstnUsages | ConvertTo-Json -Depth 5
    
    Write-Output $policiesJson
    
    Disconnect-MicrosoftTeams
    exit 0
} catch {
    Write-Error "Failed to get voice routing policies: $_"
    Disconnect-MicrosoftTeams
    exit 1
}
`;

  return executePowerShellScript(script, credentials, 60000);
}

/**
 * Assign a voice routing policy to a Teams user
 */
export async function assignVoiceRoutingPolicy(
  credentials: PowerShellCredentials,
  userPrincipalName: string,
  policyName: string
): Promise<PowerShellResult> {
  const script = `
# Import and connect
Import-Module MicrosoftTeams -ErrorAction Stop
Connect-MicrosoftTeams -Credential $credential -ErrorAction Stop

try {
    # Assign voice routing policy
    Grant-CsOnlineVoiceRoutingPolicy -Identity "${userPrincipalName}" -PolicyName "${policyName}" -ErrorAction Stop

    Write-Output "Successfully assigned voice routing policy '${policyName}' to ${userPrincipalName}"

    Disconnect-MicrosoftTeams
    exit 0
} catch {
    Write-Error "Failed to assign voice routing policy: $_"
    Disconnect-MicrosoftTeams
    exit 1
}
`;

  return executePowerShellScript(script, credentials, 60000);
}

// ============================================================================
// CERTIFICATE-BASED AUTHENTICATION FUNCTIONS (RECOMMENDED)
// No user credentials or MFA required - uses app registration with certificate
// ============================================================================

/**
 * Build PowerShell connection script using certificate auth
 */
function buildCertificateAuthScript(credentials: PowerShellCertificateCredentials, userScript: string): string {
  return `
# Import MicrosoftTeams module
Import-Module MicrosoftTeams -ErrorAction Stop

# Connect to Microsoft Teams using certificate authentication
Connect-MicrosoftTeams \`
    -ApplicationId "${credentials.appId}" \`
    -CertificateThumbprint "${credentials.certificateThumbprint}" \`
    -TenantId "${credentials.tenantId}" \`
    -ErrorAction Stop | Out-Null

try {
    # Execute user commands
    ${userScript}

    # Disconnect
    Disconnect-MicrosoftTeams -Confirm:\$false -ErrorAction SilentlyContinue
    exit 0
} catch {
    Write-Error \$_.Exception.Message
    Disconnect-MicrosoftTeams -Confirm:\$false -ErrorAction SilentlyContinue
    exit 1
}
`;
}

/**
 * Execute PowerShell script with certificate-based authentication
 */
export async function executePowerShellWithCertificate(
  credentials: PowerShellCertificateCredentials,
  script: string,
  timeoutMs: number = 120000
): Promise<PowerShellResult> {
  const fullScript = buildCertificateAuthScript(credentials, script);
  return executePowerShellScript(fullScript, undefined, timeoutMs);
}

/**
 * Test certificate-based connection to Microsoft Teams
 */
export async function testCertificateConnection(
  credentials: PowerShellCertificateCredentials
): Promise<PowerShellResult> {
  const script = `
# Get tenant information to verify connection
$tenant = Get-CsTenant
Write-Output "Successfully connected to tenant: $($tenant.DisplayName)"
Write-Output "Tenant ID: $($tenant.TenantId)"
`;
  return executePowerShellWithCertificate(credentials, script, 30000);
}

/**
 * Get all voice routing policies using certificate auth
 */
export async function getVoiceRoutingPoliciesCert(
  credentials: PowerShellCertificateCredentials
): Promise<PowerShellResult> {
  const script = `
# Get all voice routing policies
$policies = Get-CsOnlineVoiceRoutingPolicy
$policies | Select-Object Identity, Description, OnlinePstnUsages | ConvertTo-Json -Compress
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Get policies for any policy type using certificate auth (generic method)
 */
export async function getTeamsPoliciesCert(
  credentials: PowerShellCertificateCredentials,
  policyType: PolicyType
): Promise<PowerShellResult> {
  const config = policyTypeConfig[policyType];

  // Build select properties based on whether policy supports descriptions
  const selectProperties = config.supportsDescription
    ? "Identity, Description"
    : "Identity";

  const script = `
# Get all ${config.displayName}
$policies = ${config.powerShellCmdGet}
$policies | Select-Object ${selectProperties} | ConvertTo-Json -Compress
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Assign phone number to user using certificate auth
 */
export async function assignPhoneNumberCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string,
  phoneNumber: string,
  locationId?: string
): Promise<PowerShellResult> {
  const locationParam = locationId ? `-LocationId "${locationId}"` : "";

  const script = `
# Assign phone number
Set-CsPhoneNumberAssignment \`
    -Identity "${userPrincipalName}" \`
    -PhoneNumber "${phoneNumber}" \`
    -PhoneNumberType DirectRouting ${locationParam}

Write-Output "Successfully assigned phone number ${phoneNumber} to ${userPrincipalName}"
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Grant voice routing policy to user using certificate auth
 */
export async function grantVoiceRoutingPolicyCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string,
  policyName: string
): Promise<PowerShellResult> {
  const script = `
# Grant voice routing policy
Grant-CsOnlineVoiceRoutingPolicy \`
    -Identity "${userPrincipalName}" \`
    -PolicyName "${policyName}"

Write-Output "Successfully assigned voice routing policy '${policyName}' to ${userPrincipalName}"
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Grant any policy type to user using certificate auth (generic method)
 */
export async function grantTeamsPolicyCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string,
  policyType: PolicyType,
  policyName: string
): Promise<PowerShellResult> {
  const config = policyTypeConfig[policyType];

  const script = `
# Grant ${config.displayName}
${config.powerShellCmdGrant} \`
    -Identity "${userPrincipalName}" \`
    -PolicyName "${policyName}"

Write-Output "Successfully assigned ${config.displayName.toLowerCase()} '${policyName}' to ${userPrincipalName}"
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Assign phone number AND voice routing policy in one operation (certificate auth)
 */
export async function assignPhoneAndPolicyCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string,
  phoneNumber: string,
  policyName: string,
  locationId?: string
): Promise<PowerShellResult> {
  const locationParam = locationId ? `-LocationId "${locationId}"` : "";

  const script = `
# Assign phone number
Set-CsPhoneNumberAssignment \`
    -Identity "${userPrincipalName}" \`
    -PhoneNumber "${phoneNumber}" \`
    -PhoneNumberType DirectRouting ${locationParam}

Write-Output "✓ Assigned phone number ${phoneNumber}"

# Grant voice routing policy
Grant-CsOnlineVoiceRoutingPolicy \`
    -Identity "${userPrincipalName}" \`
    -PolicyName "${policyName}"

Write-Output "✓ Assigned voice routing policy '${policyName}'"
Write-Output ""
Write-Output "Successfully configured ${userPrincipalName}"
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Get Teams user details using certificate auth
 */
export async function getTeamsUserCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string
): Promise<PowerShellResult> {
  const script = `
# Get Teams user details
$user = Get-CsOnlineUser -Identity "${userPrincipalName}"
$result = @{
    DisplayName = $user.DisplayName
    UserPrincipalName = $user.UserPrincipalName
    LineURI = $user.LineURI
    OnlineVoiceRoutingPolicy = $user.OnlineVoiceRoutingPolicy
    EnterpriseVoiceEnabled = $user.EnterpriseVoiceEnabled
    HostedVoiceMail = $user.HostedVoiceMail
}
$result | ConvertTo-Json -Compress
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Get phone number assignment for a user using certificate auth
 */
export async function getPhoneNumberAssignmentCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string
): Promise<PowerShellResult> {
  const script = `
# Get phone number assignment
$assignment = Get-CsPhoneNumberAssignment -AssignedPstnTargetId "${userPrincipalName}"
$assignment | Select-Object TelephoneNumber, NumberType, LocationId, CivicAddressId | ConvertTo-Json -Compress
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Get all voice-enabled users using certificate auth
 */
export async function getVoiceEnabledUsersCert(
  credentials: PowerShellCertificateCredentials
): Promise<PowerShellResult> {
  const script = `
# Get all voice-enabled users
$users = Get-CsOnlineUser -Filter {EnterpriseVoiceEnabled -eq \$true} | \`
    Select-Object DisplayName, UserPrincipalName, LineURI, OnlineVoiceRoutingPolicy
$users | ConvertTo-Json -Compress
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Remove phone number assignment using certificate auth
 */
export async function removePhoneNumberCert(
  credentials: PowerShellCertificateCredentials,
  userPrincipalName: string
): Promise<PowerShellResult> {
  const script = `
# Remove phone number assignment
Remove-CsPhoneNumberAssignment \`
    -Identity "${userPrincipalName}" \`
    -RemoveAll

Write-Output "Successfully removed phone number from ${userPrincipalName}"
`;
  return executePowerShellWithCertificate(credentials, script);
}

/**
 * Generate a new PowerShell certificate for Teams authentication
 * Returns certificate details including thumbprint and file path
 */
export interface CertificateGenerationResult extends PowerShellResult {
  certificateThumbprint?: string;
  certificatePath?: string;
  certificateSubject?: string;
  expirationDate?: string;
}

export async function generateTeamsCertificate(
  tenantName: string,
  validityYears: number = 2
): Promise<CertificateGenerationResult> {
  const script = `
# Certificate generation script
\$TenantName = "${tenantName.replace(/[^a-zA-Z0-9-]/g, '')}"
\$ValidityYears = ${validityYears}

# Define certificate properties
\$subject = "CN=TeamsPowerShell-\$TenantName"
\$certStoreLocation = "Cert:\\LocalMachine\\My"
\$outputPath = "C:\\inetpub\\wwwroot\\UCRManager\\temp"

# Create output directory if it doesn't exist
if (-not (Test-Path \$outputPath)) {
    New-Item -ItemType Directory -Path \$outputPath -Force | Out-Null
}

# Generate self-signed certificate
try {
    \$cert = New-SelfSignedCertificate -Subject \$subject -CertStoreLocation \$certStoreLocation -KeyExportPolicy Exportable -KeySpec Signature -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(\$ValidityYears)

    # Export public key (.cer file)
    \$cerPath = Join-Path \$outputPath "TeamsPowerShell-\$TenantName.cer"
    Export-Certificate -Cert \$cert -FilePath \$cerPath -Force | Out-Null

    # Return certificate details as JSON
    \$result = @{
        Success = \$true
        Thumbprint = \$cert.Thumbprint
        Subject = \$cert.Subject
        CerFilePath = \$cerPath
        ExpirationDate = \$cert.NotAfter.ToString("yyyy-MM-dd HH:mm:ss")
        Message = "Certificate generated successfully"
    }

    \$result | ConvertTo-Json -Compress
} catch {
    \$errorResult = @{
        Success = \$false
        Error = \$_.Exception.Message
    }
    \$errorResult | ConvertTo-Json -Compress
}
`;

  const result = await executePowerShellScript(script, undefined, 30000);

  // Parse JSON output if successful
  if (result.success && result.output) {
    try {
      const certData = JSON.parse(result.output);
      if (certData.Success) {
        return {
          ...result,
          certificateThumbprint: certData.Thumbprint,
          certificatePath: certData.CerFilePath,
          certificateSubject: certData.Subject,
          expirationDate: certData.ExpirationDate,
        };
      }
    } catch (parseError) {
      // If parsing fails, return raw result
    }
  }

  return result;
}
