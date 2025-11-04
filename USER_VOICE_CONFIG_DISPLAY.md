# User Voice Configuration Display Feature

## Overview

**Date:** November 4, 2025
**Status:** ✅ Implemented and deployed

This feature displays the current phone number and voice routing policy assignment for a selected Teams user, and allows operators to pre-fill the form with existing values.

---

## Feature Description

When an operator selects a Teams user in the Voice Configuration page, the application:

1. **Queries current configuration** via PowerShell certificate authentication
2. **Displays current assignment** in a prominent blue info box
3. **Allows pre-filling** the form with current values for editing

### What's Displayed

- **Phone Number (LineURI):** Current phone number assignment or "Not assigned"
- **Voice Routing Policy:** Current policy assignment or "Not assigned"
- **Pre-fill button:** Loads current values into the form for editing

---

## Implementation

### Backend API Endpoint

**New Endpoint:** `GET /api/teams/user-voice-config`

**Purpose:** Query current voice configuration for a specific user via PowerShell

**Query Parameters:**
- `tenantId` (required) - Customer tenant ID
- `userPrincipalName` (required) - User's UPN (email)

**Response:**
```json
{
  "displayName": "Dev User",
  "userPrincipalName": "DevUser@ucrdev.onmicrosoft.com",
  "lineUri": "tel:+15551234567",
  "voiceRoutingPolicy": "Tag:Test Policy",
  "enterpriseVoiceEnabled": true,
  "hostedVoiceMail": true
}
```

**PowerShell Function Used:**
- `getTeamsUserCert()` - Executes `Get-CsOnlineUser` via certificate auth
- Returns: DisplayName, UserPrincipalName, LineURI, OnlineVoiceRoutingPolicy, etc.

**File:** `server/routes.ts` lines 1097-1173

---

### Frontend UI

**Location:** Voice Configuration page (`client/src/pages/dashboard.tsx`)

**React Query Hook:**
```typescript
const { data: userVoiceConfig, isLoading: isLoadingVoiceConfig } = useQuery<UserVoiceConfig>({
  queryKey: ["/api/teams/user-voice-config", selectedTenant?.id, selectedUser?.userPrincipalName],
  enabled: !!selectedTenant && !!selectedUser,
  // Fetches current config when user is selected
});
```

**UI Components:**

1. **Loading State:**
   ```
   ┌─────────────────────────────────────┐
   │ 🔄 Loading current configuration... │
   └─────────────────────────────────────┘
   ```

2. **Configuration Display:**
   ```
   ┌────────────────────────────────────────────────┐
   │ 📞 Current Configuration                       │
   │                                                │
   │ Phone Number: tel:+15551234567                 │
   │ Voice Policy: Tag:Test Policy                  │
   │                                                │
   │ Load current values into form →                │
   └────────────────────────────────────────────────┘
   ```

3. **No Assignment:**
   ```
   ┌────────────────────────────────────────────────┐
   │ 📞 Current Configuration                       │
   │                                                │
   │ Phone Number: Not assigned                     │
   │ Voice Policy: Not assigned                     │
   └────────────────────────────────────────────────┘
   ```

**Files:** `client/src/pages/dashboard.tsx` lines 18-25, 73-90, 299-357

---

## User Experience

### Workflow

1. **Operator selects tenant** → Users list loads
2. **Operator selects user** → Current config loads automatically
3. **Config displays** in blue box below user selector
4. **Operator can:**
   - See current assignment at a glance
   - Click "Load current values into form" to pre-fill
   - Edit and save new values
   - Leave fields unchanged to keep current config

### Benefits

✅ **Visibility:** Operators immediately see what's currently assigned
✅ **Efficiency:** No need to check Teams Admin Center
✅ **Accuracy:** Reduces risk of accidental overwrites
✅ **Convenience:** Pre-fill button loads current values for editing
✅ **Real-time:** Uses PowerShell for most accurate data

---

## Technical Details

### PowerShell Command

The backend executes this PowerShell script:
```powershell
# Connect with certificate auth
Connect-MicrosoftTeams -ApplicationId "..." -CertificateThumbprint "..." -TenantId "..."

# Get user details
$user = Get-CsOnlineUser -Identity "user@domain.com"
$result = @{
    DisplayName = $user.DisplayName
    UserPrincipalName = $user.UserPrincipalName
    LineURI = $user.LineURI
    OnlineVoiceRoutingPolicy = $user.OnlineVoiceRoutingPolicy
    EnterpriseVoiceEnabled = $user.EnterpriseVoiceEnabled
    HostedVoiceMail = $user.HostedVoiceMail
}
$result | ConvertTo-Json -Compress
```

### Certificate Authentication

- Uses existing PowerShell certificate credentials
- Same authentication as voice assignment operations
- No additional permissions required
- Typically executes in 5-10 seconds

### Error Handling

**Scenario:** Certificate not configured
- **Response:** 400 Bad Request
- **Message:** "PowerShell certificate credentials not configured for this tenant"

**Scenario:** User not found
- **Response:** 500 Internal Server Error
- **Message:** PowerShell error details

**Scenario:** API fails
- **UI:** Silently fails, no config box shown
- **Console:** Error logged for debugging

---

## Testing

### Manual Test Steps

1. Navigate to Voice Configuration page
2. Select "Dev Tenant"
3. Select a user from the dropdown
4. **Verify:** Blue "Current Configuration" box appears
5. **Verify:** Shows current phone number and policy
6. Click "Load current values into form →"
7. **Verify:** Form fields are pre-filled
8. Edit phone number or policy
9. Click "Save Configuration"
10. **Verify:** Assignment succeeds
11. Refresh page and select same user
12. **Verify:** New values are displayed

