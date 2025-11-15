import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function OperatorLogin() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Redirect to Azure AD OAuth flow
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">UCRManager</CardTitle>
            <CardDescription>
              Sign in with your operator account to manage Teams voice configurations
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleLogin}
            className="w-full h-11"
            disabled={isLoading}
            data-testid="button-operator-login"
          >
            {isLoading ? "Signing in..." : "Sign in with Microsoft"}
          </Button>

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
