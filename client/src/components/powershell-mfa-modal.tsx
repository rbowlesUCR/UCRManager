import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, Phone, FileText, Users as UsersIcon } from "lucide-react";
import { usePowerShellSession, type PowerShellMessage, type VoiceRoutingPolicy } from "@/hooks/use-powershell-session";

interface PowerShellMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  onSuccess?: () => void;
  onPoliciesRetrieved?: (policies: VoiceRoutingPolicy[]) => void;
}

export function PowerShellMfaModal({ isOpen, onClose, tenantId, tenantName, onSuccess, onPoliciesRetrieved }: PowerShellMfaModalProps) {
  const [mfaCode, setMfaCode] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isConnecting,
    sessionState,
    messages,
    error,
    connect,
    disconnect,
    sendMfaCode,
    getPhoneNumbers,
    getPolicies,
    getTeamsUser,
    assignPhoneNumber,
  } = usePowerShellSession({
    tenantId,
    onMessage: (msg: PowerShellMessage) => {
      // Add message to output display
      if (msg.output) {
        setOutput(prev => [...prev, msg.output || ""]);
      }
      if (msg.error) {
        setOutput(prev => [...prev, `ERROR: ${msg.error}`]);
      }
      if (msg.message) {
        setOutput(prev => [...prev, msg.message || ""]);
      }
    },
    onMfaRequired: (msg: PowerShellMessage) => {
      setOutput(prev => [...prev, "⚠️ MFA Required: Please enter your 6-digit verification code"]);
    },
    onConnected: () => {
      setOutput(prev => [...prev, "✓ Connected to Microsoft Teams PowerShell"]);
      onSuccess?.();
    },
    onDisconnected: () => {
      setOutput(prev => [...prev, "✗ Disconnected from PowerShell session"]);
    },
    onError: (errorMsg: string) => {
      setOutput(prev => [...prev, `✗ Error: ${errorMsg}`]);
    },
    onPoliciesRetrieved: (policies) => {
      setOutput(prev => [...prev, `✓ Retrieved ${policies.length} voice routing policies`]);
      onPoliciesRetrieved?.(policies);
    },
  });

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  // Connect when modal opens
  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      setOutput(["Initializing PowerShell session..."]);
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen && isConnected) {
      disconnect();
      setOutput([]);
      setMfaCode("");
    }
  }, [isOpen, isConnected, disconnect]);

  const handleSubmitMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length === 6 && /^\d{6}$/.test(mfaCode)) {
      sendMfaCode(mfaCode);
      setOutput(prev => [...prev, `> Submitting MFA code: ${mfaCode}`]);
      setMfaCode("");
    }
  };

  const handleClose = () => {
    disconnect();
    onClose();
  };

  const getStatusColor = () => {
    switch (sessionState) {
      case "connected":
        return "text-green-600";
      case "awaiting_mfa":
        return "text-yellow-600";
      case "connecting":
        return "text-blue-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = () => {
    switch (sessionState) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4" />;
      case "awaiting_mfa":
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>PowerShell Session - {tenantName}</DialogTitle>
          <DialogDescription>
            Connecting to Microsoft Teams PowerShell. You will be prompted for MFA verification.
          </DialogDescription>
        </DialogHeader>

        {/* Status Bar */}
        <div className={`flex items-center gap-2 p-3 rounded-lg bg-muted ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="font-medium capitalize">
            {sessionState === "awaiting_mfa" ? "Awaiting MFA" : sessionState}
          </span>
          {isConnecting && <span className="text-sm">(Establishing connection...)</span>}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Output Console */}
        <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto bg-black text-green-400 font-mono text-sm p-4 rounded-lg">
          {output.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap break-words">
              {line}
            </div>
          ))}
          <div ref={outputEndRef} />
        </div>

        {/* Quick Actions */}
        {sessionState === "connected" && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium text-muted-foreground mr-2 self-center">Quick Actions:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => getPhoneNumbers()}
              disabled={!isConnected}
            >
              <Phone className="h-3 w-3 mr-1" />
              Get Phone Numbers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => getPolicies()}
              disabled={!isConnected}
            >
              <FileText className="h-3 w-3 mr-1" />
              Get Policies
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const upn = prompt("Enter User Principal Name (e.g., user@domain.com):");
                if (upn) getTeamsUser(upn);
              }}
              disabled={!isConnected}
            >
              <UsersIcon className="h-3 w-3 mr-1" />
              Get User Info
            </Button>
          </div>
        )}

        {/* MFA Input Form */}
        {sessionState === "awaiting_mfa" && (
          <form onSubmit={handleSubmitMfa} className="space-y-4 p-4 border rounded-lg bg-yellow-50">
            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-base font-semibold">
                Enter 6-Digit MFA Code
              </Label>
              <div className="flex gap-2">
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className="text-2xl text-center tracking-widest font-mono"
                  autoFocus
                  required
                />
                <Button
                  type="submit"
                  disabled={mfaCode.length !== 6}
                  className="min-w-[100px]"
                >
                  Submit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Check your authenticator app or SMS for the verification code.
              </p>
            </div>
          </form>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          {sessionState === "connected" && (
            <Button variant="outline" onClick={handleClose}>
              Close Session
            </Button>
          )}
          {sessionState === "error" && (
            <Button variant="outline" onClick={() => connect()}>
              Retry Connection
            </Button>
          )}
          {(sessionState === "disconnected" || sessionState === "error") && (
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
