import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Circle, ShieldCheck, Key, Building2, Info, Eye, EyeOff } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { CustomerTenant } from "@shared/schema";

const tenantSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  tenantName: z.string().min(1, "Tenant name is required"),
  appRegistrationId: z.string().optional(),
  appRegistrationSecret: z.string().optional(),
});

type TenantFormData = z.infer<typeof tenantSchema>;

interface AddTenantWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTenantAdded: (tenant: CustomerTenant) => void;
}

export function AddTenantWizard({ open, onOpenChange, onTenantAdded }: AddTenantWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      tenantId: "",
      tenantName: "",
      appRegistrationId: "",
      appRegistrationSecret: "",
    },
  });

  const addTenantMutation = useMutation<CustomerTenant, Error, TenantFormData>({
    mutationFn: async (data: TenantFormData) => {
      return await apiRequest("POST", "/api/tenants", data) as unknown as CustomerTenant;
    },
    onSuccess: (tenant: CustomerTenant) => {
      toast({
        title: "Customer tenant added",
        description: `${tenant.tenantName} has been added successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      onTenantAdded(tenant);
      form.reset();
      setStep(1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add tenant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TenantFormData) => {
    addTenantMutation.mutate(data);
  };

  const handleNext = async () => {
    const isValid = await form.trigger(step === 1 ? ["tenantId", "tenantName"] : undefined);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleClose = () => {
    form.reset();
    setStep(1);
    onOpenChange(false);
  };

  const permissions = [
    {
      name: "User.Read.All",
      reason: "Query Teams voice-enabled users in the customer tenant",
      fullScope: "Read full user profiles across the entire organization",
      details: [
        "Display name, email, job title, department",
        "Manager and direct reports",
        "Office location and contact information",
        "All user profile properties",
        "Does NOT include passwords or authentication credentials"
      ],
      type: "Application",
      adminConsent: true
    },
    {
      name: "TeamsUserConfiguration.Read.All",
      reason: "Read Teams user phone configurations",
      fullScope: "Read Teams user settings and phone configurations",
      details: [
        "View Teams user phone configurations",
        "Query existing telephone number assignments",
        "Read Teams voice enablement status",
        "Access user-specific Teams settings",
        "Required to validate and query phone number assignments"
      ],
      type: "Application",
      adminConsent: true
    },
    {
      name: "TeamSettings.ReadWrite.All",
      reason: "Assign and manage Teams telephone numbers (Line URI)",
      fullScope: "Read and write Teams settings including phone numbers and configurations",
      details: [
        "Assign and unassign Teams telephone numbers",
        "Manage enterprise voice enablement status",
        "Configure Teams phone system settings",
        "Modify Teams voice configurations",
        "Required for PATCH operations to assign phone numbers"
      ],
      type: "Application",
      adminConsent: true,
      betaOnly: true
    },
    {
      name: "TeamsPolicyUserAssign.ReadWrite.All",
      reason: "Assign voice routing policies to Teams users",
      fullScope: "Assign and manage Teams policies for users",
      details: [
        "Assign voice routing policies",
        "Manage messaging policies",
        "Configure meeting policies",
        "Set calling policies",
        "Control app permission policies",
        "Manage Teams update policies"
      ],
      type: "Application",
      adminConsent: true,
      betaOnly: true
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Customer Tenant</DialogTitle>
          <DialogDescription>
            Configure a new customer tenant for Teams voice management
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-4">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                {step > num ? (
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                ) : step === num ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-primary-foreground font-semibold">{num}</span>
                  </div>
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-xs ${step >= num ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {num === 1 ? "Tenant Info" : num === 2 ? "Permissions" : "App Registration"}
                </span>
              </div>
              {num < 3 && <div className={`h-px flex-1 ${step > num ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Tenant Information */}
            {step === 1 && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Customer Tenant Information</h3>
                        <p className="text-sm text-muted-foreground">
                          Enter the Azure AD details for the customer tenant
                        </p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="tenantId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Azure AD Tenant ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              className="h-11"
                              data-testid="input-tenant-id"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Found in Azure Portal → Azure Active Directory → Overview
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tenantName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Tenant Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Contoso Corporation"
                              className="h-11"
                              data-testid="input-tenant-name"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            A friendly name to identify this customer tenant
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 2: Required Permissions */}
            {step === 2 && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Required Permissions</h3>
                        <p className="text-sm text-muted-foreground">
                          These Microsoft Graph API permissions are required
                        </p>
                      </div>
                    </div>

                    <Accordion type="single" collapsible className="space-y-3">
                      {permissions.map((permission, index) => (
                        <AccordionItem
                          key={permission.name}
                          value={`permission-${index}`}
                          className="border rounded-lg bg-muted/50"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-start gap-3 text-left flex-1">
                              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <div className="font-semibold text-sm flex items-center gap-2">
                                  {permission.name}
                                  {permission.betaOnly && (
                                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                                      Beta
                                    </span>
                                  )}
                                  {permission.adminConsent && (
                                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      Admin Consent Required
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{permission.reason}</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-2">
                            <div className="ml-8 space-y-3">
                              <div className="bg-background/50 rounded-md p-3 border">
                                <p className="text-xs font-semibold mb-2 flex items-center gap-2">
                                  <Info className="w-3.5 h-3.5" />
                                  Full Permission Scope
                                </p>
                                <p className="text-xs text-muted-foreground">{permission.fullScope}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-2">This permission allows the application to:</p>
                                <ul className="space-y-1.5">
                                  {permission.details.map((detail, idx) => (
                                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                      <Circle className="w-1.5 h-1.5 fill-current flex-shrink-0 mt-1.5" />
                                      <span>{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="pt-2 border-t">
                                <p className="text-xs">
                                  <span className="font-semibold">Permission Type:</span>{" "}
                                  <span className="text-muted-foreground">{permission.type}</span>
                                </p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>

                    <div className="bg-muted/30 rounded-lg p-4 text-sm">
                      <p className="font-semibold mb-2">Setup Instructions:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                        <li>Go to Azure Portal → Azure Active Directory → App registrations</li>
                        <li>Create a new app registration or use an existing one</li>
                        <li>Add the permissions listed above under "API permissions"</li>
                        <li>Grant admin consent for the permissions</li>
                        <li>Create a client secret under "Certificates & secrets"</li>
                      </ol>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
                      <p className="font-semibold mb-2">💡 Verify Your Setup</p>
                      <p className="text-xs text-muted-foreground">
                        After adding the tenant, use the <strong>Validate Permissions</strong> feature in the Admin Panel to verify all 4 permissions are properly configured. The validation will test User.Read.All and TeamsUserConfiguration.Read.All, while TeamSettings.ReadWrite.All and TeamsPolicyUserAssign.ReadWrite.All cannot be tested without making changes (marked as success if granted).
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 3: App Registration */}
            {step === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Key className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">App Registration Credentials</h3>
                        <p className="text-sm text-muted-foreground">
                          Enter the app registration details from Azure AD
                        </p>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="appRegistrationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">
                            Application (Client) ID
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              className="h-11"
                              data-testid="input-app-id"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Found in your app registration Overview page
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="appRegistrationSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Client Secret</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter client secret value"
                              className="h-11"
                              data-testid="input-app-secret"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            The secret value (not the secret ID) from Certificates & secrets
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={step === 1 ? handleClose : handleBack}
                className="h-11 px-6"
                data-testid="button-wizard-back"
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-11 px-6"
                  data-testid="button-wizard-next"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={addTenantMutation.isPending}
                  className="h-11 px-6"
                  data-testid="button-wizard-submit"
                >
                  {addTenantMutation.isPending ? "Adding..." : "Add Tenant"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
