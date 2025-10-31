import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { AddTenantWizard } from "./add-tenant-wizard";
import type { CustomerTenant } from "@shared/schema";

interface TenantSelectorProps {
  selectedTenant: CustomerTenant | null;
  onSelectTenant: (tenant: CustomerTenant | null) => void;
}

export function TenantSelector({ selectedTenant, onSelectTenant }: TenantSelectorProps) {
  const [showWizard, setShowWizard] = useState(false);

  const { data: tenants, isLoading } = useQuery<CustomerTenant[]>({
    queryKey: ["/api/tenants"],
  });

  const handleSelectTenant = (tenantId: string) => {
    const tenant = tenants?.find((t) => t.id === tenantId);
    onSelectTenant(tenant || null);
  };

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Select
          value={selectedTenant?.id || ""}
          onValueChange={handleSelectTenant}
          disabled={isLoading}
        >
          <SelectTrigger className="h-11" data-testid="select-tenant">
            <SelectValue placeholder={isLoading ? "Loading tenants..." : "Select a customer tenant"} />
          </SelectTrigger>
          <SelectContent>
            {tenants?.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.tenantName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        onClick={() => setShowWizard(true)}
        className="h-11 px-6"
        data-testid="button-add-tenant"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Tenant
      </Button>

      <AddTenantWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onTenantAdded={(tenant) => {
          onSelectTenant(tenant);
          setShowWizard(false);
        }}
      />
    </div>
  );
}
