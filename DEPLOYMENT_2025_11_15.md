# Production Deployment - November 15, 2025

## Summary

This deployment includes ConnectWise enhancements and phone number management improvements.

## New Features

### 1. ConnectWise Work Role Selection
- **What**: Dynamic work role selection for time entries
- **Why**: Previously hardcoded to "UCRight Engineer" - not suitable for all tickets/operators
- **How**: Fetches available work roles from ConnectWise API and displays in dropdown
- **Filter**: Only shows work roles starting with "UCRight" or "Salient"
- **Fallback**: Uses "UCRight Engineer" if no role selected

### 2. Column Customization for Number Inventory
- **What**: Full column show/hide and reordering
- **Features**:
  - "Customize Columns" button with settings icon
  - Checkboxes to show/hide any column
  - Up/down arrows to reorder columns
  - Notes column available (hidden by default) to view assignment history
- **Impact**: Users can personalize their view

### 3. Phone Number History Tracking
- **What**: Automatic tracking of all number assignments/releases in notes field
- **Tracks**: Assignments, releases, removals, bulk operations
- **Format**: `[2025-11-15T16:29:56.123Z] Action description`

### 4. Bug Fixes
- Fixed old number release bug (numbers stayed "used" when replaced)
- Fixed ConnectWise time entry emoji bug (JSON parse errors)
- Filtered ConnectWise statuses to relevant options only

## Database Changes

**No schema changes required** - Uses existing `notes` field in `phone_number_inventory` table.

## Deployment Instructions

### On Production Server (20.168.122.70):

```powershell
# 1. Navigate to application directory
cd C:\inetpub\wwwroot\UCRManager

# 2. Stop the application
pm2 stop ucrmanager

# 3. Backup current version
git stash
git branch backup-before-nov-15-deploy

# 4. Pull latest code
git checkout main
git pull origin main

# 5. Install dependencies (if package.json changed)
npm install

# 6. Build application
npm run build

# 7. Start application
pm2 start ucrmanager

# 8. Verify startup
pm2 logs ucrmanager --lines 50
```

### Verification Steps:

1. **Work Role Selection**:
   - Login as admin
   - Navigate to Dashboard
   - Select tenant with ConnectWise enabled
   - Select a user
   - Enter a ConnectWise ticket number
   - Verify "Select Work Role" dropdown appears below status dropdown
   - Verify only UCRight and Salient roles are shown
   - Test logging time with a selected work role

2. **Column Customization**:
   - Navigate to Number Management
   - Click "Customize Columns" button
   - Test show/hide functionality
   - Test column reordering with up/down arrows
   - Verify Notes column available (shows assignment history)

3. **Number History**:
   - Assign a phone number to a user
   - Go to Number Management
   - Show the Notes column
   - Verify assignment is logged with timestamp

## Rollback Plan

If issues occur:

```powershell
# Stop application
pm2 stop ucrmanager

# Rollback to previous version
git checkout backup-before-nov-15-deploy

# Rebuild and restart
npm run build
pm2 start ucrmanager
```

## Files Changed

### Backend:
- `server/connectwise.ts` - Added getWorkRoles(), updated addTimeEntry()
- `server/routes.ts` - Added work-roles endpoint, phone number history tracking
- `server/debug-routes.ts` - New debug endpoints

### Frontend:
- `client/src/pages/dashboard.tsx` - Work role dropdown, enhanced logging
- `client/src/pages/number-management.tsx` - Column customization, search
- `client/src/components/connectwise-ticket-search.tsx` - New component

### Documentation:
- `SESSION_STATUS.md` - Complete feature documentation
- Multiple deployment guides and status documents

## Git Commits

- `ba0a148` - docs: Update SESSION_STATUS with complete work role implementation
- `cd53e06` - feat: Filter work roles to UCRight and Salient only
- `78e1d67` - feat: Implement complete work role backend for ConnectWise
- Plus 65+ files from feature branch merge

## Support

If issues arise during or after deployment:
1. Check PM2 logs: `pm2 logs ucrmanager`
2. Check browser console for frontend errors
3. Test ConnectWise API connectivity
4. Verify environment variables are set correctly

## Post-Deployment Tasks

- [ ] Monitor PM2 logs for errors
- [ ] Test work role selection with actual tickets
- [ ] Verify time entries appear correctly in ConnectWise
- [ ] Test column customization with operators
- [ ] Monitor phone number assignment history

---

**Deployment Date**: November 15, 2025
**Deployed By**: Randy Bowles
**Production Server**: 20.168.122.70
**Branch**: main (merged from feature/connectwise-enhancements)
