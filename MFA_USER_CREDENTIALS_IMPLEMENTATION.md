# MFA User Credentials Implementation Plan

## Date: 2025-11-04

## Current Status

### What's Already Implemented ✅

1. **Frontend MFA Modal** (`client/src/components/powershell-mfa-modal.tsx`)
   - UI for MFA code input (6-digit)
   - WebSocket connection handling
   - Real-time output display
   - MFA code submission

2. **PowerShell Session Manager** (`server/powershell-session.ts`)
   - `createSession()` method for user/password auth with MFA support
   - `createSessionWithCertificate()` method for certificate auth (no MFA)
   - Interactive PowerShell spawn (allows MFA prompts)
   - MFA code handling via stdin
   - Event emitters for MFA required, connected, disconnected

3. **WebSocket Support** (`server/websocket.ts`)
   - WebSocket authentication with JWT
   - Message types: `mfa_required`, `send_mfa_code`, `connected`, `disconnected`
   - Real-time bidirectional communication

4. **Database Schema** (`shared/schema.ts`)
   - `tenant_powershell_credentials` table supports multiple credential sets per tenant
   - Fields: `authType`, `username`, `encryptedPassword`, `appId`, `certificateThumbprint`
   - `isActive` flag to select which credentials to use

### What's Not Working ❌

1. **WebSocket Session Creation** - Always uses certificate auth, ignores `authType`
   - File: `server/websocket.ts:186-193`
   - Currently hardcoded to use `createSessionWithCertificate()`
   - Needs to check `credentials.authType` and call appropriate method

2. **Dashboard API Call** - Uses certificate auth endpoint only
   - File: `client/src/pages/dashboard.tsx:59`
   - Calls `/api/powershell/get-policies` which requires certificate auth
   - No fallback or check for user/password credentials

3. **Admin UI** - Only shows certificate credential fields
   - File: `client/src/components/admin-powershell-credentials.tsx`
   - Needs option to choose authentication type
   - Needs username/password fields when user auth is selected

## Implementation Plan

### Phase 1: Backend - Dual Authentication Support

**1. Update WebSocket Handler** (`server/websocket.ts`)

```typescript
async function handleCreateSession(
  client: WebSocketClient,
  data: {
    tenantId: string;
    credentials: {
      authType: 'certificate' | 'user';
      // Certificate fields
      tenantId?: string;
      appId?: string;
      certificateThumbprint?: string;
      // User fields
      username?: string;
      encryptedPassword?: string;
    }
  }
): Promise<void> {
  try {
    const { tenantId, credentials } = data;
    let sessionId: string;

    // Choose authentication method based on authType
    if (credentials.authType === 'user') {
      // User/password authentication with MFA support
      sessionId = await powershellSessionManager.createSession(
        tenantId,
        client.operatorEmail,
        {
          username: credentials.username || '',
          encryptedPassword: credentials.encryptedPassword || ''
        }
      );
    } else {
      // Certificate-based authentication (no MFA)
      sessionId = await powershellSessionManager.createSessionWithCertificate(
        tenantId,
        client.operatorEmail,
        {
          tenantId: credentials.tenantId || '',
          appId: credentials.appId || '',
          certificateThumbprint: credentials.certificateThumbprint || ''
        }
      );
    }

    // Rest of the handler...
  }
}
```

**2. Update API Endpoint** (`server/routes.ts`)

Add new endpoint for user/password policy retrieval or make existing endpoint handle both:

```typescript
app.post("/api/powershell/get-policies", requireOperatorAuth, async (req, res) => {
  // Get credentials
  const credentials = await storage.getTenantPowershellCredentials(tenantId);
  const activeCred = credentials.find(c => c.isActive);

  if (activeCred.authType === 'user') {
    // User auth not supported for non-interactive API calls
    // Recommend using certificate auth or manual PowerShell modal
    return res.status(400).json({
      error: "User authentication requires interactive MFA. Please use certificate authentication or the PowerShell modal."
    });
  }

  // Continue with certificate auth...
});
```

### Phase 2: Frontend - Admin UI for Dual Auth

**3. Update Admin PowerShell Credentials Component**

Add radio buttons to choose auth type:
- Certificate Authentication (existing)
- User Authentication (new)

Show appropriate fields based on selection:
- Certificate: Tenant ID, App ID, Certificate Thumbprint
- User: Username, Password

**4. Update Dashboard Fallback**

When automatic policy retrieval fails (user auth tenant), show helpful message:
"This tenant uses user authentication. Click the PowerShell button to connect interactively with MFA."

### Phase 3: Testing Plan

**Test Case 1: Certificate Auth Tenant (Already Working)**
1. Create/select tenant with certificate credentials
2. Policies load automatically
3. "Load current values" works
4. No MFA required

**Test Case 2: User Auth Tenant (To Be Implemented)**
1. Create new tenant with user credentials
2. Select tenant - see message about manual PowerShell connection
3. Click PowerShell button
4. Enter MFA code when prompted
5. Get policies
6. Use policies in dropdown
7. "Load current values" works after PowerShell session

**Test Case 3: Mixed Tenants**
1. Switch between certificate tenant and user tenant
2. Verify correct behavior for each
3. Ensure no credential leakage

## Database Changes

No schema changes needed! The `tenant_powershell_credentials` table already supports both:
- `authType` VARCHAR (values: 'certificate' or 'user')
- Certificate fields: `appId`, `certificateThumbprint`
- User fields: `username`, `encryptedPassword`

## Security Considerations

1. **Password Encryption**: Already using AES-256-GCM ✅
2. **MFA Required**: User auth always requires MFA ✅
3. **Session Timeout**: 30-minute timeout on PowerShell sessions ✅
4. **WebSocket Auth**: JWT tokens for WebSocket connections ✅
5. **Credential Isolation**: Separate credentials per tenant ✅

## Known Limitations

1. **User Auth for Automatic API Calls**: User authentication requires interactive MFA, so cannot be used for automatic policy retrieval on tenant selection. Certificate auth should be used for automatic operations.

2. **MFA Code Handling**: MFA code must be entered within the PowerShell session timeout period.

3. **Replit Platform**: PowerShell still doesn't work on Replit platform (applies to both auth types).

## Migration Path

For users currently using certificate auth:
1. No changes required - continue working as-is
2. Can optionally add user credentials as secondary auth method
3. Can switch between auth types using `isActive` flag

## Next Steps

1. Implement WebSocket dual auth logic
2. Update admin UI for auth type selection
3. Add user credential fields to admin panel
4. Test with second tenant using user credentials
5. Update documentation
6. Commit and push to git

## Files to Modify

- `server/websocket.ts` - Add authType handling
- `client/src/components/admin-powershell-credentials.tsx` - Add auth type UI
- `server/routes.ts` - Handle user auth endpoints (or document limitation)
- `client/src/pages/dashboard.tsx` - Add fallback message for user auth tenants

## Estimated Effort

- Backend changes: 1-2 hours
- Frontend changes: 2-3 hours
- Testing: 1-2 hours
- **Total: 4-7 hours**
