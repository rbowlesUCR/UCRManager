# Deployment Guide: Enrollment Pending Flow

**Date**: November 15, 2025
**Feature**: Operator enrollment requiring admin approval
**Commit**: 317f118
**Status**: ✅ Tested on Dev, Ready for Production

---

## Overview

This update changes the operator user enrollment process to require explicit admin approval before granting system access. Previously, any user from the operator tenant who successfully authenticated via Azure AD was automatically granted "user" role access. Now, new users are enrolled in a pending state and must be activated by an administrator.

## What Changed

### Backend Changes

1. **server/routes.ts** - OAuth Callback Handler
   - New users created with `isActive: false` instead of `true`
   - Inactive users receive "pending" role in JWT
   - Inactive users redirected to `/enrollment-pending` instead of `/dashboard`
   - Session endpoint returns pending status for inactive users (allows enrollment page access)

2. **shared/schema.ts** - Type Definitions
   - Added `"pending"` to OperatorSession role type
   - Added `isActive?: boolean` field to OperatorSession interface

### Frontend Changes

1. **client/src/pages/enrollment-pending.tsx** - NEW FILE
   - Displays enrollment pending message
   - Shows user email and instructions to contact admin
   - Auto-refreshes every 30 seconds to check activation status
   - Automatically redirects to dashboard when user is activated
   - Allows sign-out option

2. **client/src/App.tsx** - Routing Updates
   - Added `/enrollment-pending` route
   - Updated ProtectedRoute to redirect pending users to enrollment page
   - Added check for `role === "pending"` or `!isActive`

---

## User Experience Flow

### Before This Update
```
User signs in with Azure AD
    ↓
User automatically created with isActive: true, role: "user"
    ↓
User redirected to /dashboard
    ↓
User has immediate access to system
```

### After This Update
```
User signs in with Azure AD (first time)
    ↓
User created with isActive: false, role: "user"
    ↓
User redirected to /enrollment-pending
    ↓
User sees message: "You have been enrolled in UCRManager. Please request user/admin access from an existing admin."
    ↓
Admin activates user via Admin → Operator Users page
    ↓
Page auto-refreshes and detects activation
    ↓
User redirected to /dashboard
    ↓
User has access to system
```

---

## Production Deployment Steps

### Step 1: Pull Latest Changes

On the production server (20.171.8.14):

```bash
cd /c/inetpub/wwwroot/UCRManager
git pull origin feature/connectwise-integration
```

**Expected output**: Should show commit `317f118` with 4 files changed, 163 insertions, 15 deletions.

### Step 2: Install Dependencies (if needed)

```bash
npm install
```

**Note**: This update does not add new npm dependencies, but it's good practice to run this to ensure all dependencies are in sync.

### Step 3: Build Application

```bash
npm run build
```

**Expected output**:
- Vite build completes successfully
- ESBuild bundles server code
- `dist/index.js` is created/updated
- `dist/public/` directory updated with new frontend assets

### Step 4: Restart Application

```bash
pm2 restart ucrmanager-prod
```

**Verify restart**:
```bash
pm2 status
pm2 logs ucrmanager-prod --lines 20
```

**Expected**: Should see "serving on port 443 (HTTPS)" message with no errors.

### Step 5: Verification

#### 5.1 - Verify Enrollment Page Accessible

```bash
curl -k https://localhost/enrollment-pending
```

**Expected**: Should return HTML content (200 OK).

#### 5.2 - Verify Session Endpoint Handles Pending Users

Create a test inactive user:
```bash
export PGPASSWORD='YOUR_POSTGRES_PASSWORD'
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
INSERT INTO operator_users (azure_user_id, email, display_name, role, is_active)
VALUES ('test-pending-user', 'testpending@example.com', 'Test Pending', 'user', false);
"
```

Test that pending users can access session (for enrollment page):
```bash
# This would require an actual OAuth token for full test
# Manual testing recommended via browser
```

