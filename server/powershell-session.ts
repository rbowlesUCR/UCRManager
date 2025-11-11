import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import { decrypt } from "./encryption";
import { PolicyType, policyTypeConfig } from "../shared/schema";

export interface PowerShellCertificateCredentials {
  tenantId: string; // Azure AD tenant ID
  appId: string; // Application (client) ID
  certificateThumbprint: string; // Certificate thumbprint
}

export interface PowerShellSession {
  id: string;
  tenantId: string;
  operatorEmail: string;
  process: ChildProcessWithoutNullStreams;
  state: "connecting" | "awaiting_mfa" | "connected" | "disconnected" | "error";
  createdAt: Date;
  lastActivity: Date;
  emitter: EventEmitter;
  usingCertificateAuth?: boolean; // If true, skip MFA detection (cert auth doesn't need MFA)
}

export interface PowerShellCredentials {
  username: string;
  encryptedPassword: string;
}

/**
 * PowerShell Session Manager
 * Manages interactive PowerShell sessions with MFA support
 */
export class PowerShellSessionManager {
  private sessions: Map<string, PowerShellSession> = new Map();
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up idle sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new interactive PowerShell session
   */
  async createSession(
    tenantId: string,
    operatorEmail: string,
    credentials: PowerShellCredentials
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const emitter = new EventEmitter();

    // Decrypt the password
    const decryptedPassword = decrypt(credentials.encryptedPassword);

    // Create the PowerShell process in INTERACTIVE mode
    // This allows MFA prompts to appear
    const pwsh = spawn("powershell", [
      "-NoProfile",
      "-NoLogo",
      "-ExecutionPolicy", "Bypass",
      // Note: NOT using -NonInteractive to allow MFA prompts
    ], {
      stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
      env: {
        ...process.env,
        TERM: "dumb", // Prevent complex terminal codes
        POWERSHELL_TELEMETRY_OPTOUT: "1",
      }
    });

    const session: PowerShellSession = {
      id: sessionId,
      tenantId,
      operatorEmail,
      process: pwsh,
      state: "connecting",
      createdAt: new Date(),
      lastActivity: new Date(),
      emitter,
    };

    this.sessions.set(sessionId, session);

    // Set up output handlers
    this.setupOutputHandlers(session);

    // Set up error handlers
    this.setupErrorHandlers(session);

    // Initialize the PowerShell session with Teams connection
    this.initializeTeamsConnection(session, credentials.username, decryptedPassword);

    return sessionId;
  }

  /**
   * Create a new PowerShell session with certificate-based authentication
   * (No MFA required - uses app registration with certificate)
   */
  async createSessionWithCertificate(
    tenantId: string,
    operatorEmail: string,
    certCredentials: PowerShellCertificateCredentials
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const emitter = new EventEmitter();

    console.log(`[PowerShell Session] Creating certificate-based session for ${operatorEmail}`);
    console.log(`[PowerShell Session] Tenant ID: ${tenantId}`);
    console.log(`[PowerShell Session] Azure Tenant ID: ${certCredentials.tenantId}`);
    console.log(`[PowerShell Session] App ID: ${certCredentials.appId.substring(0, 8)}...`);
    console.log(`[PowerShell Session] Cert Thumbprint: ${certCredentials.certificateThumbprint.substring(0, 8)}...`);

    // Create the PowerShell process
    // Using -NonInteractive for certificate auth to prevent MFA prompts
    // Certificate-based authentication should never require interactive input
    const pwsh = spawn("powershell.exe", [
      "-NoProfile",
      "-NoLogo",
      "-NonInteractive", // Prevents interactive prompts (MFA, credentials, etc.)
      "-ExecutionPolicy", "Bypass",
    ], {
      stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr
      env: {
        ...process.env,
        TERM: "dumb", // Prevent complex terminal codes
        POWERSHELL_TELEMETRY_OPTOUT: "1",
      }
    });

    console.log(`[PowerShell Session ${sessionId}] PowerShell process spawned`);

    const session: PowerShellSession = {
      id: sessionId,
      tenantId,
      operatorEmail,
      process: pwsh,
      state: "connecting",
      createdAt: new Date(),
      lastActivity: new Date(),
      emitter,
      usingCertificateAuth: true, // Certificate auth - no MFA needed
    };

    this.sessions.set(sessionId, session);

    // Set up output handlers
    this.setupOutputHandlers(session);

    // Set up error handlers
    this.setupErrorHandlers(session);

    // Initialize the PowerShell session with certificate-based Teams connection
    console.log(`[PowerShell Session ${sessionId}] Initializing Teams connection with certificate`);
    this.initializeTeamsConnectionWithCertificate(session, certCredentials);

    return sessionId;
  }

