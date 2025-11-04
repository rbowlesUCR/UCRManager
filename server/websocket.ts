import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { powershellSessionManager } from "./powershell-session";
import { verifyJWT } from "./auth";
import { parse as parseUrl } from "url";
import { parse as parseQuery } from "querystring";

export interface WebSocketClient {
  ws: WebSocket;
  operatorEmail: string;
  sessionId?: string;
}

/**
 * Setup WebSocket server for PowerShell sessions
 */
export function setupWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true, // We'll handle upgrade manually
    path: "/ws/powershell"
  });

  // Handle HTTP upgrade to WebSocket
  server.on("upgrade", async (request: IncomingMessage, socket, head) => {
    const { pathname, query } = parseUrl(request.url || "", true);

    console.log(`WebSocket upgrade request: ${pathname}`);

    if (pathname !== "/ws/powershell") {
      console.log(`Rejecting upgrade for non-PowerShell path: ${pathname}`);
      socket.destroy();
      return;
    }

    try {
      // Verify JWT token from query parameter
      const token = query.token as string;
      console.log(`WebSocket token present: ${!!token}`);

      if (!token) {
        console.log("WebSocket upgrade rejected: No token provided");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const payload = verifyJWT(token);
      console.log(`JWT verification result: ${!!payload}, email: ${payload?.email}`);

      if (!payload || !payload.email) {
        console.log("WebSocket upgrade rejected: Invalid token or missing email");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      console.log(`Upgrading WebSocket connection for: ${payload.email}`);

      // Upgrade the connection
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, payload.email);
      });
    } catch (error) {
      console.error("WebSocket upgrade error:", error);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket, request: IncomingMessage, operatorEmail: string) => {
    console.log(`WebSocket connected: ${operatorEmail}`);

    const client: WebSocketClient = {
      ws,
      operatorEmail,
    };

    // Send welcome message
    sendMessage(ws, {
      type: "connected",
      message: "WebSocket connection established"
    });

    // Handle incoming messages from the client
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(client, message);
      } catch (error) {
        sendMessage(ws, {
          type: "error",
          error: `Failed to process message: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    // Handle WebSocket close
    ws.on("close", () => {
      console.log(`WebSocket disconnected: ${operatorEmail}`);

      // Clean up any PowerShell sessions for this client
      if (client.sessionId) {
        powershellSessionManager.closeSession(client.sessionId);
      }
    });

    // Handle WebSocket errors
    ws.on("error", (error) => {
      console.error(`WebSocket error for ${operatorEmail}:`, error);
    });
  });

  return wss;
}

/**
 * Handle messages from the client
 */
async function handleClientMessage(client: WebSocketClient, message: any): Promise<void> {
  const { type, ...data } = message;

  switch (type) {
    case "create_session":
      await handleCreateSession(client, data);
      break;

    case "send_command":
      handleSendCommand(client, data);
      break;

    case "send_mfa_code":
      handleSendMfaCode(client, data);
      break;

    case "get_phone_numbers":
      handleGetPhoneNumbers(client, data);
      break;

    case "get_policies":
      handleGetPolicies(client);
      break;

    case "assign_phone_number":
      handleAssignPhoneNumber(client, data);
      break;

    case "get_teams_user":
      handleGetTeamsUser(client, data);
      break;

    case "close_session":
      handleCloseSession(client);
      break;

    default:
      sendMessage(client.ws, {
        type: "error",
        error: `Unknown message type: ${type}`
      });
  }
}

/**
 * Handle creating a new PowerShell session
 */
async function handleCreateSession(
  client: WebSocketClient,
  data: {
    tenantId: string;
    credentials: {
      authType?: string;
      tenantId?: string;
      appId?: string;
      certificateThumbprint?: string;
      username?: string;
      encryptedPassword?: string;
    }
  }
): Promise<void> {
  try {
    const { tenantId, credentials } = data;

    // Create the session with certificate-based authentication
    const sessionId = await powershellSessionManager.createSessionWithCertificate(
      tenantId,
      client.operatorEmail,
      {
        tenantId: credentials.tenantId || '',
        appId: credentials.appId || '',
        certificateThumbprint: credentials.certificateThumbprint || ''
      }
    );

    client.sessionId = sessionId;

    // Get the session and setup event listeners
    const session = powershellSessionManager.getSession(sessionId);
    if (!session) {
      throw new Error("Failed to create session");
    }

    // Forward session events to the WebSocket client
    session.emitter.on("output", ({ output }) => {
      sendMessage(client.ws, {
        type: "output",
        output,
        state: session.state
      });
    });

    session.emitter.on("error", ({ error }) => {
      sendMessage(client.ws, {
        type: "error",
        error,
        state: session.state
      });
    });

    session.emitter.on("mfa_required", ({ output }) => {
      sendMessage(client.ws, {
        type: "mfa_required",
        output,
        message: "Please enter your MFA code",
        state: session.state
      });
    });

    session.emitter.on("connected", ({ output }) => {
      sendMessage(client.ws, {
        type: "connected",
        output,
        message: "Successfully connected to Microsoft Teams",
        state: session.state
      });
    });

    session.emitter.on("policies_retrieved", ({ policies }) => {
      sendMessage(client.ws, {
        type: "policies_retrieved",
        policies,
        message: `Retrieved ${policies.length} voice routing policies`
      });
    });

    session.emitter.on("disconnected", ({ code, message }) => {
      sendMessage(client.ws, {
        type: "disconnected",
        code,
        message
      });
      client.sessionId = undefined;
    });

    session.emitter.on("process_error", ({ error }) => {
      sendMessage(client.ws, {
        type: "process_error",
        error
      });
    });

    // Notify client that session was created
    sendMessage(client.ws, {
      type: "session_created",
      sessionId,
      state: session.state
    });

  } catch (error) {
    sendMessage(client.ws, {
      type: "error",
      error: `Failed to create session: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Handle sending a command to PowerShell
 */
function handleSendCommand(client: WebSocketClient, data: { command: string }): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const success = powershellSessionManager.sendCommand(client.sessionId, data.command);
  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to send command. Session may have closed."
    });
  }
}

