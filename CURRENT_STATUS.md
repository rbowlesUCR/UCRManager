# UCR Manager - Current Session Status
**Date**: November 14, 2025
**Session**: ConnectWise Member ID Integration

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

### 2. ConnectWise Time Entry Date Format Fix 🔧
**Problem**: Time entries were failing with "Unsupported format applied to timeStart"

**Solution**:
- Fixed date format in `server/connectwise.ts` `addTimeEntry()` function
- Changed from `now.toISOString()` to `[${now.toISOString()}]` (wrapped in brackets)
- ConnectWise expects: `[2015-03-05T09:00:00Z]` format

### 3. Testing Results
**Last Test (member: jreynolds)**:
- ✅ Note successfully added to ConnectWise ticket #55104
- ❌ Time entry still failing (fixed in code but needs frontend rebuild)
- Backend has detailed logging showing member identifier flow

## Current Issues

### 1. Frontend Build Memory Error ⚠️
**Status**: BLOCKING
**Problem**: Node.js runs out of memory when building frontend with Vite
**Impact**: Login page shows 404 - frontend files missing from `dist/public/`
**Error**: `FATAL ERROR: Zone Allocation failed - process out of memory`
**Attempted Fixes**:
- Tried with `NODE_OPTIONS="--max-old-space-size=4096"` - failed
- Tried with `NODE_OPTIONS="--max-old-space-size=6144"` - failed
**Current State**:
- Backend built successfully (`dist/index.js` exists)
- Frontend build missing (`dist/public/index.html` NOT found)
- Server running but cannot serve frontend

### 2. Phone Number Not Returning to Inventory 📋
**Status**: NOT STARTED
**Problem**: When changing a user's phone number, the old number is not returned to "available" status in inventory
**Location**: `server/routes.ts` `/api/teams/assign-voice` route (line ~2659)
**Current Behavior**: Only marks NEW number as "used"
**Required Behavior**: Should also mark OLD number (if exists) as "available"

## File Changes (Uncommitted)

### Modified Files:
1. `client/src/components/admin-connectwise-credentials.tsx`
   - Added default member identifier field

2. `client/src/pages/dashboard.tsx`
   - Added required ConnectWise username field when ticket selected

3. `server/connectwise.ts`
   - Added default member identifier support
   - Fixed time entry date format

4. `server/routes.ts`
   - Added default member identifier to credentials routes
   - Added fallback logic for member identifier
   - Added detailed logging

### Database Changes:
```sql
ALTER TABLE connectwise_credentials
ADD COLUMN IF NOT EXISTS default_member_identifier TEXT;
```

## Next Steps

### Immediate (To Restore Service):
1. **Fix Frontend Build** - Either:
   - Find a machine with more RAM to build
   - Build on a different system and copy files
   - Restore from backup if available
   - Try building in smaller chunks

2. **Once Frontend Working**:
   - Test ConnectWise logging with proper member ID
   - Verify both note AND time entry work

### Then Continue With:
3. **Phone Number Inventory Issue**:
   - Find where user's current phone is queried
   - Before assigning new number, mark old number as "available"
   - Add proper status transitions

4. **Add More Phone Numbers**:
   - User mentioned running low on inventory
   - Options: CSV import, manual entry, or release unused numbers

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
