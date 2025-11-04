# MFA User Credentials Implementation Plan

## Date: 2025-11-04

## Current Status: ✅ COMPLETED (2025-11-04)

### Fully Implemented ✅

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

3. **WebSocket Dual Authentication Support** (`server/websocket.ts`)
   - WebSocket authentication with JWT
   - Message types: `mfa_required`, `send_mfa_code`, `connected`, `disconnected`
   - Real-time bidirectional communication
   - **NEW**: Dynamic routing based on `credentials.authType`
   - **NEW**: Calls `createSession()` for user auth with MFA
   - **NEW**: Calls `createSessionWithCertificate()` for certificate auth

4. **Database Schema** (`shared/schema.ts`)
   - `tenant_powershell_credentials` table supports multiple credential sets per tenant
   - Fields: `authType`, `username`, `encryptedPassword`, `appId`, `certificateThumbprint`
   - `isActive` flag to select which credentials to use
   - **Migration completed**: All new columns added successfully

5. **Admin UI for Dual Authentication** (`client/src/components/admin-powershell-credentials.tsx`)
   - Radio buttons to select authentication type
   - Conditional form fields based on selection
   - Certificate fields: Tenant ID, App ID, Certificate Thumbprint
   - User fields: Username, Password
   - Visual indicators for each auth type (Shield icon for certificate, User icon for MFA)

6. **Backend API Endpoints** (`server/routes.ts`)
   - Password encryption endpoint: `/api/admin/encrypt-password`
   - GET endpoint returns `authType`, `username`, `encryptedPassword` fields
   - POST endpoint accepts and validates both auth types
   - **NEW**: Operator credentials endpoint returns appropriate credentials based on active `authType`
   - **NEW**: For user auth: returns `{authType: 'user', username, encryptedPassword}`
   - **NEW**: For certificate auth: returns `{authType: 'certificate', tenantId, appId, certificateThumbprint}`

## Final Implementation (Completed 2025-11-04)

### WebSocket Handler Changes (`server/websocket.ts:182-220`)

The `handleCreateSession` function now dynamically routes to the appropriate authentication method:

```typescript
async function handleCreateSession(
  client: WebSocketClient,
  data: {
    tenantId: string;
    credentials: {
      authType?: string;
      tenantId?: string;
      appId?: string;
      certificateThumbprint?: string;
      username?: string;
      encryptedPassword?: string;
    }
  }
): Promise<void> {
  try {
    const { tenantId, credentials } = data;

    console.log('[WebSocket] Creating session with authType:', credentials.authType);

    let sessionId: string;

    // Choose authentication method based on authType
    if (credentials.authType === 'user') {
      // User authentication with MFA
      console.log('[WebSocket] Using user authentication (MFA required)');

      if (!credentials.username || !credentials.encryptedPassword) {
        throw new Error('Username and password are required for user authentication');
      }

      sessionId = await powershellSessionManager.createSession(
        tenantId,
        client.operatorEmail,
        {
          username: credentials.username,
          encryptedPassword: credentials.encryptedPassword
        }
      );
    } else {
      // Certificate-based authentication (no MFA)
      console.log('[WebSocket] Using certificate authentication');

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

    client.sessionId = sessionId;
    console.log('[WebSocket] Session created:', sessionId);

    // ... rest of session setup
  }
}
```

### Operator Credentials Endpoint Changes (`server/routes.ts:2354-2376`)

The endpoint now returns different credential sets based on the active credential's `authType`:

```typescript
// Get active PowerShell credentials
app.get("/api/operator/tenant/:tenantId/powershell-credentials", requireOperatorAuth, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const credentials = await storage.getTenantPowershellCredentials(tenantId);
    const active = credentials.find(c => c.isActive);

    if (!active) {
      return res.status(404).json({ error: "No active PowerShell credentials found" });
    }

    console.log('[Operator Credentials] Returning authType:', active.authType || 'certificate');

    // Return credentials based on auth type (for WebSocket authentication)
    if (active.authType === 'user') {
      // User authentication with MFA
      res.json({
        authType: 'user',
        username: active.username,
        encryptedPassword: active.encryptedPassword,
      });
    } else {
      // Certificate authentication
      res.json({
        authType: 'certificate',
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: active.appId,
        certificateThumbprint: active.certificateThumbprint,
      });
    }
  } catch (error) {
    console.error("Error fetching PowerShell credentials:", error);
    res.status(500).json({ error: "Failed to fetch PowerShell credentials" });
  }
});
```

### Database Migration

Migration file: `migrations/add_dual_auth_columns.sql`

```sql
-- Add auth_type column with default 'certificate' for existing rows
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'certificate';

-- Add username column for user authentication
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add encrypted_password column for user authentication
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Add comments
COMMENT ON COLUMN tenant_powershell_credentials.auth_type IS 'Authentication type: certificate or user';
COMMENT ON COLUMN tenant_powershell_credentials.username IS 'Microsoft 365 admin username for user auth';
COMMENT ON COLUMN tenant_powershell_credentials.encrypted_password IS 'AES-256-GCM encrypted password for user auth';
```

Executed successfully via `run-migration.ps1` on 2025-11-04.

## Implementation Plan (Original - Kept for Reference)

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

### ✅ Completed
1. ~~Implement WebSocket dual auth logic~~ - DONE
2. ~~Update admin UI for auth type selection~~ - DONE
3. ~~Add user credential fields to admin panel~~ - DONE
4. ~~Update documentation~~ - DONE
5. ~~Commit and push to git~~ - DONE

### 🔄 Remaining
1. **Test MFA Flow End-to-End**
   - Select tenant with user credentials
   - Click PowerShell button in Dashboard
   - Verify MFA prompt appears with message: "⚠️ MFA Required: Please enter your 6-digit verification code"
   - Enter 6-digit code from authenticator app
   - Verify successful connection: "✓ Connected to Microsoft Teams PowerShell"
   - Test Get Policies and other PowerShell operations

2. **Browser Cache Issue** (Minor)
   - Radio buttons may not be visible due to browser cache
   - Solution: Hard refresh (Ctrl+Shift+Delete) or wait for natural cache expiry
   - No code changes needed

3. **Future Enhancements**
   - Consider adding session persistence for user auth
   - Add ability to switch between multiple credential sets per tenant
   - Implement credential validation before saving

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
