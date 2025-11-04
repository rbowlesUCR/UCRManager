# CERT AUTH WORKS - START HERE

## Branch Information
**Branch Name:** `CERT_AUTH_WORKS_START_HERE`
**Commit:** `e2bc003` - "Implement automatic PowerShell policy retrieval on tenant selection"
**Date Created:** November 4, 2025
**Status:** ✅ VERIFIED WORKING VERSION

## Why This Branch Exists

This branch marks the **last known working state** of the application before dual authentication (certificate + user/password) was added. This is the baseline that works correctly.

### What Works in This Version
- User-based authentication with MFA
- PowerShell session management
- Automatic policy retrieval on tenant selection
- Voice configuration assignment
- WebSocket-based PowerShell sessions

### What's NOT in This Version
- Certificate-based authentication (not yet implemented at this commit)
- Dual authentication support
- Database `auth_type` column (doesn't exist yet)

## Timeline Context

This commit is from **BEFORE** these changes were made:
1. `40fb7bb` - Add comprehensive MFA user credentials implementation documentation
2. `c11e1f7` - Add admin endpoint for password encryption and user credentials guide
3. `f18dfd2` - Add admin UI for dual PowerShell authentication (certificate and user)
4. `ea349a9` - Fix dual authentication - add database columns and update endpoints
5. `792053b` - feat: Implement WebSocket dual authentication with MFA support

## When to Use This Branch

Use this branch as your starting point when:
1. **Implementing certificate authentication** - Start from working baseline
2. **Re-implementing dual authentication** - Start from known good state
3. **Debugging authentication issues** - Compare against working version
4. **Rolling back to last working state** - Quick recovery option

## How to Use This Branch

### Switch to This Branch
```bash
cd /c/inetpub/wwwroot/UCRManager
git checkout CERT_AUTH_WORKS_START_HERE
npm run build
pm2 restart ucrmanager
```

### Create New Feature Branch from This
```bash
git checkout CERT_AUTH_WORKS_START_HERE
git checkout -b feature/new-auth-implementation
# Make your changes
git add .
git commit -m "Your changes"
git push -u origin feature/new-auth-implementation
```

## What Changed After This Commit

After `e2bc003`, the following authentication changes were made that caused issues:

### Changes That Broke Authentication
1. **Added dual authentication database schema**
   - Added `auth_type` column to `tenant_powershell_credentials`
   - Required migration of existing data

2. **Split authentication logic**
   - WebSocket handler now routes based on `authType`
   - Two separate session creation paths (user vs certificate)

3. **Added certificate authentication**
   - New `createSessionWithCertificate` method
   - Certificate-based Teams connection
   - No MFA for certificate auth

### Symptoms of the Break
- User authentication stopped prompting for MFA
- Certificate authentication also failed
- Error: `AADSTS50126: Error validating credentials`
- PowerShell sessions closed immediately

## Database State at This Commit

At commit `e2bc003`, the database schema was:

```sql
CREATE TABLE tenant_powershell_credentials (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  username TEXT,
  encrypted_password TEXT,
  app_id UUID,
  certificate_thumbprint TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note:** No `auth_type` column exists yet. This was added in later commits.

## Key Files at This Commit

### Authentication Files
- `server/websocket.ts` - WebSocket handler (single auth path)
- `server/powershell-session.ts` - PowerShell session manager (user auth only)
- `server/routes.ts` - API routes (no dual auth endpoints yet)
- `server/auth.ts` - JWT authentication
- `server/encryption.ts` - Password encryption

### Implementation Details

**WebSocket Connection (websocket.ts):**
```typescript
// Single authentication path - only user/password
const sessionId = await powershellSessionManager.createSession(
  tenantId,
  client.operatorEmail,
  credentials
);
```

**PowerShell Session (powershell-session.ts):**
```typescript
// Only user-based authentication with MFA
private initializeTeamsConnection(
  session: PowerShellSession,
  username: string,
  password: string
): void {
  const commands = `
Connect-MicrosoftTeams -Credential $credential
`;
  this.sendCommand(session.id, commands);
}
```

## Testing This Version

### Test User Authentication
1. Navigate to the application
2. Select a tenant with user credentials configured
3. Connect to PowerShell
4. **Expected:** Prompt for 6-digit MFA code
5. Enter MFA code
6. **Expected:** Successfully connect to Teams

### Verify Working State
Check logs for successful connection:
```bash
pm2 logs ucrmanager --lines 50
```

Look for:
- `[PowerShell] MFA PROMPT DETECTED!` (if debug logging present)
- `CONNECTION SUCCESSFUL!`
- `Teams PowerShell session ready`

## Moving Forward

### To Re-Implement Certificate Auth Correctly

1. **Start from this branch:**
   ```bash
   git checkout CERT_AUTH_WORKS_START_HERE
   git checkout -b feature/certificate-auth-v2
   ```

2. **Add database migration first:**
   ```sql
   ALTER TABLE tenant_powershell_credentials
   ADD COLUMN auth_type TEXT DEFAULT 'user';
   ```

3. **Implement certificate auth in parallel:**
   - Keep existing user auth code working
   - Add new certificate auth code path
   - Test BOTH paths thoroughly before merging

4. **Test each step:**
   - Test user auth still works after each change
   - Test certificate auth works when added
   - Test switching between auth types

### Important Principles

1. **Never break working code** - Add new features without modifying existing working code
2. **Test incrementally** - Don't make multiple large changes at once
3. **Keep this branch pristine** - Never commit directly to CERT_AUTH_WORKS_START_HERE
4. **Always verify** - Test both auth methods after any changes

## Related Documentation

- `START_HERE.md` - Main project reference
- `SESSION_2025_11_04_MFA_INVESTIGATION.md` - Investigation that led to finding this version
- `MFA_USER_CREDENTIALS_IMPLEMENTATION.md` - MFA implementation details
- `POWERSHELL_CERTIFICATE_AUTH.md` - Certificate auth documentation (from later commits)

## Quick Reference

**Checkout this branch:**
```bash
git checkout CERT_AUTH_WORKS_START_HERE
```

**See what changed after this:**
```bash
git log CERT_AUTH_WORKS_START_HERE..feature/auto-refresh-on-tenant-select --oneline
```

**Compare files with later versions:**
```bash
git diff CERT_AUTH_WORKS_START_HERE..feature/auto-refresh-on-tenant-select server/websocket.ts
```

## Summary

✅ This branch represents the **last known working authentication state**
✅ User authentication with MFA works correctly
✅ Use this as baseline for implementing certificate authentication
✅ Do NOT commit directly to this branch - create feature branches from it

**Remember:** This is your safety net. Keep it working, keep it clean, and use it as your starting point for any authentication work.
