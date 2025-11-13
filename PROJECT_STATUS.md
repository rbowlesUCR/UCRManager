# UCR Manager - Phone Number Inventory System - Current Status

**Last Updated**: 2025-11-13 @ 02:30 AM UTC
**Build Status**: ✅ Deployed and Running on Port 443 (HTTPS) - Auto-Sync & Phone Number UX Improvements

---

## 🎯 Project Overview

Phone Number Inventory Management System with Microsoft Teams synchronization capabilities.

---

## ✅ Completed Features

### 1. Database Schema ✅
- **Table**: `phone_number_inventory`
- **Fields**: Line URI, Display Name, UPN, Carrier, Location, Number Type, Status, etc.
- **Lifecycle Fields**: Reserved/Aging tracking with timestamps
- **Audit Fields**: Created/Modified by and timestamps

### 2. Backend API Endpoints ✅
- `GET /api/numbers` - List phone numbers with filters (status, type)
- `POST /api/numbers` - Create new phone number
- `PATCH /api/numbers/:id` - Update phone number
- `DELETE /api/numbers/:id` - Delete phone number
- `POST /api/numbers/bulk-import` - CSV bulk import
- `PATCH /api/numbers/bulk-update` - Bulk edit multiple numbers
- `POST /api/numbers/next-available` - Find next available number in range
- `GET /api/numbers/statistics` - Get statistics by status/type
- `POST /api/numbers/sync-from-teams/:tenantId` - **Sync from Microsoft Teams**
- `POST /api/numbers/apply-sync` - **Apply selected sync changes**

### 3. Teams Synchronization ✅
**File**: `server/teams-sync.ts`
- Connects to Microsoft Teams using certificate-based PowerShell authentication
- Fetches all phone number assignments via `Get-CsOnlineUser`
- Normalizes phone numbers to E.164 format (tel:+1234567890)
- Handles voice routing policy objects (extracts `.Name` property)
- Returns structured data: Line URI, Display Name, UPN, Voice Routing Policy

### 4. Number Management UI ✅
**File**: `client/src/pages/number-management.tsx`
- Tenant selection dropdown
- Phone number table with sorting and filtering
- Status filters: All, Available, Used, Reserved, Aging
- Type filters: All, DID, Extension, Toll-Free, Mailbox
- Action buttons: Add Number, Import CSV, Export CSV, Show Statistics, **Sync from Teams**
- CRUD operations: Add, Edit, Delete with confirmation dialogs
- Bulk selection and bulk edit capabilities
- CSV import/export functionality
- Next-available number finder

### 5. Teams Sync Dialog Component ✅
**File**: `client/src/components/teams-sync-dialog.tsx`
- Summary statistics (Teams total, Local total, To Add, To Update, Unchanged)
- Three tabs:
  - **To Add**: New numbers from Teams not in local DB
  - **To Update**: Numbers with different info between Teams and local
  - **Unchanged**: Numbers already in sync
- Checkbox selection for each item
- "Select All" functionality per tab
- Side-by-side diff view for updates (local vs Teams values)
- Refresh button to re-sync data
- Apply selected changes button

### 6. Number Lifecycle Manager ✅
**File**: `server/lifecycle-manager.ts`
- Auto-transitions numbers: Reserved → Aging → Available
- Configurable aging periods (default: 30 days reserved, 90 days aging)
- Runs every hour
- Debug endpoints for manual testing

### 7. Debug Endpoints ✅
**File**: `server/debug-routes.ts`
- **PowerShell**: Test cert connection, get policies, execute commands
- **Numbers**: Seed test data, list numbers, test CSV parse, test bulk update, next available, cleanup, statistics
- **Lifecycle**: Run check manually, get stats, test aging transitions

### 8. Feature Flags System ✅
**Database**: `feature_flags` table
**File**: `migrations/0004_feature_flags.sql`
- Dynamic feature toggles for application functionality
- Admin UI for managing feature flags (`client/src/pages/admin-features.tsx`)
- Current features:
  - **Number Management**: Phone number inventory system
  - **Bulk Assignment**: Bulk voice configuration assignment
- API endpoints: `GET /api/feature-flags` and `GET /api/feature-flags/:key`
- Admin endpoint: `PUT /api/admin/feature-flags/:key`
- Real-time updates without application restart

