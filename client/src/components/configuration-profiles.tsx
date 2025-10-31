import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Plus, Pencil, Trash2, AlertCircle, Check } from "lucide-react";
import type { CustomerTenant, ConfigurationProfile } from "@shared/schema";

interface ConfigurationProfilesProps {
  selectedTenant: CustomerTenant | null;
  onApplyProfile?: (profile: ConfigurationProfile) => void;
}

export function ConfigurationProfiles({ selectedTenant, onApplyProfile }: ConfigurationProfilesProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConfigurationProfile | null>(null);
  const [formData, setFormData] = useState({
    profileName: "",
    phoneNumberPrefix: "tel:+1",
    defaultRoutingPolicy: "",
    description: "",
  });

  const { data: profiles, isLoading } = useQuery<ConfigurationProfile[]>({
    queryKey: ["/api/profiles", selectedTenant?.id],
    enabled: !!selectedTenant,
  });

  const createProfileMutation = useMutation({
    mutationFn: async (profile: typeof formData) => {
      const response = await apiRequest("POST", "/api/profiles", {
        ...profile,
        tenantId: selectedTenant!.id,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", selectedTenant?.id] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Profile created",
        description: "Configuration profile has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profile: typeof formData & { id: string }) => {
      const response = await apiRequest("PATCH", `/api/profiles/${profile.id}`, profile);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", selectedTenant?.id] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Profile updated",
        description: "Configuration profile has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/profiles/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", selectedTenant?.id] });
      toast({
        title: "Profile deleted",
        description: "Configuration profile has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      profileName: "",
      phoneNumberPrefix: "tel:+1",
      defaultRoutingPolicy: "",
      description: "",
    });
    setEditingProfile(null);
  };

  const handleOpenDialog = (profile?: ConfigurationProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        profileName: profile.profileName,
        phoneNumberPrefix: profile.phoneNumberPrefix,
        defaultRoutingPolicy: profile.defaultRoutingPolicy,
        description: profile.description || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.profileName || !formData.phoneNumberPrefix || !formData.defaultRoutingPolicy) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phoneNumberPrefix.startsWith("tel:+")) {
      toast({
        title: "Invalid phone prefix",
        description: "Phone number prefix must start with 'tel:+'",
        variant: "destructive",
      });
      return;
    }

    if (editingProfile) {
      updateProfileMutation.mutate({ ...formData, id: editingProfile.id });
    } else {
      createProfileMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this profile?")) {
      deleteProfileMutation.mutate(id);
    }
  };

  if (!selectedTenant) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration Profiles
            </CardTitle>
            <CardDescription>
              Save and reuse common phone number and policy configurations
            </CardDescription>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            data-testid="button-create-profile"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Profile
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : profiles && profiles.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">NAME</TableHead>
                    <TableHead className="font-semibold">PHONE PREFIX</TableHead>
                    <TableHead className="font-semibold">DEFAULT POLICY</TableHead>
                    <TableHead className="font-semibold">DESCRIPTION</TableHead>
                    <TableHead className="font-semibold w-[140px]">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id} data-testid={`row-profile-${profile.id}`}>
                      <TableCell className="font-medium">{profile.profileName}</TableCell>
                      <TableCell className="font-mono text-sm">{profile.phoneNumberPrefix}</TableCell>
                      <TableCell className="text-sm">{profile.defaultRoutingPolicy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {onApplyProfile && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onApplyProfile(profile)}
                              title="Apply this profile"
                              data-testid={`button-apply-profile-${profile.id}`}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenDialog(profile)}
                            title="Edit profile"
                            data-testid={`button-edit-profile-${profile.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(profile.id)}
                            title="Delete profile"
                            data-testid={`button-delete-profile-${profile.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No profiles yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Create configuration profiles to quickly apply common phone number patterns and policies
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-profile-form">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Edit Profile" : "Create Profile"}
            </DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update the configuration profile details"
                : "Create a new configuration profile for quick assignment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profileName">Profile Name *</Label>
              <Input
                id="profileName"
                value={formData.profileName}
                onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                placeholder="e.g., Sales Team Config"
                data-testid="input-profile-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumberPrefix">Phone Number Prefix *</Label>
              <Input
                id="phoneNumberPrefix"
                value={formData.phoneNumberPrefix}
                onChange={(e) => setFormData({ ...formData, phoneNumberPrefix: e.target.value })}
                placeholder="tel:+1555"
                data-testid="input-phone-prefix"
              />
              <p className="text-xs text-muted-foreground">
                Must start with tel:+ (e.g., tel:+1555)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultRoutingPolicy">Default Routing Policy *</Label>
              <Input
                id="defaultRoutingPolicy"
                value={formData.defaultRoutingPolicy}
                onChange={(e) => setFormData({ ...formData, defaultRoutingPolicy: e.target.value })}
                placeholder="e.g., US-National"
                data-testid="input-routing-policy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for this profile"
                rows={3}
                data-testid="input-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createProfileMutation.isPending || updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {editingProfile ? "Update Profile" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
