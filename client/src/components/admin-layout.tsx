import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, FileText, Settings, ClipboardList, Building, Shield, ToggleLeft, Home } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout", {});
    setLocation("/");
  };

  const navItems = [
    {
      path: "/admin/audit-logs",
      label: "Audit Logs",
      icon: ClipboardList,
      testId: "nav-audit-logs",
    },
    {
      path: "/admin/customer-tenants",
      label: "Customer Tenants",
      icon: Building,
      testId: "nav-customer-tenants",
    },
    {
      path: "/admin/operator-users",
      label: "Operator Users",
      icon: Shield,
      testId: "nav-operator-users",
    },
    {
      path: "/admin/features",
      label: "Features",
      icon: ToggleLeft,
      testId: "nav-features",
    },
    {
      path: "/admin/documentation",
      label: "Documentation",
      icon: FileText,
      testId: "nav-documentation",
    },
    {
      path: "/admin/settings",
      label: "Settings",
      icon: Settings,
      testId: "nav-settings",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
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
              <div>
                <h1 className="text-lg font-semibold">Teams Voice Manager</h1>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Button
                    key={item.path}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLocation(item.path)}
                    className={cn("gap-2", !isActive && "text-muted-foreground")}
                    data-testid={item.testId}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/dashboard")}
              className="h-9"
              data-testid="button-main-dashboard"
            >
              <Home className="w-4 h-4 mr-2" />
              Main Dashboard
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="h-9"
              data-testid="button-admin-logout"
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