  /**
   * Setup handlers for PowerShell output
   */
  private setupOutputHandlers(session: PowerShellSession): void {
    let jsonBuffer = "";
    let capturingJson = false;

    session.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      session.lastActivity = new Date();

      // Check for JSON markers for structured data
      if (output.includes("POLICIES_JSON_START")) {
        console.log(`[PowerShell Session ${session.id}] Starting JSON capture`);
        capturingJson = true;
        jsonBuffer = "";

        // Check if the START and data are in the same chunk
        const startIndex = output.indexOf("POLICIES_JSON_START");
        const afterStart = output.substring(startIndex + "POLICIES_JSON_START".length);

        // If there's content after the start marker in this chunk, add it
        if (afterStart.trim()) {
          jsonBuffer += afterStart;
        }
        return;
      }

      if (capturingJson) {
        if (output.includes("POLICIES_JSON_END")) {
          capturingJson = false;

          // Extract only the part before the END marker
          const endIndex = output.indexOf("POLICIES_JSON_END");
          if (endIndex > 0) {
            jsonBuffer += output.substring(0, endIndex);
          }

          console.log(`[PowerShell Session ${session.id}] Raw JSON buffer length: ${jsonBuffer.length}`);
          console.log(`[PowerShell Session ${session.id}] Raw JSON buffer (first 200 chars): ${jsonBuffer.substring(0, 200)}`);

          // Clean the JSON buffer
          // Remove PowerShell prompts (PS C:\..., PS >, etc.)
          let cleanedJson = jsonBuffer
            .replace(/PS\s+[A-Z]:[^\r\n]*/g, '') // Remove PS C:\... prompts
            .replace(/PS\s*>/g, '') // Remove PS > prompts
            .replace(/^\s*[\r\n]+/gm, '') // Remove empty lines
            .trim();

          console.log(`[PowerShell Session ${session.id}] Cleaned JSON length: ${cleanedJson.length}`);
          console.log(`[PowerShell Session ${session.id}] Cleaned JSON (first 200 chars): ${cleanedJson.substring(0, 200)}`);

          // Parse and emit policies
          try {
            const policies = JSON.parse(cleanedJson);
            console.log(`[PowerShell Session ${session.id}] Successfully parsed policies JSON`);

            // Ensure it's an array
            const policiesArray = Array.isArray(policies) ? policies : [policies];

            // Transform to match expected format
            const formattedPolicies = policiesArray.map((p: any) => ({
              id: p.Identity || "",
              name: p.Identity?.replace("Tag:", "") || "",
              description: p.Description || "",
              pstnUsages: p.OnlinePstnUsages || []
            }));

            console.log(`[PowerShell Session ${session.id}] Formatted ${formattedPolicies.length} policies`);
            session.emitter.emit("policies_retrieved", { policies: formattedPolicies });
            session.emitter.emit("output", { output: `Retrieved ${formattedPolicies.length} voice routing policies` });
          } catch (err) {
            console.error(`[PowerShell Session ${session.id}] Failed to parse policies JSON:`, err);
            console.error(`[PowerShell Session ${session.id}] Failed JSON content:`, cleanedJson.substring(0, 500));
            session.emitter.emit("error", { error: `Failed to parse policies: ${err instanceof Error ? err.message : String(err)}` });
          }
          jsonBuffer = "";
          return;
        } else {
          jsonBuffer += output;
          return;
        }
      }

      // Detect MFA prompt (for legacy user account auth only - skip for certificate auth)
      if (!session.usingCertificateAuth && this.isMfaPrompt(output)) {
        session.state = "awaiting_mfa";
        session.emitter.emit("mfa_required", { output });
      } else if (
        output.includes("Account Id") ||
        output.includes("TenantId") ||
        output.includes("Successfully connected to:") ||
        output.includes("Teams PowerShell session ready")
      ) {
        // Successfully connected
        session.state = "connected";
        session.emitter.emit("connected", { output });
      } else {
        session.emitter.emit("output", { output });
      }
    });

    session.process.stderr.on("data", (data: Buffer) => {
      const error = data.toString();
      session.lastActivity = new Date();

      // Some "errors" are actually just warnings or info messages
      session.emitter.emit("error", { error });
    });
  }

  /**
   * Setup handlers for PowerShell process errors
   */
  private setupErrorHandlers(session: PowerShellSession): void {
    session.process.on("error", (error: Error) => {
      console.error(`[PowerShell Session ${session.id}] Process error:`, error);
      session.state = "error";
      session.emitter.emit("process_error", {
        error: `PowerShell process error: ${error.message}`
      });
    });

    session.process.on("close", (code: number | null) => {
      console.log(`[PowerShell Session ${session.id}] Process closed with code ${code}`);
      session.state = "disconnected";
      session.emitter.emit("disconnected", {
        code,
        message: `PowerShell process exited with code ${code}`
      });
      this.sessions.delete(session.id);
    });
  }

  /**
   * Initialize Teams PowerShell connection
   */
  private initializeTeamsConnection(
    session: PowerShellSession,
    username: string,
    password: string
  ): void {
    // Send PowerShell commands to connect to Teams
    const commands = `
# Import MicrosoftTeams module
Import-Module MicrosoftTeams -ErrorAction Stop

# Create credential object
$username = "${username.replace(/"/g, '`"')}"
$password = ConvertTo-SecureString "${password.replace(/"/g, '`"')}" -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($username, $password)

