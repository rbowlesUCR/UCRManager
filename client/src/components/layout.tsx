import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, User, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { OperatorSession } from "@shared/schema";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [, setLocation] = useLocation();

  const { data: session } = useQuery<OperatorSession>({
    queryKey: ["/api/auth/session"],
  });

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout", {});
    setLocation("/");
  };

  // Check if user has admin role (either local admin or operator user with admin role)
  const isAdmin = session?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary-foreground"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <h1 className="text-lg font-semibold">Teams Voice Manager</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {session && (
              <>
                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium" data-testid="text-operator-name">
                      {session.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid="text-operator-email">
                      {session.email}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <Link href="/admin/audit-logs">
                    <Button
                      variant="outline"
                      className="h-11"
                      data-testid="button-admin-panel"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
                  </Link>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={handleLogout}
              className="h-11"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
