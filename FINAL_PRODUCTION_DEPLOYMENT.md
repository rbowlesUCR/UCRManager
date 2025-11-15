# Final Production Deployment - All Features

**Date**: November 15, 2025
**Server**: ucrmanager01.westus3.cloudapp.azure.com (20.171.8.14)
**Status**: ✅ Ready to Deploy

---

## Quick Summary

Deploying **3 features** to production:

1. ✅ **Enrollment Pending Flow** - New users require admin approval
2. ✅ **User Activation Fix** - Fixed 400 error when activating users
3. ✅ **Rebranding** - "UCRManager" title, "Teams Voice Manager" sections

**Total Changes**: 9 files modified, 1 new page created
**Git Commits**: 317f118, 7494714, 732579e, 821ad28, aa58c16
**Database Changes**: None (uses existing schema)
**Downtime**: ~30 seconds (PM2 restart only)

---

## 5-Step Deployment Process

### Step 1: Navigate and Pull

```bash
cd /c/inetpub/wwwroot/UCRManager
git pull origin feature/connectwise-integration
```

**Expected**: Should show 5 commits pulled, ~10 files changed

### Step 2: Install Dependencies

```bash
npm install
```

**Note**: No new dependencies, but ensures sync

### Step 3: Build Application

```bash
npm run build
```

**Expected**:
- Vite build completes in ~8-10 seconds
- No errors
- `dist/index.js` created (~344KB)

### Step 4: Restart Application

```bash
pm2 restart ucrmanager-prod
```

**Expected**: Process restarts with status "online"

### Step 5: Verify Deployment

```bash
pm2 logs ucrmanager-prod --lines 20
```

**Expected**: See "serving on port 443 (HTTPS)" with no errors

---

## Verification Tests

### Test 1: Check Server Status

```bash
pm2 status
```

**Expected**: `ucrmanager-prod` shows status "online"

### Test 2: Test Admin Login

```bash
curl -k -X POST https://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected**: `{"success":true}`

### Test 3: Verify Enrollment Page

```bash
curl -k https://localhost/enrollment-pending
```

**Expected**: HTML page returned (200 OK)

### Test 4: Test User Activation (Optional)

```bash
# Login as admin first
curl -k -X POST https://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c /tmp/admin_cookies.txt

# Test getting operator users
curl -k https://localhost/api/admin/operator-users \
  -b /tmp/admin_cookies.txt
```

**Expected**: JSON array of users

### Test 5: Verify Rebranding

Open browser and check:
- Browser tab shows "UCRManager" (not "Teams Voice Manager")
- Login page shows "UCRManager" as title
- Navigation tab shows "Teams Voice Manager" (not "Voice Configuration")

---

## What Changed - Detailed Breakdown

### Feature 1: Enrollment Pending Flow

**Files Modified:**
- `server/routes.ts` - OAuth callback creates inactive users
- `shared/schema.ts` - Added "pending" role type
- `client/src/App.tsx` - Added enrollment route
- `client/src/pages/enrollment-pending.tsx` - NEW FILE

**User Experience:**
- New users see enrollment pending page after Azure AD login
- Page auto-refreshes every 30 seconds
- Automatically redirects to dashboard when activated
- Existing active users unaffected

### Feature 2: User Activation Fix

**Files Modified:**
- `server/routes.ts` - Made role parameter optional
- `client/src/pages/admin-operator-users.tsx` - Removed role: undefined

**Fix:**
- Admins can now toggle user active/inactive without errors
- Required for enrollment pending flow to work

### Feature 3: Rebranding

**Files Modified:**
- `client/index.html` - Browser title
- `client/src/pages/operator-login.tsx` - Login page
- `client/src/components/admin-layout.tsx` - Admin header
- `client/src/components/layout.tsx` - Operator header + nav
- `client/src/pages/dashboard.tsx` - Page titles
- `client/src/components/bulk-assignment-dialog.tsx` - Dialog title
- `client/src/pages/admin-settings.tsx` - Settings section

**Changes:**
- "Teams Voice Manager" → "UCRManager" (main title)
- "Voice Configuration" → "Teams Voice Manager" (sections)

---

## Database Impact

**Schema Changes**: ✅ NONE

This deployment uses existing database schema:
- `operator_users.is_active` - Already exists
- `operator_users.role` - Already exists
- All tables and columns already present

**No migrations needed!**

---

## Rollback Procedure

If issues arise:

```bash
cd /c/inetpub/wwwroot/UCRManager

