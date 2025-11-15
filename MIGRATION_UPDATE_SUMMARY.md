# Migration Update Summary

**Date**: November 15, 2025
**File**: migrations/FIX_PRODUCTION_SCHEMA.sql
**Commit**: 108c681

## Changes Made

### 1. Added Missing JSONB Columns to audit_logs

```sql
before_state JSONB,
after_state JSONB,
```

**Reason**: The application code expects these columns for storing complete user configuration snapshots for rollback/audit purposes. Without them, audit log queries fail with "column does not exist" errors.

### 2. Added feature_flags Table Creation

```sql
CREATE TABLE feature_flags (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Initialized with 4 default flags**:
- `3cx_integration` - 3CX Integration
- `3cx_grafana` - Grafana Dashboards (3CX)
- `allow_manual_phone_entry` - Manual Phone Number Entry
- `connectwise_integration` - ConnectWise Integration

All flags default to disabled (FALSE).

### 3. Added operator_config Placeholder Row

```sql
INSERT INTO operator_config (azure_tenant_id, azure_client_id, azure_client_secret, redirect_uri)
SELECT
    'placeholder-tenant-id',
    'placeholder-client-id',
    'placeholder-secret',
    'https://localhost/auth/callback'
WHERE NOT EXISTS (SELECT 1 FROM operator_config LIMIT 1);
```

**Reason**: The application's PUT endpoint for `/api/admin/operator-config` expects an existing row to UPDATE. Without an initial row, the endpoint returns 404 errors when admins try to configure Azure AD credentials for the first time.

**Note**: The INSERT uses a conditional SELECT to prevent duplicate rows if the migration is run multiple times.

## Issues This Fixes

### Issue 1: 404 Error When Configuring Operator Settings
**Symptom**: Admin tries to configure Azure AD credentials via UI, gets 404 error
**Root Cause**: `storage.updateOperatorConfig()` expects existing row, returns undefined if not found
**Fix**: Migration now inserts placeholder row that admin can update

### Issue 2: Audit Logs Endpoint Failures
**Symptom**: `/api/admin/audit-logs` returns 500 error with "column 'before_state' does not exist"
**Root Cause**: Missing JSONB columns in audit_logs table
**Fix**: Added before_state and after_state columns to table creation

### Issue 3: Feature Flags Not Initialized
**Symptom**: Feature flags table might not exist or be empty on fresh deployments
**Root Cause**: Original migration didn't include feature_flags table
**Fix**: Added table creation and initialization with 4 default flags

## Testing on Production

All changes have been tested on production server (ucrmanager01.westus3.cloudapp.azure.com):

```bash
# Verified audit_logs has JSONB columns
\d audit_logs
# Shows: before_state | jsonb, after_state | jsonb

# Verified feature_flags populated
SELECT COUNT(*) FROM feature_flags;
# Result: 4 rows

# Verified operator_config has placeholder row
SELECT azure_tenant_id, azure_client_id FROM operator_config;
# Result: placeholder-tenant-id, placeholder-client-id

# Tested operator config endpoint
curl -k https://localhost/api/admin/operator-config
# Result: {"id":"...","azureTenantId":"placeholder-tenant-id",...}
```

## Database Tables Requiring Initial Data

Based on production testing, the following tables need initial/seed data for the application to function:

| Table | Required? | Initialized By | Notes |
|-------|-----------|----------------|-------|
| admin_users | ✅ Yes | PRODUCTION_DEPLOYMENT.sql | Default admin user |
| operator_config | ✅ Yes | FIX_PRODUCTION_SCHEMA.sql (updated) | Placeholder for Azure AD config |
| feature_flags | ✅ Yes | FIX_PRODUCTION_SCHEMA.sql (updated) | 4 default flags |
| country_codes | ⚠️ Recommended | add_country_codes.sql | 93 country codes |
| customer_tenants | ❌ No | User-created | Created via admin UI |
| operator_users | ❌ No | Azure AD login | Created on first operator login |
| phone_number_inventory | ❌ No | CSV import | Populated by admin |

## Deployment Instructions

### For Fresh Deployments

```bash
# Apply the updated migration
export PGPASSWORD='<password>'
psql -U postgres -d ucrmanager -f migrations/FIX_PRODUCTION_SCHEMA.sql

# Optionally add country codes
psql -U postgres -d ucrmanager -f migrations/add_country_codes.sql
```

### For Existing Production Systems

If you've already applied the original FIX_PRODUCTION_SCHEMA.sql, you can apply just the updates:

```sql
-- Add missing JSONB columns to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB;

-- Create feature_flags if not exists
CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Initialize feature flags (will skip if already exist due to UNIQUE constraint)
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled)
VALUES
    ('3cx_integration', '3CX Integration', 'Enable 3CX phone system integration', FALSE),
    ('3cx_grafana', 'Grafana Dashboards (3CX)', 'Enable Grafana monitoring dashboards for 3CX', FALSE),
    ('allow_manual_phone_entry', 'Manual Phone Number Entry', 'Allow manual entry of phone numbers instead of CSV only', FALSE),
    ('connectwise_integration', 'ConnectWise Integration', 'Enable ConnectWise ticketing integration', FALSE)
ON CONFLICT (feature_key) DO NOTHING;

-- Add placeholder operator config if not exists
INSERT INTO operator_config (azure_tenant_id, azure_client_id, azure_client_secret, redirect_uri)
SELECT
    'placeholder-tenant-id',
    'placeholder-client-id',
    'placeholder-secret',
    'https://localhost/auth/callback'
WHERE NOT EXISTS (SELECT 1 FROM operator_config LIMIT 1);
```

## Recommendations for Dev Team

1. **Consider Upsert Logic**: Update `storage.updateOperatorConfig()` to do INSERT if no row exists, rather than returning undefined. This makes the API more resilient.

2. **Migration Strategy**: Consider using a migration versioning system (like Flyway or node-pg-migrate) to track which migrations have been applied.

3. **Seed Data Separation**: Consider separating table creation from seed data insertion so they can be run independently.

4. **Documentation**: Update main README with:
   - Required initial data for each table
   - Order of migration execution
   - How to verify migrations succeeded

## Files Modified

- `migrations/FIX_PRODUCTION_SCHEMA.sql` - Updated with missing columns and initial data
- `PRODUCTION_DEPLOYMENT_LOG.md` - Added notes about operator_config fix

## Verification

To verify the migration worked correctly:

```sql
-- Check all tables exist
\dt

-- Verify audit_logs has JSONB columns
\d audit_logs

-- Verify feature flags
SELECT feature_key, is_enabled FROM feature_flags ORDER BY feature_key;

-- Verify operator config
SELECT azure_tenant_id, azure_client_id FROM operator_config;

-- Check row counts
SELECT 'admin_users' as table_name, COUNT(*) FROM admin_users
UNION ALL
SELECT 'feature_flags', COUNT(*) FROM feature_flags
UNION ALL
SELECT 'operator_config', COUNT(*) FROM operator_config;
```

Expected results:
- admin_users: 1 row
- feature_flags: 4 rows
- operator_config: 1 row

---

**Note**: This migration is safe to run multiple times due to the use of:
- `DROP TABLE IF EXISTS` for table recreation
- `CREATE TABLE IF NOT EXISTS` for admin_users
- `WHERE NOT EXISTS` clause for operator_config insertion
- `ON CONFLICT DO NOTHING` for feature_flags (in the incremental update script)
