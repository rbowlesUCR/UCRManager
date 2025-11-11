import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import OperatorLogin from "@/pages/operator-login";
import AdminLogin from "@/pages/admin-login";
import Dashboard from "@/pages/dashboard";
import PolicyManagement from "@/pages/policy-management";
import NumberManagement from "@/pages/number-management";
import AdminAuditLogs from "@/pages/admin-audit-logs";
import AdminCustomerTenants from "@/pages/admin-customer-tenants";
import AdminDocumentation from "@/pages/admin-documentation";
import AdminSettings from "@/pages/admin-settings";
import AdminOperatorUsers from "@/pages/admin-operator-users";
import AdminFeatures from "@/pages/admin-features";
import NotFound from "@/pages/not-found";
import type { OperatorSession } from "@shared/schema";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { data: session, isLoading } = useQuery({
    queryKey: ["/api/auth/session"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/" />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function ProtectedAdminRoute({ component: Component }: { component: () => JSX.Element }) {
  // Check operator session for operator users with admin role
  const { data: operatorSession, isLoading: isLoadingOperator } = useQuery<OperatorSession>({
    queryKey: ["/api/auth/session"],
    retry: false,
  });

  // Check admin session for local admin users
  const { data: adminSession, isLoading: isLoadingAdmin } = useQuery({
    queryKey: ["/api/admin/session"],
    retry: false,
  });

  const isLoading = isLoadingOperator || isLoadingAdmin;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user has admin role (either operator user with admin role or local admin)
  const isOperatorAdmin = operatorSession && operatorSession.role === "admin";
  const isLocalAdmin = !!adminSession;

  if (!isOperatorAdmin && !isLocalAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={OperatorLogin} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/policies">
        {() => <ProtectedRoute component={PolicyManagement} />}
      </Route>
      <Route path="/numbers">
        {() => <ProtectedRoute component={NumberManagement} />}
      </Route>
      <Route path="/admin/audit-logs">
        {() => <ProtectedAdminRoute component={AdminAuditLogs} />}
      </Route>
      <Route path="/admin/customer-tenants">
        {() => <ProtectedAdminRoute component={AdminCustomerTenants} />}
      </Route>
      <Route path="/admin/operator-users">
        {() => <ProtectedAdminRoute component={AdminOperatorUsers} />}
      </Route>
      <Route path="/admin/documentation">
        {() => <ProtectedAdminRoute component={AdminDocumentation} />}
      </Route>
      <Route path="/admin/settings">
        {() => <ProtectedAdminRoute component={AdminSettings} />}
      </Route>
      <Route path="/admin/features">
        {() => <ProtectedAdminRoute component={AdminFeatures} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
