import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ToggleLeft, Info } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import type { FeatureFlag } from "@shared/schema";

export default function AdminFeatures() {
  const { toast } = useToast();

  // Fetch all feature flags
  const { data: featureFlags, isLoading } = useQuery({
    queryKey: ["/api/feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/feature-flags", {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json() as FeatureFlag[];
    },
  });

  // Mutation to update feature flag
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ featureKey, isEnabled }: { featureKey: string; isEnabled: boolean }) => {
      return await apiRequest("PUT", `/api/admin/feature-flags/${featureKey}`, { isEnabled });
    },
    onSuccess: (data, variables) => {
      const flag = featureFlags?.find(f => f.featureKey === variables.featureKey);
      toast({
        title: "Feature updated",
        description: `${flag?.featureName || variables.featureKey} has been ${variables.isEnabled ? 'enabled' : 'disabled'}`,
      });
      // Refetch feature flags
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
    },
    onError: (error: Error, variables) => {
      const flag = featureFlags?.find(f => f.featureKey === variables.featureKey);
      toast({
        title: "Failed to update feature",
        description: error.message,
        variant: "destructive",
      });
      // Refetch to reset the switch to correct state
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
    },
  });

  const handleToggle = (featureKey: string, currentState: boolean) => {
    updateFeatureMutation.mutate({
      featureKey,
      isEnabled: !currentState,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ToggleLeft className="w-6 h-6" />
            Feature Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Enable or disable application features
          </p>
        </div>

      {/* Feature Flags List */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Available Features</CardTitle>
          <CardDescription>
            Toggle features on or off to control which functionality is available in the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !featureFlags || featureFlags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No feature flags found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {featureFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`toggle-${flag.featureKey}`}
                        className="text-base font-semibold cursor-pointer"
                      >
                        {flag.featureName}
                      </Label>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          flag.isEnabled
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {flag.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {flag.description}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Key: {flag.featureKey}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Switch
                      id={`toggle-${flag.featureKey}`}
                      checked={flag.isEnabled}
                      onCheckedChange={() => handleToggle(flag.featureKey, flag.isEnabled)}
                      disabled={updateFeatureMutation.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                About Feature Flags
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Feature flags allow you to enable or disable specific functionality without restarting the application.
                Changes take effect immediately for all users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