### 9. Bulk Voice Assignment ✅
**File**: `client/src/components/bulk-assignment-dialog.tsx`
- Individual user configuration (manual phone number + policy dropdown per user)
- PowerShell-based assignment (required for voice routing policies)
- Checkbox selection for multiple users
- Visual feedback with accent background for selected users
- Policy dropdown populated from PowerShell `Get-CsOnlineVoiceRoutingPolicy`
- Unique marker system prevents output overlap between sequential assignments
- Feature flag controlled (shows/hides based on `bulk_assignment` flag)

---

## 🐛 Known Issues & Fixes Applied

### Issue 1: Blank Page on Tenant Selection ✅ FIXED
**Problem**: Page loaded blank when selecting Dev Tenant
**Cause**: Select components had empty string values (`value=""`)
**Fix**: Changed to `value="all"` and added conversion logic
**Files Modified**: `client/src/pages/number-management.tsx` (lines 28-29, 66-68, 100-104, 1001-1025)

### Issue 2: Teams Sync Returns Object for Policy ✅ FIXED
**Problem**: `onlineVoiceRoutingPolicy` returned as `{Authority: "Tenant", Name: "Test Policy"}`
**Cause**: PowerShell returns policy objects, not strings
**Fix**: Extract `.Name` property from policy object
**Files Modified**: `server/teams-sync.ts` (lines 98-115)

### Issue 3: Teams Sync Dialog JSON Parsing Bug ✅ FIXED
**Problem**: After clicking "Start Sync", dialog failed to display data and crashed
**Cause**: `apiRequest()` returns a `Response` object, but code was treating it as parsed JSON
**Fix**: Added `.json()` call to parse response: `const data = await response.json()`
**Files Modified**: `client/src/components/teams-sync-dialog.tsx` (lines 28-56, 58-103)
**Debug Logging**: Added comprehensive console.log statements for troubleshooting

### Issue 4: Bulk Assignment Second User Not Getting Policy ✅ FIXED
**Problem**: In bulk assignment, first user gets phone + policy correctly, but second user only gets phone number (policy missing)
**Cause**: PowerShell output overlap - generic success markers from first user detected as success for second user
**Fix**: Implemented unique marker system per assignment (`BULK_userId_timestamp_random`)
**Files Modified**:
- `server/powershell-session.ts` (added `uniqueMarker` parameter to `assignPhoneNumberAndPolicy`)
- `server/routes.ts` (bulk assignment endpoint generates and checks unique markers)
**Result**: Each assignment has isolated success/failure detection, preventing cross-contamination

### Issue 5: Bulk Assignment Feature Flag Not Working ✅ FIXED
**Problem**: Bulk Assignment button still visible even when feature flag was disabled
**Cause**: Feature flag existed in database but wasn't checked by dashboard UI
**Fix**: Added feature flag query and conditional rendering in dashboard
**Files Modified**: `client/src/pages/dashboard.tsx` (lines 93-108, 402-412)
**Result**: Bulk Assign button now shows/hides based on `bulk_assignment` feature flag state

### Issue 6: Global Policy Assignment Fails & Form Not Auto-Populating ✅ FIXED
**Problem 1**: Assigning "Global" voice routing policy failed with 500 error: "Assigning global is not allowed"
**Problem 2**: Assignment detection timed out even when PowerShell commands succeeded
**Problem 3**: Form fields didn't auto-populate when selecting a user with existing phone/policy configuration
**Root Causes**:
1. PowerShell rejects explicit "Global" policy assignment - must use `$null` instead
2. Single assignment endpoint used outdated text-based detection instead of unique marker system
3. Form had no auto-populate logic for existing user configurations
**Fixes Applied**:
- **Global Policy Handling**: Added special case in `assignPhoneNumberAndPolicy` - if policy name is "global" (case-insensitive), use `$null` in PowerShell command (`server/powershell-session.ts` lines 615-621)
- **Unique Marker System**: Migrated single assignment endpoint to use same unique marker system as bulk assignment (`server/routes.ts` lines 2309-2311, 2360-2408, 2423-2464)
  - Generates unique marker: `ASSIGN_timestamp_random`
  - Detects success with `SUCCESS_PHONE:marker` and `SUCCESS_POLICY:marker`
  - Prevents detection failures and timeouts