#### 5.3 - Verify Existing Active Users Unaffected

Existing active users should still be able to login and access the system normally without any disruption.

---

## Testing Checklist

Before deploying to production, verify these scenarios on dev:

- [x] New Azure AD user authenticates for first time
- [x] User redirected to `/enrollment-pending` page
- [x] Enrollment page displays correct user email
- [x] Enrollment page shows appropriate messaging
- [x] User cannot access `/dashboard` or other protected routes while inactive
- [x] Admin can see new pending user in Operator Users management page
- [x] Admin can activate user by toggling `isActive` to true
- [x] Enrollment page auto-refreshes and detects activation
- [x] User automatically redirected to dashboard after activation
- [x] Existing active users continue to work normally
- [x] User can sign out from enrollment pending page

---

## Database Impact

### No Schema Changes Required

This update does **NOT** require any database migrations. It uses the existing `is_active` column in the `operator_users` table.

**Existing Schema**:
```sql
CREATE TABLE operator_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    azure_user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,  -- Uses this existing column
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Behavior Change

- **Before**: `is_active` defaulted to `true`, but wasn't actively enforced in auth flow
- **After**: `is_active` explicitly set to `false` for new users, enforced in auth flow

### Impact on Existing Users

**Zero impact** - All existing operator users in the database already have `is_active: true` and will continue to function normally.

---

## Admin Workflow Changes

### Activating Pending Users

Admins will now need to activate new operator users manually:

1. Navigate to **Admin → Operator Users** page
2. Look for users with **Inactive** status
3. Click edit/toggle to set user to **Active**
4. User will automatically gain access on their next page refresh (or within 30 seconds)

### Notification Strategy

**Important**: This system does NOT send email notifications to admins when new users enroll. Consider implementing one of these notification strategies:

- **Manual Check**: Admins periodically check the Operator Users page for pending users
- **Future Enhancement**: Add email notification when new user enrolls (requires SMTP configuration)
- **Future Enhancement**: Add dashboard widget showing pending user count for admins

---

## Rollback Procedure

If issues arise after deployment, rollback steps:

### Quick Rollback (Revert to Previous Deployment)

```bash
cd /c/inetpub/wwwroot/UCRManager

# Revert to previous commit (before 317f118)
git revert 317f118 --no-edit

