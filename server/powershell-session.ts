import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "events";
import { decrypt } from "./encryption";

export interface PowerShellSession {
  id: string;
  tenantId: string;
  operatorEmail: string;
  process: ChildProcessWithoutNullStreams;
  state: "connecting" | "awaiting_mfa" | "connected" | "disconnected" | "error";
  createdAt: Date;
  lastActivity: Date;
  emitter: EventEmitter;
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
    const pwsh = spawn("pwsh", [
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
   * Setup handlers for PowerShell output
   */
  private setupOutputHandlers(session: PowerShellSession): void {
    session.process.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      session.lastActivity = new Date();

      // Detect MFA prompt
      if (this.isMfaPrompt(output)) {
        session.state = "awaiting_mfa";
        session.emitter.emit("mfa_required", { output });
      } else if (output.includes("Account Id") || output.includes("TenantId")) {
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
      session.state = "error";
      session.emitter.emit("process_error", {
        error: `PowerShell process error: ${error.message}`
      });
    });

    session.process.on("close", (code: number | null) => {
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
      session.process.stdin.write(command + "\n");
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