- **Auto-Populate Forms**: Added useEffect hook to populate phone number and voice routing policy when user is selected (`client/src/pages/dashboard.tsx` lines 129-170)
  - Normalizes policy names by removing "Tag:" prefix for matching
  - Uses policy ID for dropdown selection
**Files Modified**:
- `server/powershell-session.ts` - Global policy $null handling
- `server/routes.ts` - Unique marker generation and detection logic
- `client/src/pages/dashboard.tsx` - Auto-populate useEffect with policy matching
**Result**: Global policy assignment works correctly, detection is reliable, and forms auto-populate with user's existing configuration

### Issue 7: Global Policy Assignment Fails for All Policy Types on Policy Management Page ✅ FIXED
**Problem**: When assigning "Global" policy via the User Policy Assignment page (policy-management.tsx), all policy types failed with 500 error: "Assigning global is not allowed"
**Root Cause**: The generic `grantTeamsPolicyCert()` function used by all 10 policy types was passing `"Global"` as a string literal to PowerShell. Microsoft Teams requires `$null` (not the string "Global") to assign the Global/default policy for ANY policy type.
**Scope**: This affected all 10 supported policy types:
1. Voice Routing Policy
2. Audio Conferencing Policy
3. Call Hold Policy
4. Caller ID Policy
5. Calling Policy
6. Emergency Call Routing Policy
7. Emergency Calling Policy
8. Meeting Policy
9. Voice Applications Policy
10. Voicemail Policy

**Fixes Applied**:
- **Generic Policy Function**: Fixed `grantTeamsPolicyCert()` in `server/powershell.ts` (lines 599-621)
  - Added detection: `const isGlobalPolicy = policyName.toLowerCase() === 'global'`
  - Uses `$null` for Global: `const policyValue = isGlobalPolicy ? '$null' : \`"${policyName}"\``
  - Applies to ALL policy types via the generic Grant-Cs* cmdlets
- **Session-Based Function**: Fixed `assignVoiceRoutingPolicy()` in `server/powershell-session.ts` (lines 524-538)
  - Added same Global policy detection and `$null` handling
  - Ensures consistency across different invocation methods

**Testing Results**:
- ✅ Verified with Teams Telephony Administrator role (reduced permissions)
- ✅ Confirmed Global policy assignment works via Voice Configuration page
- ✅ Confirmed Global policy assignment works via User Policy Assignment page
- ✅ "Reset to Default" button continues to work correctly

**Files Modified**:
- `server/powershell.ts` - Generic policy assignment function (all 10 types)
- `server/powershell-session.ts` - Session-based voice routing policy assignment

**Result**: All 10 policy types now correctly handle Global policy assignment using `$null`, and Teams Telephony Administrator permissions are sufficient for all voice-related operations.

### Issue 8: Teams Badge Not Showing on Imported Numbers ✅ FIXED
**Problem**: When syncing numbers from Teams, the imported numbers didn't show the Teams badge in the Number Management table
**Root Cause**: The `/api/numbers/apply-sync` endpoint was missing the `externalSystemType` field when creating or updating numbers from Teams sync
**Fix Applied**:
- **Backend Changes**: Modified `apply-sync` endpoint in `server/routes.ts` (lines 1685-1718)
  - Added `externalSystemType: 'teams'` to both add and update operations
  - Added `externalSystemId: null` for consistency
- **Result**: All Teams numbers now correctly display blue "TEAMS" badge
- **Also Fixed**: Existing numbers in database updated via SQL: `UPDATE phone_number_inventory SET external_system_type = 'teams' WHERE user_principal_name IS NOT NULL`
**Files Modified**:
- `server/routes.ts` - Added system type tracking to Teams sync apply operation
**Result**: Teams numbers are now properly tagged and display the correct badge in the UI

### Issue 9: Phone Number Entry UX - "tel:" Prefix Requirement ✅ IMPROVED
**Problem**: Users had to manually enter "tel:+15551234567" which was confusing and error-prone
**Requirements**:
- Users should enter numbers in clean E.164 format: `+15551234567`
- Backend/PowerShell still needs `tel:` prefix for proper operation
- Display should show clean format without `tel:` prefix
**Changes Applied**:
- **Number Management Page** (`client/src/pages/number-management.tsx`):
  - Added helper functions: `normalizePhoneForDisplay()` strips "tel:", `normalizePhoneForStorage()` adds "tel:"
  - Updated form labels from "Line URI" to "Phone Number" for clarity
  - Changed placeholders from `tel:+15551234567` to `+15551234567`
  - Table column displays numbers without "tel:" prefix
  - Automatic conversion when saving (add) or updating (edit)
