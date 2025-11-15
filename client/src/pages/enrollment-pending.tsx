import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Mail, CheckCircle2 } from "lucide-react";

export default function EnrollmentPending() {
  const [, setLocation] = useLocation();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    // Fetch current session to get user email
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const session = await response.json();
          setUserEmail(session.email);

          // If user is now active, redirect to dashboard
          if (session.role !== "pending" && session.isActive) {
            setLocation("/dashboard");
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      }
    };

    fetchSession();

    // Check every 30 seconds if user has been activated
    const interval = setInterval(fetchSession, 30000);
    return () => clearInterval(interval);
  }, [setLocation]);

  const handleLogout = () => {
    // Clear the cookie by calling logout endpoint
    document.cookie = "operatorToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Enrollment Pending</CardTitle>
            <CardDescription className="text-base">
              You have been successfully enrolled in UCRManager
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Account Created</p>
                <p className="text-sm text-muted-foreground">
                  Your account has been registered with the email: <strong>{userEmail || "Loading..."}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Awaiting Admin Approval</p>
                <p className="text-sm text-muted-foreground">
                  Your account is pending activation by a UCRManager administrator. Please contact an existing admin to request access.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>An administrator will review your enrollment request</li>
                <li>Once approved, you'll be granted access to the system</li>
                <li>You'll receive access based on the role assigned by the administrator</li>
                <li>This page will automatically redirect once you're activated</li>
              </ol>
            </div>

            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
              <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">Need Help?</p>
              <p className="text-blue-800 dark:text-blue-400">
                Contact your organization's UCRManager administrator to expedite your access request.
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="hover-elevate"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
