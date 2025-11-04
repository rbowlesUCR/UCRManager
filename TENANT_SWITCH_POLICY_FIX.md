# Tenant Switch and Policy Loading Fixes

## Date Fixed
2025-11-04

## Problem 1: Voice Routing Policies Not Refreshing on Tenant Switch

### Problem Summary
When switching between customer tenants in the dashboard, the voice routing policies dropdown would not refresh with the new tenant's policies. Instead, it continued to display policies from the previously selected tenant.

### Root Cause
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

### Solution Implemented
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

---

## Problem 2: "Load Current Values" Button Not Populating Voice Routing Policy

### Problem Summary
When clicking the "Load current values into form →" button after selecting a user, the phone number would populate correctly, but the voice routing policy dropdown would not be selected/populated.

### Root Cause
The issue was a mismatch between what the API returns and what the Select component expects:

1. The user voice config API returns `voiceRoutingPolicy` as a **policy name** (e.g., "US Calling")
2. The Select component uses `policy.id` as the value for each SelectItem
3. When loading current values, the code was doing: `setSelectedPolicy(userVoiceConfig.voiceRoutingPolicy)`
4. This set the selected policy to a NAME (e.g., "US Calling")
5. But the Select component was looking for an ID to match
6. Result: No policy was selected in the dropdown

**Code Reference (lines 437-441):**
```typescript
<SelectContent>
  {(routingPolicies as VoiceRoutingPolicy[])?.map((policy) => (
    <SelectItem key={policy.id} value={policy.id}>
      {policy.name}
    </SelectItem>
  ))}
</SelectContent>
```

### Solution Implemented
Modified the "Load current values" button handler to find the matching policy by name in the `routingPolicies` array, then use its ID (not the name) to set the selected policy.

### Code Change
**File:** `client/src/pages/dashboard.tsx` (lines 363-371)

**Before:**
```typescript
if (userVoiceConfig.voiceRoutingPolicy) {
  setSelectedPolicy(userVoiceConfig.voiceRoutingPolicy);
}
```

**After:**
```typescript
if (userVoiceConfig.voiceRoutingPolicy && routingPolicies) {
  // Find the policy by name and use its ID for the Select component
  const matchingPolicy = (routingPolicies as VoiceRoutingPolicy[]).find(
    (p) => p.name === userVoiceConfig.voiceRoutingPolicy
  );
  if (matchingPolicy) {
    setSelectedPolicy(matchingPolicy.id);
  }
}
```

### Testing
1. Select a tenant with voice routing policies configured
2. Select a user who already has a phone number and voice policy assigned
3. View the "Current Configuration" display showing their current values
4. Click "Load current values into form →"
5. Verify phone number is populated in the input field
6. Verify the voice routing policy is selected in the dropdown
7. Both values should now be correctly pre-filled in the form

---

## Summary

### Impact of Both Fixes
- **Fixed:** Voice routing policies correctly refresh when switching tenants
- **Fixed:** "Load current values" button now properly populates both phone number AND voice routing policy
- **Fixed:** Users can properly assign tenant-specific policies
- **Fixed:** No data contamination between customer tenants
- **Improved:** Better user experience when editing existing voice configurations

## Commit
Branch: `feature/auto-refresh-on-tenant-select`
These fixes ensure the auto-refresh feature works completely, including voice routing policies, and the form pre-fill functionality works correctly.
