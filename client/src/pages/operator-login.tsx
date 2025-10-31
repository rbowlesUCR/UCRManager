import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ExternalLink, AlertCircle } from "lucide-react";

export default function OperatorLogin() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Redirect to Azure AD OAuth flow
    window.location.href = "/api/auth/login";
  };

  const handleTestConnection = () => {
    // Show diagnostics and open in a new window to test if Microsoft login is accessible
    setShowDiagnostics(true);
    window.open("/api/auth/login", "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Teams Voice Manager</CardTitle>
            <CardDescription>
              Sign in with your operator account to manage Teams voice configurations
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showDiagnostics && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <p className="font-semibold mb-2">Connection Issue Detected</p>
                <p className="mb-2">If you're seeing "refused to connect" errors:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Try opening this app in a new browser tab (not Replit's preview)</li>
                  <li>Disable browser extensions (ad blockers, privacy tools)</li>
                  <li>Check if your network blocks Microsoft login</li>
                  <li>Try a different browser or network</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleLogin} 
            className="w-full h-11"
            disabled={isLoading}
            data-testid="button-operator-login"
          >
            {isLoading ? "Signing in..." : "Sign in with Microsoft"}
          </Button>

          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              className="w-full h-11"
              data-testid="button-test-connection"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Test Login in New Tab
            </Button>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => setLocation("/admin/login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-elevate"
              data-testid="link-admin-login"
            >
              Admin Access
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
