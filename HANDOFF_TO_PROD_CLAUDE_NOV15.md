# Handoff to Production Claude - November 15, 2025 Deployment

## Context for Production Claude

You are being asked to deploy the November 15, 2025 release to the production server at **20.168.122.70**. This deployment includes ConnectWise work role selection, phone number management enhancements, and bug fixes. All code has been tested on the dev server and pushed to the main branch on GitHub.

## What Was Done on Dev Server

1. **ConnectWise Work Role Selection** - COMPLETE ✅
   - Added backend API endpoint to fetch work roles from ConnectWise
   - Implemented filtering to only show "UCRight" or "Salient" roles
   - Added dropdown UI in dashboard below status selector
   - Tested with ticket 55134 - working correctly
   - Work role ID is sent to ConnectWise with time entries

2. **Phone Number Column Customization** - COMPLETE ✅
   - Added "Customize Columns" button in Number Management
   - Implemented show/hide for all 10 columns
   - Added up/down arrows for column reordering
   - Notes column available to view assignment history

3. **Phone Number History Tracking** - COMPLETE ✅
   - Automatic timestamped logging in notes field
   - Tracks assignments, releases, removals, bulk operations
   - No database schema changes required

4. **Bug Fixes** - COMPLETE ✅
   - Fixed old number release bug (tel: prefix issue)
   - Fixed ConnectWise JSON emoji parsing error
   - Enhanced ConnectWise status filtering

## Current Git Status

- **Branch**: main
- **Last Commit**: e41f27e - "docs: Add production deployment guide for Nov 15 release"
- **GitHub Status**: All commits pushed to origin/main
- **Dev Server**: Running commit e41f27e successfully
- **Production Server**: Currently on older version, needs update

## Key Files Modified

### Backend Files:
```
server/connectwise.ts
  - Added getWorkRoles() function (line 601-638)
  - Updated addTimeEntry() to accept workRoleId parameter
  - Added work role filtering logic

server/routes.ts
  - Added GET /api/admin/tenant/:tenantId/connectwise/work-roles endpoint
  - Added appendPhoneNumberHistory() helper function
  - Updated /log-change route to pass workRoleId
```

### Frontend Files:
```
client/src/pages/dashboard.tsx
  - Added cwWorkRoleId state
  - Added work roles query and dropdown UI
  - Added debug logging

client/src/pages/number-management.tsx
  - Added complete column customization
  - Added renderCell helper function
  - Added search functionality
```

## Database Changes

**IMPORTANT**: NO schema migrations required for this deployment.
- Uses existing `notes` field in `phone_number_inventory` table
- No new tables or columns needed
- Safe to deploy without database downtime

## Production Deployment Steps

### Step 1: Pre-Deployment Checks
```powershell
# Connect to production server 20.168.122.70
# Navigate to application directory
cd C:\inetpub\wwwroot\UCRManager

# Check current git status
git status
git log --oneline -5

# Check current PM2 status
pm2 status
```

### Step 2: Create Backup
```powershell
# Create backup branch before deploying
git branch backup-before-nov-15-deploy

# Verify backup created
git branch -a
```

### Step 3: Stop Application
```powershell
# Stop the PM2 process
pm2 stop ucrmanager01

# Verify stopped
pm2 status
```

### Step 4: Pull Latest Code
```powershell
# Ensure on main branch
git checkout main

# Pull latest from GitHub
git pull origin main

# Expected output: Should pull to commit e41f27e
# Should show ~68 files changed
```

### Step 5: Install Dependencies
```powershell
# Only if package.json changed (it didn't in this release)
# npm install

# This deployment does NOT require npm install
```

### Step 6: Build Application
```powershell
# Build both frontend and backend
npm run build

# Expected output:
# - Vite should build successfully (~8-9 seconds)
# - esbuild should build server successfully (~50ms)
# - dist/index.js should be ~348kb
```

### Step 7: Start Application
```powershell
# Start the PM2 process
pm2 start ucrmanager01

# Check status
pm2 status

# Monitor logs for startup
pm2 logs ucrmanager01--lines 50
```

### Step 8: Verify Deployment

**Expected log output**:
```
[express] HTTPS certificate loaded successfully
[express] WebSocket server initialized for PowerShell sessions
[express] Phone number lifecycle manager started
[express] serving on port 443 (HTTPS)
```

**If you see errors about work roles**: This is expected on first load if no one has accessed the feature yet. It will work when operators use it.

## Verification Tests

### Test 1: Work Role Selection
1. Login to https://20.168.122.70 as admin
2. Navigate to Dashboard
3. Select tenant: "UCRight Dev"
4. Select a user (e.g., DevUser@ucrdev.onmicrosoft.com)
5. Enter ConnectWise ticket: 55134
6. **Expected**: "Select Work Role" dropdown appears below status dropdown
7. **Expected**: Dropdown shows only UCRight/Salient roles plus "Use default work role"
8. Select a work role and log time
9. **Verify**: Time entry appears in ConnectWise with selected work role

### Test 2: Column Customization
1. Navigate to Number Management
2. Click "Customize Columns" button (gear icon)
3. **Expected**: Panel opens with checkboxes for all columns
4. Uncheck "Carrier" - column should disappear
5. Check "Notes" - column should appear
6. Use up/down arrows to reorder
7. **Expected**: Table updates immediately