/**
 * Handle sending MFA code to PowerShell
 */
function handleSendMfaCode(client: WebSocketClient, data: { code: string }): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const success = powershellSessionManager.sendMfaCode(client.sessionId, data.code);
  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to send MFA code. Session may have closed."
    });
  } else {
    sendMessage(client.ws, {
      type: "info",
      message: "MFA code submitted. Waiting for verification..."
    });
  }
}

/**
 * Handle getting phone number assignments
 */
function handleGetPhoneNumbers(
  client: WebSocketClient,
  data: { userPrincipalName?: string }
): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const success = powershellSessionManager.getPhoneNumberAssignment(
    client.sessionId,
    data.userPrincipalName
  );

  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to get phone numbers. Session may not be connected."
    });
  }
}

/**
 * Handle getting voice routing policies
 */
function handleGetPolicies(client: WebSocketClient): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const success = powershellSessionManager.getVoiceRoutingPolicies(client.sessionId);

  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to get policies. Session may not be connected."
    });
  }
}

/**
 * Handle assigning a phone number
 */
function handleAssignPhoneNumber(
  client: WebSocketClient,
  data: { userPrincipalName: string; phoneNumber: string; locationId?: string }
): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const { userPrincipalName, phoneNumber, locationId } = data;

  if (!userPrincipalName || !phoneNumber) {
    sendMessage(client.ws, {
      type: "error",
      error: "Missing required parameters: userPrincipalName and phoneNumber"
    });
    return;
  }

  const success = powershellSessionManager.assignPhoneNumber(
    client.sessionId,
    userPrincipalName,
    phoneNumber,
    locationId
  );

  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to assign phone number. Session may not be connected."
    });
  }
}

/**
 * Handle getting Teams user details
 */
function handleGetTeamsUser(
  client: WebSocketClient,
  data: { userPrincipalName: string }
): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  if (!data.userPrincipalName) {
    sendMessage(client.ws, {
      type: "error",
      error: "Missing required parameter: userPrincipalName"
    });
    return;
  }

  const success = powershellSessionManager.getTeamsUser(
    client.sessionId,
    data.userPrincipalName
  );

  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to get user details. Session may not be connected."
    });
  }
}

/**
 * Handle closing a PowerShell session
 */
function handleCloseSession(client: WebSocketClient): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "info",
      message: "No active session to close"
    });
    return;
  }

  const success = powershellSessionManager.closeSession(client.sessionId);
  client.sessionId = undefined;

  sendMessage(client.ws, {
    type: success ? "session_closed" : "error",
    message: success ? "Session closed successfully" : "Failed to close session"
  });
}

/**
 * Send a message to a WebSocket client
 */
function sendMessage(ws: WebSocket, message: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