### Expected Results

| User Has Assignment | Expected Display |
|---------------------|------------------|
| Phone + Policy | Both values shown, pre-fill button available |
| Phone only | Phone shown, Policy "Not assigned" |
| Policy only | Policy shown, Phone "Not assigned" |
| Neither | Both "Not assigned", no pre-fill button |

---

## Performance

**Query Time:**
- First load: ~5-10 seconds (PowerShell connection + query)
- Cached: Instant (React Query cache)
- Cache invalidated: After successful assignment

**Network:**
- Single HTTP GET request
- Response size: ~200-500 bytes (JSON)

**UX Impact:**
- Loading indicator shows immediately
- Non-blocking (form remains usable during load)
- Fails gracefully if PowerShell unavailable

---

## Future Enhancements

### Potential Improvements

1. **Auto-refresh:** Poll for changes every 30 seconds
2. **History:** Show previous assignments with timestamps
3. **Comparison:** Highlight differences between current and form values
4. **Bulk view:** Show current assignments for all users in a table
5. **Export:** Export current configurations to CSV

### Related Features

- **Audit logging:** Already tracks all assignment changes
- **PowerShell debugging:** Use debug endpoints to troubleshoot queries
- **Certificate rotation:** No impact on this feature (uses active cert)

---

## API Reference

### Request

```http
GET /api/teams/user-voice-config?tenantId=<UUID>&userPrincipalName=<EMAIL>
```

**Headers:**
- `Cookie: session=...` (operator authentication required)

**Example:**
```bash
curl -k "https://localhost/api/teams/user-voice-config?tenantId=83f508e2-0b8b-41da-9dba-8a329305c13e&userPrincipalName=DevUser%40ucrdev.onmicrosoft.com" \
  --cookie "session=..."
```

### Response

**Success (200 OK):**
```json
{
  "displayName": "Dev User",
  "userPrincipalName": "DevUser@ucrdev.onmicrosoft.com",
  "lineUri": "tel:+15551234567",
  "voiceRoutingPolicy": "Tag:Test Policy",
  "enterpriseVoiceEnabled": true,
  "hostedVoiceMail": true
}
```

**Error (400/500):**
```json
{
  "error": "PowerShell certificate credentials not configured for this tenant"
}
```

---

## Files Changed

### Backend
- `server/routes.ts` (lines 1097-1173)
  - Added `GET /api/teams/user-voice-config` endpoint
  - Calls `getTeamsUserCert()` PowerShell function
  - Returns formatted voice configuration

### Frontend
- `client/src/pages/dashboard.tsx` (multiple sections)
  - Added `UserVoiceConfig` interface (lines 18-25)
  - Added React Query hook for voice config (lines 73-90)
  - Added UI for current configuration display (lines 299-357)
  - Added pre-fill button functionality

### Dependencies
- No new npm packages required
- Uses existing PowerShell functions from `server/powershell.ts`
- Uses existing `getTeamsUserCert()` function

---

## Git Commit

**Branch:** `powershell-implementation`
**Files Changed:**
- `server/routes.ts` - New API endpoint
- `client/src/pages/dashboard.tsx` - UI updates
- `USER_VOICE_CONFIG_DISPLAY.md` - This documentation

**Commit Message:**
```
Add current voice config display and pre-fill feature

Features:
- New API endpoint to query user voice config via PowerShell
- Display current phone number and policy in UI
- Pre-fill button to load current values into form
- Real-time querying using certificate authentication

User requested: Display existing phone number on assignment page
```

---

## Screenshots

### Before (No current config shown)
```
┌─────────────────────────────────┐
│ Teams User:                     │
│ [Select user...]                │
└─────────────────────────────────┘
```

### After (Current config displayed)
```
┌─────────────────────────────────────┐
│ Teams User:                         │
│ Dev User (DevUser@ucrdev.onmicr...) │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📞 Current Configuration        │ │
│ │ Phone Number: tel:+15551234567  │ │
│ │ Voice Policy: Tag:Test Policy   │ │
│ │ Load current values into form → │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** "Loading current configuration..." never completes
- **Cause:** PowerShell credentials not configured or certificate expired
- **Solution:** Check debug endpoints or configure certificate credentials

**Issue:** Shows "Not assigned" but user has a number in Teams
- **Cause:** PowerShell query failed silently
- **Solution:** Check server logs for PowerShell errors
- **Debug:** Use `/api/debug/powershell/execute/:tenantId` to test query

**Issue:** Pre-fill button doesn't populate form
- **Cause:** JavaScript error or empty values
- **Solution:** Check browser console for errors

### Debug Endpoints

Test the PowerShell query directly:
```bash
curl -k -X POST https://localhost/api/debug/powershell/execute/:tenantId \
  -H "Content-Type: application/json" \
  -d '{"script":"Get-CsOnlineUser -Identity user@domain.com | Select-Object DisplayName, LineURI, OnlineVoiceRoutingPolicy | ConvertTo-Json"}'
```

---

## Related Documentation

- `ASSIGNMENT_TIMEOUT_FIX.md` - Voice assignment fix (Nov 4, 2025)
- `DEBUG_ENDPOINTS.md` - Debug endpoint reference
- `POWERSHELL_CERT_IMPLEMENTATION_STATUS.md` - Certificate auth status
- `CERTIFICATE_AUTH_MIGRATION_SUMMARY.md` - Migration overview

---

**Last Updated:** November 4, 2025
**Feature Status:** ✅ Production Ready
**User Impact:** Positive - Improved visibility and workflow efficiency
