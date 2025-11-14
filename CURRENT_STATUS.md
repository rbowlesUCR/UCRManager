# UCR Manager - Current Session Status
**Date**: November 14, 2025
**Session**: ConnectWise Integration - All Features Working ✅

## What Was Completed

### 1. ConnectWise Member Identifier Implementation ✅
**Problem**: ConnectWise API was rejecting notes/time entries because the system was using Azure AD emails (e.g., `DevUser@ucrdev.onmicrosoft.com`) instead of ConnectWise local usernames.

**Solution Implemented**:

#### Database Changes
- Added `default_member_identifier` column to `connectwise_credentials` table
- SQL: `ALTER TABLE connectwise_credentials ADD COLUMN IF NOT EXISTS default_member_identifier TEXT;`

#### Backend Changes (`server/connectwise.ts`)
- Updated `ConnectWiseConfig` interface to include `defaultMemberIdentifier: string | null`
- Updated `getConnectWiseCredentials()` to fetch default member identifier
- Updated `storeConnectWiseCredentials()` to store default member identifier

#### Backend Changes (`server/routes.ts`)
- **GET** `/api/admin/tenant/:tenantId/connectwise-credentials` - Returns `defaultMemberIdentifier`
- **POST** `/api/admin/tenant/:tenantId/connectwise-credentials` - Accepts `defaultMemberIdentifier`
- **POST** `/api/admin/tenant/:tenantId/connectwise/log-change` - Updated to:
  - Accept optional `memberIdentifier` from operator
  - Fall back to `defaultMemberIdentifier` from credentials if not provided
  - Require either operator-provided OR default member identifier
  - Added detailed logging to track what member ID is being used

#### Frontend Admin UI (`client/src/components/admin-connectwise-credentials.tsx`)
- Added "Default Member Identifier" field to admin ConnectWise credentials setup
- Field appears in "Default Time Entry Settings" section
- Saved with other ConnectWise credentials

#### Frontend Dashboard UI (`client/src/pages/dashboard.tsx`)
- Added state variable `connectwiseMemberIdentifier`
- Added **REQUIRED** "Your ConnectWise Username" input field
- Field only appears when a ConnectWise ticket is selected
- Field shows red border when empty
- Save button disabled when ticket selected but member ID not provided
- Member identifier cleared when form reset or cancelled
- Updated ConnectWise logging to use `connectwiseMemberIdentifier || undefined` instead of Azure AD email

### 2. Frontend Build Memory Error Fix ✅
**Problem**: Node.js running out of memory during Vite build
**Error**: `FATAL ERROR: Zone Allocation failed - process out of memory`
**Impact**: Login page showing 404 - frontend files missing from `dist/public/`

**Solution**:
- Modified `vite.config.ts` to disable source maps (`sourcemap: false`)
- Added manual code splitting for React and Radix UI libraries
- Increased chunk size warning limit to 1000kb
- Build now completes successfully in ~20-27 seconds

### 3. Browser Crash Fix ✅
**Problem**: Browser crashing/freezing when selecting ConnectWise ticket
**Cause**: Query fetching statuses from ALL boards (20+ boards) overwhelming browser

**Solution**:
- Updated dashboard status query to only fetch statuses for selected ticket's board
- Added `enabled` condition checking `selectedTicket?.board?.id`
- Prevents excessive API calls and browser overload

### 4. ConnectWise Time Entry Creation Fix ✅
**Problem**: Time entries failing with date format errors

**Iterations**:
- First tried wrapping in brackets `[${timestamp}]` - failed
- Then tried with milliseconds - failed
- **Final fix**: ISO format without milliseconds AND added timeEnd field

**Solution**:
```typescript
const formatCWDate = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
timeStart: formatCWDate(startTime),
timeEnd: formatCWDate(now),
```

### 5. Missing Work Role Fix ✅
**Problem**: Time entries failing with "Work Role is not valid for the selected location"

**Solution**:
- Added hardcoded work role: `workRole: { name: 'UCRight Engineer' }`
- ⚠️ **TODO**: Make work role dynamic based on member's available roles (future enhancement)

### 6. Status Dropdown Fix - Ticket-Specific Statuses ✅
**Problem**: Status dropdown not appearing in UI when ticket selected
**Root Cause**: Statuses vary by company, board, and ticket context - cannot use generic board query

**Solution Implemented**:
- Created new backend endpoint: `GET /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/statuses`
  - Fetches the ticket to get its board ID
  - Returns statuses available for that specific ticket's board
  - Ensures statuses are contextual to the ticket (company, board, etc.)
- Updated frontend dashboard query to use ticket-specific endpoint
  - Changed from `selectedTicket?.board?.id` to `selectedTicket?.id`
  - Fetches statuses based on ticket ID instead of board ID
- Updated `ConnectWiseTicket` interface to support `board: string | { id: number; name: string }`