- **Dashboard/Voice Configuration** (`client/src/pages/dashboard.tsx`):
  - Updated validation to accept numbers with or without "tel:" prefix
  - Changed placeholder from `tel:+15551234567` to `+15551234567`
  - Auto-strips "tel:" when loading existing user phone numbers
  - Auto-adds "tel:" before sending to PowerShell backend
  - Updated validation messages to reflect new format
**Files Modified**:
- `client/src/pages/number-management.tsx` - Form inputs, display, and storage normalization
- `client/src/pages/dashboard.tsx` - Validation, display, and backend formatting
**Result**: Users work with clean `+15551234567` format throughout the UI, while backend operations use proper `tel:+15551234567` format

### Issue 10: Manual Sync Required After Number Operations ✅ AUTOMATED
**Problem**: After assigning or removing phone numbers via Voice Configuration, users had to manually sync from Teams to see updated inventory
**Requirements**:
- Automatic sync after successful voice assignment
- Automatic sync after phone number removal
- Silent background operation without disrupting user workflow
- Update Number Management inventory in real-time
**Changes Applied**:
- **Voice Assignment Auto-Sync** (`client/src/pages/dashboard.tsx` lines 196-262):
  - After successful assignment, automatically triggers Teams sync
  - Fetches sync data from Teams
  - Auto-applies all changes (add + update)
  - Shows toast: "Number inventory updated: Synced X phone numbers from Teams"
  - Invalidates queries to refresh Number Management page
  - Silent failure for background sync errors
- **Phone Removal Auto-Sync** (`client/src/pages/dashboard.tsx` lines 273-322):
  - After successful removal, automatically triggers Teams sync
  - Auto-applies all detected changes
  - Updates Number Management inventory
  - No separate toast (covered by removal success message)
**Files Modified**:
- `client/src/pages/dashboard.tsx` - Added auto-sync logic to `assignVoiceMutation` and `removeAssignmentMutation` onSuccess handlers
**Result**: Number Management inventory stays synchronized with Teams automatically, no manual sync needed

### Issue 11: Manual Sync Required on Tenant Selection ✅ AUTOMATED
**Problem**: When selecting a tenant in Number Management, users had to manually click "Sync from Teams" button
**Requirements**:
- Automatic sync dialog appearance when tenant is selected
- Automatic sync initiation without button click
- Show sync progress with loading state
- Display results for user review and selection
**Changes Applied**:
- **Teams Sync Dialog Enhancement** (`client/src/components/teams-sync-dialog.tsx`):
  - Added `autoSync` prop to trigger automatic sync
  - Added useEffect to auto-start sync when dialog opens with `autoSync={true}`
  - Updated loading state to show spinner with "Syncing phone numbers from Teams..." message
  - Dialog can't be closed while syncing or applying changes
  - Reset state when dialog closes
- **Number Management Integration** (`client/src/pages/number-management.tsx`):
  - Added logic to open sync dialog when tenant is selected
  - Passes `autoSync={true}` prop to TeamsSyncDialog component
  - Dialog shows loading state immediately, then displays results
**Files Modified**:
- `client/src/components/teams-sync-dialog.tsx` - Auto-sync functionality and loading states
- `client/src/pages/number-management.tsx` - Trigger dialog on tenant selection
**Result**: Seamless workflow - select tenant, sync starts automatically, review changes, apply. No manual "Sync from Teams" button click needed.

### Issue 12: Phone Number Entry - DID Picklist Requirement ✅ IMPLEMENTED
**Problem**: Operators could manually type any phone number, leading to potential assignment of invalid or unmanaged numbers
**Requirements**:
- Operators must select phone numbers from DID picklist by default
- Ensure only validated numbers from inventory are assigned
- Provide admin toggle to enable/disable manual phone number entry
- Manual entry should be disabled by default for data integrity
**Changes Applied**:
- **Database** (feature_flags table):
  - Created allow_manual_phone_entry feature flag (default: false/disabled)
  - Controls whether operators can manually type phone numbers