# Connect to Microsoft Teams (this will prompt for MFA if enabled)
Connect-MicrosoftTeams -Credential $credential

# Display connection status
Get-CsTenant | Select-Object TenantId, DisplayName

Write-Host "Teams PowerShell session ready. Type commands or 'exit' to quit."
`;

    this.sendCommand(session.id, commands);
  }

  /**
   * Initialize Teams connection using certificate-based authentication
   */
  private initializeTeamsConnectionWithCertificate(
    session: PowerShellSession,
    credentials: PowerShellCertificateCredentials
  ): void {
    // Send PowerShell commands to connect to Teams with certificate auth
    const commands = `
# Import MicrosoftTeams module
Import-Module MicrosoftTeams -ErrorAction Stop

# Connect to Microsoft Teams using certificate authentication
Connect-MicrosoftTeams -ApplicationId "${credentials.appId}" -CertificateThumbprint "${credentials.certificateThumbprint}" -TenantId "${credentials.tenantId}" -ErrorAction Stop | Out-Null

# Display connection status
$tenant = Get-CsTenant
Write-Host "Successfully connected to: $($tenant.DisplayName)"
Write-Host "Tenant ID: $($tenant.TenantId)"
Write-Host ""
Write-Host "Teams PowerShell session ready. Type commands or 'exit' to quit."
`;

    this.sendCommand(session.id, commands);
  }

  /**
   * Detect if output contains an MFA prompt
   */
  private isMfaPrompt(output: string): boolean {
    const mfaPatterns = [
      /enter.*code/i,
      /verification.*code/i,
      /authentication.*code/i,
      /mfa/i,
      /two.*factor/i,
      /\d{6}/i, // Looking for 6-digit code mention
    ];

    return mfaPatterns.some(pattern => pattern.test(output));
  }

  /**
   * Send a command to the PowerShell session
   */
  sendCommand(sessionId: string, command: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === "disconnected") {
      return false;
    }

    try {
      // Send the entire command at once with newline
      session.process.stdin.write(command.trim() + "\r\n");
      session.lastActivity = new Date();
      return true;
    } catch (error) {
      session.emitter.emit("error", {
        error: `Failed to send command: ${error instanceof Error ? error.message : String(error)}`
      });
      return false;
    }
  }

  /**
   * Send MFA code to the PowerShell session
   */
  sendMfaCode(sessionId: string, code: string): boolean {
    return this.sendCommand(sessionId, code);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): PowerShellSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Close a PowerShell session
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      // Send exit command
      session.process.stdin.write("exit\n");

      // Give it a moment to exit gracefully
      setTimeout(() => {
        if (session.process.exitCode === null) {
          session.process.kill("SIGTERM");
        }
      }, 2000);

      this.sessions.delete(sessionId);
      return true;
    } catch (error) {
      // Force kill if graceful exit fails
      session.process.kill("SIGKILL");
      this.sessions.delete(sessionId);
      return true;
    }
  }

  /**
   * Clean up idle sessions
   */
  private cleanupIdleSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      if (idleTime > this.SESSION_TIMEOUT_MS) {
        console.log(`Cleaning up idle session ${sessionId} (idle for ${idleTime}ms)`);
        this.closeSession(sessionId);
      }
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `ps-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get all active sessions for an operator
   */
  getOperatorSessions(operatorEmail: string): PowerShellSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.operatorEmail === operatorEmail);
  }

  /**
   * Execute a Teams PowerShell command
   * Useful for common operations like getting phone numbers, policies, etc.
   */
  executeTeamsCommand(sessionId: string, command: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== "connected") {
      return false;
    }

    // Send the command
    return this.sendCommand(sessionId, command);
  }

  /**
   * Get phone number assignments for a user
   */
  getPhoneNumberAssignment(sessionId: string, userPrincipalName?: string): boolean {
    const command = userPrincipalName
      ? `Get-CsPhoneNumberAssignment -AssignedPstnTargetId "${userPrincipalName}" | Format-List`
      : `Get-CsPhoneNumberAssignment | Format-List`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Get all voice routing policies
   */
  getVoiceRoutingPolicies(sessionId: string): boolean {
    // Get policies and output as JSON for parsing
    const command = `
$policies = Get-CsOnlineVoiceRoutingPolicy | Select-Object Identity, Description, OnlinePstnUsages
Write-Host "POLICIES_JSON_START"
$policies | ConvertTo-Json -Depth 3
Write-Host "POLICIES_JSON_END"
`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Assign a phone number to a user
   */
  assignPhoneNumber(
    sessionId: string,
    userPrincipalName: string,
    phoneNumber: string,
    locationId?: string
  ): boolean {
    let command = `Set-CsPhoneNumberAssignment -Identity "${userPrincipalName}" -PhoneNumber "${phoneNumber}" -PhoneNumberType DirectRouting`;

    if (locationId) {
      command += ` -LocationId "${locationId}"`;
    }

    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Assign a voice routing policy to a user
   */
  assignVoiceRoutingPolicy(
    sessionId: string,
    userPrincipalName: string,
    policyName: string
  ): boolean {
    // Remove "Tag:" prefix if present (PowerShell cmdlet doesn't need it)
    const cleanPolicyName = policyName.replace(/^Tag:/i, "");

    const command = `Grant-CsOnlineVoiceRoutingPolicy -Identity "${userPrincipalName}" -PolicyName "${cleanPolicyName}"`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Get all policies for a specific policy type (generic method)
   */
  getTeamsPolicies(sessionId: string, policyType: PolicyType): boolean {
    const config = policyTypeConfig[policyType];

    // Build command based on whether the policy type supports descriptions
    const selectProperties = config.supportsDescription
      ? "Identity, Description"
      : "Identity";

    const command = `
$policies = ${config.powerShellCmdGet} | Select-Object ${selectProperties}
Write-Host "POLICIES_JSON_START"
$policies | ConvertTo-Json -Depth 3
Write-Host "POLICIES_JSON_END"
`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Assign a policy of any type to a user (generic method)
   */
  assignTeamsPolicy(
    sessionId: string,
    userPrincipalName: string,
    policyType: PolicyType,
    policyName: string
  ): boolean {
    const config = policyTypeConfig[policyType];

    // Remove "Tag:" prefix if present (PowerShell cmdlet doesn't need it)
    const cleanPolicyName = policyName.replace(/^Tag:/i, "");

    const command = `${config.powerShellCmdGrant} -Identity "${userPrincipalName}" -PolicyName "${cleanPolicyName}"`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Get the current policy assigned to a user for a specific policy type
   */
  getUserPolicy(
    sessionId: string,
    userPrincipalName: string,
    policyType: PolicyType
  ): boolean {
    const config = policyTypeConfig[policyType];

    const command = `Get-CsOnlineUser -Identity "${userPrincipalName}" | Select-Object ${config.userPropertyName}`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Assign both phone number and voice routing policy to a user
   */
  assignPhoneNumberAndPolicy(
    sessionId: string,
    userPrincipalName: string,
    phoneNumber: string,
    policyName: string,
    locationId?: string,
    uniqueMarker?: string
  ): boolean {
    // Remove "Tag:" prefix from policy name if present
    const cleanPolicyName = policyName.replace(/^Tag:/i, "");

    // Remove "tel:" prefix from phone number if present (PowerShell expects E.164 format)
    const cleanPhoneNumber = phoneNumber.replace(/^tel:/i, "");

    // Generate a unique marker for this assignment if not provided
    const marker = uniqueMarker || `ASSIGN_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build phone command
    let phoneCommand = `Set-CsPhoneNumberAssignment -Identity '${userPrincipalName}' -PhoneNumber '${cleanPhoneNumber}' -PhoneNumberType DirectRouting`;
    if (locationId) {
      phoneCommand += ` -LocationId '${locationId}'`;
    }

    // Build policy command
    const policyCommand = `Grant-CsOnlineVoiceRoutingPolicy -Identity '${userPrincipalName}' -PolicyName '${cleanPolicyName}'`;

    // Create a cleaner script that captures errors properly
    // NOTE: We don't use 'exit' because it kills the output buffer before error messages are flushed
    // Instead, we track success/failure with markers and let the script complete
    // Use unique marker to prevent confusion between multiple assignments
    const combinedCommand = `
Write-Host "MARKER_START:${marker}"
Write-Host "=== Starting Assignment ==="
Write-Host "User: ${userPrincipalName}"
Write-Host "Phone: ${cleanPhoneNumber}"
Write-Host "Policy: ${cleanPolicyName}"
Write-Host ""

$phoneSuccess = $false
$policySuccess = $false
$errorMessage = ""

try {
  ${phoneCommand} -ErrorAction Stop | Out-Null
  Write-Host "SUCCESS_PHONE:${marker}"
  $phoneSuccess = $true
} catch {
  $errorMessage = $_.Exception.Message
  Write-Host "ERROR_PHONE:${marker}: $errorMessage"
  if ($_.ErrorDetails) {
    Write-Host "ERROR_PHONE_DETAILS:${marker}: $($_.ErrorDetails.Message)"
  }
  $phoneSuccess = $false
}

if ($phoneSuccess) {
  try {
    ${policyCommand} -ErrorAction Stop | Out-Null
    Write-Host "SUCCESS_POLICY:${marker}"
    $policySuccess = $true
  } catch {
    $errorMessage = $_.Exception.Message
    Write-Host "ERROR_POLICY:${marker}: $errorMessage"
    if ($_.ErrorDetails) {
      Write-Host "ERROR_POLICY_DETAILS:${marker}: $($_.ErrorDetails.Message)"
    }
    $policySuccess = $false
  }
}

Write-Host ""
if ($phoneSuccess -and $policySuccess) {
  Write-Host "RESULT_SUCCESS:${marker}"
} else {
  Write-Host "RESULT_FAILED:${marker}"
  if (-not $phoneSuccess) {
    Write-Host "FAILURE_REASON:${marker}: Phone assignment failed"
  } elseif (-not $policySuccess) {
    Write-Host "FAILURE_REASON:${marker}: Policy assignment failed"
  }
}
Write-Host "MARKER_END:${marker}"
`;

    return this.executeTeamsCommand(sessionId, combinedCommand);
  }

  /**
   * Get user details from Teams
   */
  getTeamsUser(sessionId: string, userPrincipalName: string): boolean {
    const command = `Get-CsOnlineUser -Identity "${userPrincipalName}" | Select-Object DisplayName, UserPrincipalName, LineURI, OnlineVoiceRoutingPolicy, EnterpriseVoiceEnabled | Format-List`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Get all Teams users with voice enabled
   */
  getTeamsVoiceUsers(sessionId: string): boolean {
    const command = `Get-CsOnlineUser -Filter {EnterpriseVoiceEnabled -eq $true} | Select-Object DisplayName, UserPrincipalName, LineURI | Format-Table -AutoSize`;
    return this.executeTeamsCommand(sessionId, command);
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
  }
}

// Export a singleton instance
export const powershellSessionManager = new PowerShellSessionManager();
