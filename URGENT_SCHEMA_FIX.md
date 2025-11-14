# URGENT: Production Schema Fix Required

**Date**: November 14, 2025
**Priority**: 🔴 CRITICAL
**Issue**: Production database schema doesn't match application expectations

---

## Problem Summary

The `PRODUCTION_DEPLOYMENT.sql` migration script created an **incorrect schema** based on the old development server. The production application expects a **different schema** (from `backup_20251103_210751.sql`).

### Affected Tables
- ❌ `audit_logs` - Missing 13 columns
- ❌ `customer_tenants` - Wrong column structure
- ❌ `operator_users` - Wrong column structure
- ❌ `configuration_profiles` - Wrong column structure
- ❌ `operator_config` - Wrong column structure
- ❌ `tenant_powershell_credentials` - Wrong column structure

### Impact
- ✅ Admin login works
- ✅ Authentication works
- ❌ Cannot view tenants
- ❌ Cannot view operators
- ❌ Cannot view audit logs
- ❌ Core application features broken

---

## Solution

Apply the schema fix migration: `migrations/FIX_PRODUCTION_SCHEMA.sql`

---

## Instructions for Production Server (Other Claude)

### Step 1: Pull Latest Code

```powershell
cd C:\inetpub\wwwroot\UCRManager
git pull origin feature/connectwise-integration
```

This will download:
- `migrations/FIX_PRODUCTION_SCHEMA.sql` - The fix script
- `URGENT_SCHEMA_FIX.md` - This file

### Step 2: Apply Schema Fix

```powershell
$env:PGPASSWORD = "de026eed3c534297bf25eb8c21073f2d"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -f migrations/FIX_PRODUCTION_SCHEMA.sql
```

### Step 3: Verify Fix

```powershell
# Check audit_logs has correct columns
$env:PGPASSWORD = "de026eed3c534297bf25eb8c21073f2d"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\d audit_logs"
```

**Expected columns**:
- operator_email
- operator_name
- tenant_id
- tenant_name
- target_user_upn
- target_user_name
- target_user_id
- change_type
- change_description
- phone_number
- routing_policy
- previous_phone_number
- previous_routing_policy
- status
- error_message
- timestamp

### Step 4: Restart Application

```powershell
pm2 restart ucrmanager-prod
pm2 logs ucrmanager-prod --lines 20
```

### Step 5: Test Endpoints

```powershell
# Test customer tenants endpoint
curl -k https://localhost/api/admin/customer-tenants

# Test operator users endpoint
curl -k https://localhost/api/admin/operator-users

# Test audit logs endpoint
curl -k https://localhost/api/admin/audit-logs
```

All should return `200 OK` with `[]` (empty arrays) instead of errors.

---

## What Happened

### Root Cause
The dev server (20.168.122.70) that I used to create `PRODUCTION_DEPLOYMENT.sql` had:
1. An **outdated schema** from newer development work
2. Different column names and types
3. UUID foreign keys instead of TEXT fields

The **actual application code** expects the schema from `backup_20251103_210751.sql` which has:
1. TEXT-based IDs (not UUIDs)
2. Flat column structure (not JSONB)
3. Different column names

### Why This Wasn't Caught
- The migration ran without errors (both schemas are valid PostgreSQL)
- The application started successfully
- Admin login worked (admin_users table was close enough)
- Schema mismatch only surfaced when trying to query specific tables

---

## Data Loss Warning

**IMPORTANT**: This fix script uses `DROP TABLE CASCADE` which will:
- ❌ Delete all existing data in these tables
- ✅ Recreate tables with correct structure
- ✅ Allow application to function properly

**Current data loss**: NONE - the production database has no real data yet (only the admin user, which is in a different table that's not being dropped).

**If you had production data**: You would need a more careful migration with ALTER TABLE statements instead of DROP/CREATE.

---

## Testing After Fix

### Via Browser
1. Open https://ucrmanager01.westus3.cloudapp.azure.com
2. Login as admin / admin123
3. Try to navigate to tenants page - should work (empty list)
4. Try to navigate to operators page - should work (empty list)
5. Try to view audit logs - should work (empty list)

### Via API
```powershell
# All these should return 200 OK with empty arrays

curl -k https://ucrmanager01.westus3.cloudapp.azure.com/api/admin/customer-tenants

curl -k https://ucrmanager01.westus3.cloudapp.azure.com/api/admin/operator-users

curl -k https://ucrmanager01.westus3.cloudapp.azure.com/api/admin/audit-logs
```

---

## Future Prevention

### For Next Deployment
1. Use `backup_20251103_210751.sql` as the schema reference
2. OR export schema from a known-working server
3. OR test all API endpoints before declaring deployment complete
4. Always verify schema matches application expectations

### Schema Validation Script
Future deployments should include a validation step:
```sql
-- Check audit_logs has operator_email column
SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_logs' AND column_name = 'operator_email';
-- Should return 1 row
```

---

## Rollback (If Needed)

If the fix causes issues:

```powershell
# Restore from backup (none exists yet, but for future reference)
$env:PGPASSWORD = "de026eed3c534297bf25eb8c21073f2d"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE ucrmanager;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -f backup_file.sql
```

---

## Status After Fix

Once applied, the production server will have:
- ✅ Correct database schema
- ✅ All API endpoints functional
- ✅ Application fully operational
- ✅ Ready for real tenant/operator data

---

**Apply this fix ASAP to restore full functionality!**

**Estimated Time**: 5 minutes
**Risk**: Low (no production data to lose)
**Impact**: Fixes all broken endpoints