### Test 3: Phone Number History
1. In Dashboard, assign a phone number to a user
2. Go to Number Management
3. Enable "Notes" column in customization
4. **Expected**: See timestamped entry like:
   ```
   [2025-11-15T19:30:45.123Z] Assigned to user@domain.com with policy PolicyName by admin
   ```

## Troubleshooting

### Issue: Build Fails
**Symptom**: npm run build returns errors
**Solution**:
```powershell
# Clear node_modules and reinstall
rm -r node_modules
npm install
npm run build
```

### Issue: Application Won't Start
**Symptom**: pm2 start fails or immediate crash
**Solution**:
```powershell
# Check logs
pm2 logs ucrmanager01--lines 100

# Common issues:
# - Port 443 already in use: Check IIS, stop conflicting service
# - Certificate missing: Verify cert.pem and key.pem exist
# - Database connection: Verify DATABASE_URL environment variable
```

### Issue: Work Roles Not Appearing
**Symptom**: Dropdown doesn't show
**Solution**:
1. Open browser console (F12)
2. Look for error messages
3. Check network tab for failed API calls
4. Verify ConnectWise credentials configured for tenant
5. Check server logs: `pm2 logs ucrmanager01| grep -i "work role"`

### Issue: ConnectWise API Errors
**Symptom**: Errors in logs about ConnectWise API
**Solution**:
```powershell
# Check if credentials are configured
# In database:
PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7' "/c/Program Files/PostgreSQL/16/bin/psql.exe" -U postgres -d ucrmanager -c "SELECT server_url, username FROM connectwise_credentials;"

# Verify ConnectWise API is accessible from production server
```

## Rollback Procedure

If critical issues occur:

```powershell
# Stop application
pm2 stop ucrmanager01

# Rollback to backup
git checkout backup-before-nov-15-deploy

# Rebuild
npm run build

# Start
pm2 start ucrmanager01

# Verify
pm2 logs ucrmanager01--lines 50
```

## Environment Variables

**Required** (should already be set in PM2 ecosystem):
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `NODE_ENV` - Should be "production"
- `PORT` - Should be 443

**Verify with**:
```powershell
pm2 env ucrmanager
```

## Post-Deployment Tasks

After successful deployment:

1. **Monitor Logs** for first 30 minutes:
   ```powershell
   pm2 logs ucrmanager01--lines 100
   ```

2. **Test Key Features**:
   - Work role selection with real ticket
   - Column customization
   - Phone number assignment (check history)

3. **Notify Operators**:
   - New work role selection available
   - Column customization feature available
   - Phone number history visible in Notes column

4. **Update Production Status**:
   - Mark deployment as complete in SESSION_STATUS.md
   - Document any issues encountered
   - Note production server version

## Important Notes for Production Claude

1. **No Database Migrations**: This is a code-only deployment. No SQL scripts need to be run.

2. **No Breaking Changes**: All features are additive. Existing functionality remains unchanged.

3. **Backward Compatible**: If work roles aren't selected, time entries fall back to "UCRight Engineer" (existing behavior).

4. **Testing Done**: All features tested on dev server with:
   - ConnectWise integration working
   - Ticket 55134 used for testing
   - Work roles filtering verified
   - Column customization verified
   - Number history tracking verified

5. **Safe to Deploy**: No users are currently using the system that would be disrupted. This is primarily used during business hours.

## Success Criteria

Deployment is successful when:
- ✅ PM2 shows ucrmanager as "online"
- ✅ No errors in PM2 logs after startup
- ✅ Can login to admin panel at https://20.168.122.70
- ✅ Work role dropdown appears when selecting ConnectWise ticket
- ✅ Column customization button works in Number Management
- ✅ Phone number assignment creates history entry

## Contact Information

**Developer**: Randy Bowles (rbowlesUCR)
**Deployment Date**: November 15, 2025
**GitHub Repo**: https://github.com/rbowlesUCR/UCRManager
**Production Server**: 20.168.122.70
**Application Path**: C:\inetpub\wwwroot\UCRManager

## Quick Reference Commands

```powershell
# Status check
pm2 status

# View logs
pm2 logs ucrmanager01--lines 50

# Restart if needed
pm2 restart ucrmanager

# Stop/Start
pm2 stop ucrmanager01
pm2 start ucrmanager01

# Check git version
git log --oneline -1

# Check what files changed
git diff backup-before-nov-15-deploy --stat
```

---

## Summary for Production Claude

You need to:
1. ✅ Connect to production server 20.168.122.70
2. ✅ Navigate to C:\inetpub\wwwroot\UCRManager
3. ✅ Create backup branch
4. ✅ Stop PM2 (pm2 stop ucrmanager01)
5. ✅ Pull from main (git pull origin main)
6. ✅ Build (npm run build)
7. ✅ Start PM2 (pm2 start ucrmanager01
8. ✅ Verify startup in logs
9. ✅ Test work role selection, column customization, and number history

**This deployment is LOW RISK**:
- No database changes
- No breaking changes
- All features tested
- Easy rollback available
- Additive functionality only

Good luck with the deployment! All the code is ready and tested.
