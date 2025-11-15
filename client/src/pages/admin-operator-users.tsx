import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, User, Trash2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { OperatorUser } from "@shared/schema";

export default function AdminOperatorUsers() {
  const { toast } = useToast();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: operatorUsers, isLoading } = useQuery<OperatorUser[]>({
    queryKey: ["/api/admin/operator-users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "admin" | "user" }) => {
      return await apiRequest("PUT", `/api/admin/operator-users/${id}`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "Operator user role has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operator-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/admin/operator-users/${id}`, { isActive });
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Operator user status has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operator-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/operator-users/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "Operator user has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operator-users"] });
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
      setDeleteUserId(null);
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Operator User Management (RBAC)
                </CardTitle>
                <CardDescription>
                  Manage operator tenant user roles and access permissions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="text-sm font-semibold mb-2">About Roles</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• <strong>Admin</strong>: Full access to admin panel including audit logs, settings, customer tenants, and user management</li>
                  <li>• <strong>User</strong>: Can only access voice configuration features (no admin panel access)</li>
                  <li>• New operator tenant users are automatically created with "User" role on first login</li>
                  <li>• Users are identified by their Azure AD account and created on first Microsoft sign-in</li>
                </ul>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : operatorUsers && operatorUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operatorUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium" data-testid={`text-user-name-${user.id}`}>
                              {user.displayName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-user-email-${user.id}`}>
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value: "admin" | "user") => 
                              updateRoleMutation.mutate({ id: user.id, role: value })
                            }
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-4 h-4" />
                                  Admin
                                </div>
                              </SelectItem>
                              <SelectItem value="user">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  User
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isActive ? "default" : "secondary"}
                            data-testid={`badge-status-${user.id}`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => 
                                toggleActiveMutation.mutate({ 
                                  id: user.id, 
                                  isActive: !user.isActive 
                                })
                              }
                              disabled={toggleActiveMutation.isPending}
                              data-testid={`button-toggle-status-${user.id}`}
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteUserId(user.id)}
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No operator users found. Users will be created automatically when they first sign in with Microsoft.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Operator User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this operator user? This action cannot be undone.
              The user will be recreated with default "User" role if they sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
