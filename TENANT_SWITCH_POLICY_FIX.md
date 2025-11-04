# Tenant Switch Voice Routing Policy Fix

## Date Fixed
2025-11-04

## Problem Summary
When switching between customer tenants in the dashboard, the voice routing policies dropdown would not refresh with the new tenant's policies. Instead, it continued to display policies from the previously selected tenant.

## Root Cause
The `powershellPolicies` state variable was not being cleared when the tenant changed. The component uses a fallback mechanism:

```typescript
const routingPolicies = powershellPolicies || graphPolicies;
```

This means:
1. If PowerShell policies were retrieved for Tenant A, they would be stored in `powershellPolicies` state
2. When switching to Tenant B, the Graph API would fetch new policies and store them in `graphPolicies`
3. However, `powershellPolicies` still contained Tenant A's policies
4. The fallback logic would use `powershellPolicies` (Tenant A) instead of `graphPolicies` (Tenant B)
5. Result: Wrong policies displayed for Tenant B

## Solution Implemented
Added `setPowershellPolicies(null)` to the tenant change `useEffect` hook to clear PowerShell policies when switching tenants.

### Code Change
**File:** `client/src/pages/dashboard.tsx`

**Before:**
```typescript
useEffect(() => {
  if (selectedTenant) {
    setSelectedUser(null);
    setPhoneNumber("");
    setSelectedPolicy("");
    setPhoneValidation(null);
    // Missing: setPowershellPolicies(null)

    queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/teams/routing-policies", selectedTenant.id] });
  }
}, [selectedTenant?.id]);
```

**After:**
```typescript
useEffect(() => {
  if (selectedTenant) {
    setSelectedUser(null);
    setPhoneNumber("");
    setSelectedPolicy("");
    setPhoneValidation(null);
    setPowershellPolicies(null); // Clear PowerShell policies from previous tenant

    queryClient.invalidateQueries({ queryKey: ["/api/teams/users", selectedTenant.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/teams/routing-policies", selectedTenant.id] });
  }
}, [selectedTenant?.id]);
```

## Testing
1. Select Tenant A and verify voice routing policies load correctly
2. Optionally retrieve PowerShell policies for Tenant A
3. Switch to Tenant B
4. Verify that Tenant B's policies are displayed (not Tenant A's policies)
5. Verify users list is refreshed for Tenant B
6. Verify the assignment section works correctly with Tenant B's data

## Impact
- **Fixed:** Voice routing policies now correctly refresh when switching tenants
- **Fixed:** Users can now properly assign policies specific to each tenant
- **Fixed:** No data contamination between different customer tenants

## Related Files
- `client/src/pages/dashboard.tsx` - Main dashboard component with tenant switching logic

## Commit
Branch: `feature/auto-refresh-on-tenant-select`
This fix ensures the auto-refresh feature works completely, including voice routing policies.