# Revert all commits
git revert aa58c16 821ad28 732579e 7494714 317f118 --no-edit

# Rebuild and restart
npm run build
pm2 restart ucrmanager-prod
```

**Time to rollback**: ~2 minutes

---

## Expected Timeline

| Step | Duration | Downtime |
|------|----------|----------|
| Pull changes | 30 seconds | No |
| npm install | 2-3 minutes | No |
| Build | 10 seconds | No |
| PM2 restart | 30 seconds | **YES** |
| Verification | 2 minutes | No |
| **TOTAL** | **~6 minutes** | **30 seconds** |

---

## Post-Deployment Actions

### Immediate (Next 10 minutes)

1. ✅ Monitor PM2 logs for errors
2. ✅ Test admin login via browser
3. ✅ Verify existing users can login
4. ✅ Check enrollment page loads

### Within 1 Hour

1. ⏳ Notify admins about new enrollment process
2. ⏳ Document admin workflow for activating users
3. ⏳ Monitor for any user-reported issues

### Ongoing

1. ⏳ Check Operator Users page for pending enrollments
2. ⏳ Activate legitimate new users
3. ⏳ Monitor audit logs for anomalies

---

## Admin Notification Template

**Subject**: UCRManager Updated - New User Enrollment Process

**Message**:
```
UCRManager has been updated with the following changes:

1. NEW ENROLLMENT PROCESS:
   - New users are now enrolled as "pending" and require admin approval
   - Check Admin → Operator Users regularly for pending users
   - Toggle users to "Active" to grant access

2. REBRANDING:
   - Application now shows "UCRManager" as the main title
   - Voice configuration section renamed to "Teams Voice Manager"

3. BUG FIX:
   - User activation toggle now works correctly

No action needed for existing active users.
```

---

## Troubleshooting

### Issue: Build Fails

```bash
rm -rf dist node_modules
npm install
npm run build
```

### Issue: PM2 Won't Restart

```bash
pm2 stop ucrmanager-prod
pm2 delete ucrmanager-prod
pm2 start ecosystem.config.cjs
pm2 save
```

### Issue: Users Can't Login

Check PM2 logs:
```bash
pm2 logs ucrmanager-prod --err --lines 50
```

Check database connection:
```bash
export PGPASSWORD='de026eed3c534297bf25eb8c21073f2d'
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "SELECT 1;"
```

---

## Success Criteria

Deployment is successful when:

- ✅ PM2 shows status "online"
- ✅ No errors in PM2 logs
- ✅ Admin can login via browser
- ✅ Browser tab shows "UCRManager"
- ✅ Navigation shows "Teams Voice Manager"
- ✅ Enrollment pending page loads
- ✅ Existing users can login normally

---

## Commits Being Deployed

```
aa58c16 - Rebrand application: UCRManager title, Teams Voice Manager sections
821ad28 - Add step-by-step production deployment instructions
732579e - Fix 400 error when toggling operator user active status
7494714 - Add deployment guide for enrollment pending flow
317f118 - Implement enrollment pending flow for new operator users
```

---

## Files Changed Summary

**Modified Files (8):**
- `server/routes.ts`
- `shared/schema.ts`
- `client/src/App.tsx`
- `client/index.html`
- `client/src/pages/operator-login.tsx`
- `client/src/components/admin-layout.tsx`
- `client/src/components/layout.tsx`
- `client/src/pages/dashboard.tsx`
- `client/src/components/bulk-assignment-dialog.tsx`
- `client/src/pages/admin-settings.tsx`
- `client/src/pages/admin-operator-users.tsx`

**New Files (1):**
- `client/src/pages/enrollment-pending.tsx`

---

## Final Checklist

Before starting deployment:

- [x] All changes tested on dev server
- [x] All commits pushed to GitHub
- [x] No database migrations required
- [x] Rollback procedure documented
- [x] Admin notification prepared
- [ ] Production server ready
- [ ] Production Claude ready to execute

---

**Status**: ✅ READY TO DEPLOY
**Risk Level**: LOW
**Recommended Time**: Any time (minimal downtime)

🚀 Ready for immediate production deployment!