# Rebuild and restart
npm run build
pm2 restart ucrmanager-prod
```

### Temporary Workaround (Database Fix)

If you need to quickly grant access to pending users without rolling back code:

```bash
# Activate all pending users (emergency only)
export PGPASSWORD='YOUR_POSTGRES_PASSWORD'
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
UPDATE operator_users SET is_active = true WHERE is_active = false;
"
```

---

## Security Considerations

### Improved Security

This update **improves security** by:
- Preventing unauthorized Azure AD users from gaining automatic system access
- Requiring explicit admin approval before granting permissions
- Allowing admins to review user identity before activation
- Providing an audit trail of user enrollment (via operator_users table)

### Potential Concerns

- **Admin Availability**: If no admin is available to activate users, new users will be blocked
- **User Friction**: New users experience a waiting period, which may cause support requests
- **Social Engineering**: Users might contact multiple admins claiming they need urgent access

**Mitigation**: Establish clear procedures for user activation and communicate expected wait times.

---

## Support & Troubleshooting

### Issue: User Stuck on Enrollment Page

**Symptoms**: User sees enrollment pending page but admin has already activated them.

**Solution**:
1. Verify user is actually active in database:
   ```sql
   SELECT email, is_active FROM operator_users WHERE email = 'user@example.com';
   ```
2. If `is_active = true`, ask user to:
   - Hard refresh browser (Ctrl+Shift+R)
   - Clear cookies and sign in again
   - Wait for auto-refresh (30 seconds)

### Issue: User Cannot Access Enrollment Page

**Symptoms**: User gets 401/403 error when trying to access `/enrollment-pending`.

**Cause**: The enrollment page does NOT require authentication - anyone can view it. However, it shows user-specific info only if a valid session exists.

**Solution**: Check PM2 logs for authentication errors:
```bash
pm2 logs ucrmanager-prod | grep -i error
```

### Issue: Admin Cannot Find Pending Users

**Symptoms**: Admin doesn't see newly enrolled users in Operator Users page.

**Solution**:
1. Check if user successfully authenticated:
   ```sql
   SELECT * FROM operator_users ORDER BY created_at DESC LIMIT 5;
   ```
2. If user exists but not showing, check for frontend query cache issues
3. Hard refresh admin panel (Ctrl+Shift+R)

---

## Future Enhancements

Consider these improvements for future iterations:

1. **Email Notifications**
   - Notify admins when new users enroll
   - Notify users when they're activated
   - Requires SMTP configuration

2. **Auto-Approval Rules**
   - Allow specific email domains to auto-approve
   - Auto-approve users from specific Azure AD groups
   - Time-based auto-approval (e.g., business hours only)

3. **Enrollment Requests**
   - Allow users to submit justification/reason for access
   - Collect additional metadata during enrollment
   - Integration with ticketing system (ConnectWise)

4. **Admin Dashboard Widget**
   - Show pending user count on admin dashboard
   - One-click activation from dashboard
   - Bulk activation for multiple users

5. **Audit Trail**
   - Log which admin activated each user
   - Track time between enrollment and activation
   - Report on pending user metrics

---

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `server/routes.ts` | Modified OAuth callback and session logic | ~50 lines |
| `shared/schema.ts` | Added "pending" role and isActive field | ~3 lines |
| `client/src/App.tsx` | Added enrollment route and pending redirect | ~15 lines |
| `client/src/pages/enrollment-pending.tsx` | NEW FILE - Enrollment pending page | 106 lines |

**Total Impact**: 4 files, 163 insertions, 15 deletions

---

## Production Deployment Checklist

Before deploying to production (ucrmanager01.westus3.cloudapp.azure.com):

- [x] Changes tested on dev server (20.168.122.70)
- [x] Changes committed to Git (commit 317f118)
- [x] Changes pushed to GitHub repository
- [ ] Production team notified of deployment
- [ ] Deployment window scheduled (if needed)
- [ ] Backup of production database taken
- [ ] Current PM2 process status documented
- [ ] Pull latest changes on production server
- [ ] Run `npm install` on production server
- [ ] Run `npm run build` on production server
- [ ] Restart PM2 process on production server
- [ ] Verify enrollment page loads correctly
- [ ] Test with real Azure AD user (if possible)
- [ ] Verify existing active users unaffected
- [ ] Monitor PM2 logs for errors (first 10 minutes)
- [ ] Document deployment completion time
- [ ] Notify stakeholders of successful deployment

---

## Deployment Timeline

**Estimated Deployment Time**: 10-15 minutes

1. Pull changes: 1 minute
2. Install dependencies: 2-3 minutes
3. Build application: 1-2 minutes
4. Restart PM2: 30 seconds
5. Verification: 5 minutes
6. Testing: 5 minutes

**Downtime**: ~30 seconds (during PM2 restart only)

---

## Contact & Support

**Deployment Author**: Dev Claude
**Date Created**: November 15, 2025
**Git Commit**: 317f118
**Branch**: feature/connectwise-integration

For questions or issues related to this deployment:
- Review Git commit history: `git log 317f118 -p`
- Check DEPLOYMENT_SUMMARY_FINAL.md for production deployment history
- Review PRODUCTION_MIGRATION_RUNBOOK.md for general deployment procedures

---

**Deployment Status**: ✅ Ready for Production
**Risk Level**: Low (no database changes, graceful degradation for existing users)
**Recommended Deployment Window**: Any time (no downtime beyond PM2 restart)