- **Voice Configuration UI** (client/src/pages/dashboard.tsx):
  - Added feature flag query to check manual entry permission
  - Conditional rendering based on flag state:
    - **Flag disabled (default)**: Phone input is read-only with placeholder "Click 'Select Number' to choose from available DIDs"
    - **Flag disabled (default)**: Prominent "Select Number" button (variant="default") opens DID picklist
    - **Flag enabled**: Editable input field allows manual typing
    - **Flag enabled**: "Select Number" button becomes secondary (variant="outline")
  - Help text updates based on flag state
  - Ensures validation: only inventory numbers can be assigned when flag is disabled
- **Admin Settings** (client/src/pages/admin-settings.tsx):
  - Added "Voice Configuration Settings" card
  - Toggle switch for "Allow Manual Phone Number Entry"
  - Real-time alerts showing current state:
    - **Disabled**: Info alert confirming picklist-only mode ensures valid numbers
    - **Enabled**: Warning alert that manual entry may lead to errors
  - Feature flag query and toggle mutation
- **Backend API** (server/routes.ts):
  - Added POST /api/admin/feature-flags/:featureKey/toggle endpoint
  - Fetches current flag state, toggles boolean, updates database
  - Returns updated flag state to frontend
  - Integrates with existing feature flag storage system
**Files Modified**:
- client/src/pages/dashboard.tsx - Conditional phone input rendering (60+ lines)
- client/src/pages/admin-settings.tsx - Toggle UI and mutation (70+ lines)
- server/routes.ts - Feature flag toggle endpoint (20+ lines)
- Database: INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled) VALUES ('allow_manual_phone_entry', 'Manual Phone Number Entry', '...', false)
**Result**:
- **Default behavior**: Operators MUST select from DID picklist, ensuring data integrity
- **Admin flexibility**: Can enable manual entry if needed via Settings toggle
- **Data quality**: Prevents assignment of unmanaged or invalid phone numbers
- **User experience**: Clear visual feedback showing which mode is active

---

## 📊 Current System State

### Database
- **Dev Tenant ID**: `83f508e2-0b8b-41da-9dba-8a329305c13e`
- **Phone Numbers**: 0 (test data cleared)
- **PowerShell Credentials**: Certificate-based auth configured
- **Feature Flags**: 3 flags configured (number_management, bulk_assignment, allow_manual_phone_entry)

### Teams Data Available
- **1 phone number** found in Teams:
  - Line URI: `tel:+15551111217`
  - Display Name: Randy Bowles
  - User: DevUser@ucrdev.onmicrosoft.com
  - Voice Routing Policy: Test Policy

### API Test Results
```bash
# Sync endpoint works correctly
curl -X POST https://localhost/api/numbers/sync-from-teams/83f508e2-0b8b-41da-9dba-8a329305c13e
# Returns: {"summary":{"teamsTotal":1,"localTotal":0,"toAdd":1,"toUpdate":0,"unchanged":0},...}
```

---

## 🔧 Configuration

### Environment
- **Node Version**: v24.11.0
- **PM2 Process**: ucrmanager (ID: 0, Restarts: 85)
- **Port**: 443 (HTTPS)
- **Debug Mode**: ✅ Enabled

### Database
- **PostgreSQL**: 16
- **Database**: ucrmanager
- **Password**: 4FC4E215649C6EBF3A390BAFE4B2ECD7

### Authentication
- **Azure AD OAuth**
- **Tenant ID**: 905655b8-88f2-4fc8-9474-a4f2b0283b03
- **Current User**: DevUser@ucrdev.onmicrosoft.com (Randy Bowles)

---

## 🚀 Next Steps

### Immediate Priority
1. **Test Teams Sync Feature End-to-End** ✅ READY FOR TESTING
   - ✅ Fixed JSON parsing bug in dialog component
   - ✅ Added comprehensive console logging for debugging
   - 🔄 User to test: Open dialog, click "Start Sync", verify data displays
   - 🔄 User to test: Select changes and click "Apply Selected"
   - 🔄 User to test: Verify phone number imported to database

