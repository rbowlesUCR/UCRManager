import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

export interface VoiceRoutingPolicy {
  id: string;
  name: string;
  description?: string;
  pstnUsages?: string[];
}

export interface PowerShellMessage {
  type: "connected" | "output" | "error" | "mfa_required" | "session_created" | "session_closed" | "disconnected" | "info" | "process_error" | "policies_retrieved";
  sessionId?: string;
  output?: string;
  error?: string;
  message?: string;
  state?: "connecting" | "awaiting_mfa" | "connected" | "disconnected" | "error";
  code?: number;
  policies?: VoiceRoutingPolicy[];
}

export interface PowerShellSessionOptions {
  tenantId: string;
  onMessage?: (message: PowerShellMessage) => void;
  onMfaRequired?: (message: PowerShellMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onPoliciesRetrieved?: (policies: VoiceRoutingPolicy[]) => void;
}

export function usePowerShellSession(options: PowerShellSessionOptions) {
  const { tenantId, onMessage, onMfaRequired, onConnected, onDisconnected, onError, onPoliciesRetrieved } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<string>("disconnected");
  const [messages, setMessages] = useState<PowerShellMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get JWT token for WebSocket authentication
  const { data: sessionData } = useQuery({
    queryKey: ["/api/auth/session"],
    retry: false,
  });

  // Fetch JWT token from server for WebSocket authentication
  const getJwtToken = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch("/api/auth/ws-token", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get WebSocket token");
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error("Error fetching WebSocket token:", error);
      throw error;
    }
  }, []);

  const addMessage = useCallback((msg: PowerShellMessage) => {
    setMessages(prev => [...prev, msg]);
    onMessage?.(msg);
  }, [onMessage]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) {
      console.log("Already connecting or connected");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      console.log("Fetching PowerShell credentials...");

      // Get credentials from API
      const response = await fetch(`/api/tenant/${tenantId}/powershell-credentials`, {
        credentials: "include",
      });

      console.log("Credentials response status:", response.status);

      if (!response.ok) {
        throw new Error("Failed to fetch PowerShell credentials. Please ensure credentials are configured for this tenant.");
      }

      const credentials = await response.json();
      console.log("Credentials fetched successfully");

      // Get WebSocket authentication token
      console.log("Fetching WebSocket token...");
      const token = await getJwtToken();
      console.log("Token fetched successfully");

      // Determine WebSocket protocol based on page protocol
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;

      console.log("Creating WebSocket connection...");
      const ws = new WebSocket(`${protocol}//${host}/ws/powershell?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected successfully");
        setIsConnected(true);
        setIsConnecting(false);

        // Create PowerShell session
        ws.send(JSON.stringify({
          type: "create_session",
          tenantId,
          credentials,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg: PowerShellMessage = JSON.parse(event.data);
          console.log("WebSocket message:", msg);

          addMessage(msg);

          switch (msg.type) {
            case "session_created":
              setSessionId(msg.sessionId || null);
              setSessionState(msg.state || "connecting");
              break;

            case "output":
              setSessionState(msg.state || sessionState);
              break;

            case "mfa_required":
              setSessionState("awaiting_mfa");
              onMfaRequired?.(msg);
              break;

            case "connected":
              setSessionState("connected");
              onConnected?.();
              break;

            case "disconnected":
            case "session_closed":
              setSessionState("disconnected");
              setSessionId(null);
              onDisconnected?.();
              break;

            case "error":
            case "process_error":
              setError(msg.error || msg.message || "Unknown error");
              onError?.(msg.error || msg.message || "Unknown error");
              break;

            case "policies_retrieved":
              if (msg.policies) {
                onPoliciesRetrieved?.(msg.policies);
              }
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket connection error");
        setIsConnecting(false);
        onError?.("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        setIsConnecting(false);
        setSessionId(null);
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds if it was unexpected
        if (sessionState !== "disconnected") {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
          }, 5000);
        }
      };

    } catch (err) {
      console.error("PowerShell connection error:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to connect";
      setError(errorMsg);
      setIsConnecting(false);
      onError?.(errorMsg);
    }
  }, [tenantId, isConnecting, isConnected, sessionState, addMessage, onMfaRequired, onConnected, onDisconnected, onError, getJwtToken]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "close_session" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setSessionId(null);
    setSessionState("disconnected");
  }, []);

  const sendCommand = useCallback((command: string) => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "send_command",
      command,
    }));

    return true;
  }, [isConnected]);

  const sendMfaCode = useCallback((code: string) => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "send_mfa_code",
      code,
    }));

    return true;
  }, [isConnected]);

  const getPhoneNumbers = useCallback((userPrincipalName?: string) => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "get_phone_numbers",
      userPrincipalName,
    }));

    return true;
  }, [isConnected]);

  const getPolicies = useCallback(() => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "get_policies",
    }));

    return true;
  }, [isConnected]);

  const assignPhoneNumber = useCallback((
    userPrincipalName: string,
    phoneNumber: string,
    locationId?: string
  ) => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "assign_phone_number",
      userPrincipalName,
      phoneNumber,
      locationId,
    }));

    return true;
  }, [isConnected]);

  const getTeamsUser = useCallback((userPrincipalName: string) => {
    if (!wsRef.current || !isConnected) {
      console.error("WebSocket not connected");
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: "get_teams_user",
      userPrincipalName,
    }));

    return true;
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    sessionId,
    sessionState,
    messages,
    error,
    connect,
    disconnect,
    sendCommand,
    sendMfaCode,
    getPhoneNumbers,
    getPolicies,
    assignPhoneNumber,
    getTeamsUser,
  };
}