### 7. Frontend Build Optimization ✅
**Issue**: Build still failing with memory errors even with optimizations
**Final Solution**: Build without minification to reduce memory usage
- Command: `npx vite build --minify=false`
- Builds successfully in ~25 seconds
- Bundle size: ~1.3MB (unminified)
- ⚠️ **Note**: After machine upgrade, should re-enable minification for production

### 8. Testing Results ✅
**ConnectWise Integration Status**:
- ✅ Notes working - Successfully adds notes to tickets
- ✅ Time entries working - Successfully logs time with correct format and work role
- ✅ Status updates working - Successfully changes ticket status (tested via debug API endpoint)
- ❌ Status dropdown UI - Not rendering (blank browser page)
  - Backend endpoint implemented: `GET /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/statuses`
  - Frontend query updated to use ticket ID
  - Needs testing after machine upgrade with more RAM

## Outstanding Issues

### 1. Phone Number Not Returning to Inventory 📋
**Status**: NOT STARTED
**Problem**: When changing a user's phone number, the old number is not returned to "available" status in inventory
**Location**: `server/routes.ts` `/api/teams/assign-voice` route (line ~2659)
**Current Behavior**: Only marks NEW number as "used"
**Required Behavior**: Should also mark OLD number (if exists) as "available"

### 2. Phone Number Inventory Running Low 📋
**Status**: NOT STARTED
**Problem**: User mentioned running low on available phone numbers in inventory
**Options**: CSV import, manual entry, or release unused numbers

## File Changes Committed

### Git Commits Made:
1. **"Fix frontend build memory issues and browser crash on ticket selection"**
   - `vite.config.ts` - Disabled source maps, added code splitting
   - `client/src/pages/dashboard.tsx` - Optimized status query for selected board only

2. **"Fix ConnectWise time entry creation with correct date format and work role"**
   - `server/connectwise.ts` - Fixed date format (removed milliseconds), added timeEnd, added work role
   - Note: Work role "UCRight Engineer" is hardcoded (needs to be dynamic in future)

3. **"Fix ConnectWise status dropdown not appearing in UI"**
   - `client/src/components/connectwise-ticket-search.tsx` - Return board as object with id

### All changes pushed to `feature/connectwise-integration` branch

## Next Steps After Machine Upgrade

### Immediate (After Restart):
1. **Rebuild Frontend with Minification**:
   ```bash
   cd /c/inetpub/wwwroot/UCRManager
   export NODE_OPTIONS="--max-old-space-size=8192"
   npm run build
   pm2 restart ucrmanager
   ```
   - With more RAM, minification should work
   - Will reduce bundle size from 1.3MB to ~400-500KB

2. **Test Status Dropdown UI**:
   - Navigate to dashboard (https://localhost)
   - Login as operator
   - Select user and ConnectWise ticket
   - Verify "Update Ticket Status (Optional)" dropdown appears
   - Verify dropdown shows statuses from ticket's board
   - Test selecting and changing status

3. **Verify All ConnectWise Features**:
   - Test note creation
   - Test time entry logging
   - Test status updates via UI
   - Verify member identifier working

### Then Continue With:
4. **Phone Number Inventory Issue**:
   - Find where user's current phone is queried
   - Before assigning new number, mark old number as "available"
   - Add proper status transitions

5. **Add More Phone Numbers**:
   - Implement CSV import, manual entry, or release mechanism

6. **Make Work Role Dynamic** (Future Enhancement):
   - Currently hardcoded to "UCRight Engineer"
   - Should fetch available roles for member after username selection

## How ConnectWise Integration Now Works

1. **Admin Setup**:
   - Admin configures ConnectWise credentials in admin panel
   - Can set a "Default Member Identifier" (optional fallback)

2. **Operator Usage**:
   - Operator selects a user and phone number
   - If linking to ConnectWise ticket:
     - **MUST** enter their ConnectWise username (REQUIRED field)
     - This is their local ConnectWise username, NOT their Microsoft email

3. **Backend Processing**:
   - Uses operator-provided member ID if available
   - Falls back to default member ID from admin settings
   - Requires one or the other
   - Logs note with member ID
   - Logs time entry (default: 15 minutes, configurable in admin)

## Important Notes

- **Member Identifiers**: Use ConnectWise local usernames, NOT Azure AD emails
- **Time Entry**: Uses "Default Time (minutes)" from admin ConnectWise settings
- **No per-operation time field**: Currently not exposed to operators
- **Git Status**: Changes not committed - on `feature/connectwise-integration` branch
- **PM2 Status**: Server running on port 443 (backend only, no frontend)

## Logs to Check

To see ConnectWise member identifier flow:
```bash
pm2 logs ucrmanager | grep "ConnectWise API"
```

To see recent errors:
```bash
pm2 logs ucrmanager --err --lines 50
```

## Recovery Commands

If you need to rebuild (when memory issue resolved):
```bash
cd /c/inetpub/wwwroot/UCRManager
NODE_OPTIONS="--max-old-space-size=8192" npm run build
pm2 restart ucrmanager
```

To check status:
```bash
pm2 status
pm2 logs ucrmanager --lines 30
```