### Testing Checklist
- [ ] Verify sync dialog opens without errors
- [ ] Confirm sync data displays correctly (1 number to add)
- [ ] Test checkbox selection (should be pre-selected)
- [ ] Test "Apply Selected" button
- [ ] Verify number tel:+15551111217 is imported to database
- [ ] Confirm table refreshes with imported data
- [ ] Check browser console for debug logs (should show sync flow)

---

## 📁 Key Files Reference

### Backend
- `server/routes.ts` - API endpoints (lines 1452-1600 for Teams sync)
- `server/teams-sync.ts` - Teams PowerShell integration
- `server/storage.ts` - Database operations
- `server/lifecycle-manager.ts` - Automated number lifecycle
- `server/debug-routes.ts` - Debug/testing endpoints

### Frontend
- `client/src/pages/number-management.tsx` - Main UI page
- `client/src/pages/admin-features.tsx` - Feature flags management UI
- `client/src/pages/dashboard.tsx` - Voice configuration page (includes bulk assignment)
- `client/src/components/teams-sync-dialog.tsx` - Sync dialog component
- `client/src/components/bulk-assignment-dialog.tsx` - Bulk assignment dialog
- `client/src/components/tenant-selector.tsx` - Tenant dropdown
- `client/src/components/layout.tsx` - Main layout with feature flag checks
- `client/src/components/admin-layout.tsx` - Admin panel layout

### Database
- `shared/schema.ts` - Drizzle ORM schema definitions
- `migrations/0004_feature_flags.sql` - Feature flags schema migration
- Table: `phone_number_inventory`
- Table: `tenant_powershell_credentials`
- Table: `feature_flags`

---

## 🛠️ Development Commands

```bash
# Build
npm run build

# Restart PM2
pm2 restart ucrmanager

# View Logs
pm2 logs ucrmanager

# Flush Logs
pm2 flush

# Database Query
PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7' \
  "/c/Program Files/PostgreSQL/16/bin/psql.exe" \
  -U postgres -d ucrmanager -c "SELECT COUNT(*) FROM phone_number_inventory;"

# Test Sync Endpoint
curl -k -X POST https://localhost/api/numbers/sync-from-teams/83f508e2-0b8b-41da-9dba-8a329305c13e \
  -H "Cookie: operatorToken=..." \
  -H "Content-Type: application/json" \
  -d "{}"

# Check Feature Flags
PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7' \
  "/c/Program Files/PostgreSQL/16/bin/psql.exe" \
  -U postgres -d ucrmanager -t -A \
  -c "SELECT feature_key, feature_name, is_enabled FROM feature_flags;"

# Enable/Disable Feature Flag
PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7' \
  "/c/Program Files/PostgreSQL/16/bin/psql.exe" \
  -U postgres -d ucrmanager \
  -c "UPDATE feature_flags SET is_enabled = true WHERE feature_key = 'bulk_assignment';"
```

---

## 📝 Notes

- **Test Data**: Previously inserted 5 test numbers, now cleared
- **Fake Data Issue**: Test data was confusing during debugging - now using actual Teams data
- **Browser Cache**: Users should hard refresh (Ctrl+Shift+R) after deployments
- **Certificate Auth**: All PowerShell operations use certificate-based authentication (no MFA prompts)
- **Feature Flags**: Both flags currently disabled by default; enable via Admin Panel → Features
- **Bulk Assignment**: Requires PowerShell certificate auth; uses unique markers to prevent output overlap
- **Admin Access**: Admin panel accessible to users with `admin` role via Admin Panel button in header
- **Global Policy**: When assigning the default "Global" policy for ANY of the 10 supported policy types, the system automatically uses `$null` in PowerShell (required by Microsoft Teams). This applies to: Voice Routing, Audio Conferencing, Call Hold, Caller ID, Calling, Emergency Call Routing, Emergency Calling, Meeting, Voice Applications, and Voicemail policies.
- **Auto-Populate**: Voice configuration form now auto-populates phone number and policy when selecting a user with existing configuration
- **Unique Markers**: Both single and bulk assignment endpoints use unique markers (timestamp + random string) for reliable success/failure detection
- **Teams Permissions**: Application operates successfully with **Teams Telephony Administrator** role (reduced permissions). Full Teams Administrator role is NOT required for voice-related operations.
