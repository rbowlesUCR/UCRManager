# UCRManager - Database Migrations Order

**Purpose**: This document lists all database migrations in the order they must be executed during production deployment.

**Important**: For production deployment, use the consolidated migration file.

---

## Recommended: Single Consolidated Migration

### Production Deployment Schema
**File**: `migrations/PRODUCTION_DEPLOYMENT.sql`

**Creates**: Complete database schema in one transaction
- All core tables (admin_users, customer_tenants, operator_users, etc.)
- Phone number inventory and country codes
- Audit logging tables
- Integration credential tables (3CX, ConnectWise, PowerShell)
- Feature flags with initial values
- All indexes for performance

**Prerequisites**: Fresh PostgreSQL database (empty)

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/PRODUCTION_DEPLOYMENT.sql
```

**Advantages**:
- Single transaction (all or nothing)
- No dependency issues
- Faster execution
- Matches current development schema exactly
- Easier to verify

---

## Alternative: Individual Migration Files (Development History)

These are the historical migrations that were run during development.
**Not recommended for production** - use PRODUCTION_DEPLOYMENT.sql instead.

### 1. Phone Number Inventory
**File**: `migrations/0003_phone_number_inventory.sql`

---

## Complete Deployment Process

### Step 1: Create Database and Schema
```bash
# Create database
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"

# Apply schema
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/PRODUCTION_DEPLOYMENT.sql
```

### Step 2: Load Country Codes Data
```bash
# Import country codes (optional but recommended)
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/add_country_codes.sql
```

### Step 3: Verify Deployment
```bash
# Check all tables exist
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "\dt"

# Expected tables:
# - admin_users
# - audit_logs
# - configuration_profiles
# - connectwise_credentials
# - country_codes
# - customer_tenants
# - feature_flags
# - operator_config
# - operator_users
# - phone_number_inventory
# - tenant_3cx_config
# - tenant_3cx_credentials
# - tenant_powershell_credentials
# - threecx_audit_logs

# Check feature flags
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT feature_key, is_enabled FROM feature_flags ORDER BY feature_key;"

# Expected feature flags:
# - 3cx_integration (false)
# - 3cx_grafana (false)
# - allow_manual_phone_entry (false)
# - connectwise_integration (false)

# Check country codes loaded (if Step 2 completed)
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT COUNT(*) FROM country_codes;"

# Expected: ~250 rows
```

---

## Historical Development Migrations (Reference Only)

### 2. Feature Flags
**File**: `migrations/0004_feature_flags.sql`

**Creates**:
- `feature_flags` - Feature toggle system

**Inserts**:
- Initial feature flags (all disabled by default)

**Prerequisites**: Migration #1 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0002_feature_flags.sql
```

---

### 3. 3CX Integration
**File**: `migrations/0003_3cx_integration.sql`

**Creates**:
- `tenant_3cx_credentials` - 3CX API credentials per tenant

**Adds**:
- Feature flag: `3cx_integration`

**Prerequisites**: Migration #1, #2 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0003_3cx_integration.sql
```

---

### 4. Country Codes Table
**File**: `migrations/0004_country_codes.sql`

**Creates**:
- `country_codes` - International phone number prefixes

**Prerequisites**: Migration #1 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0004_country_codes.sql
```

---

### 5. Country Codes Data
**File**: `migrations/add_country_codes.sql`

**Inserts**:
- ~250 country code records
- Country names, ISO codes, calling codes

**Prerequisites**: Migration #4 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/add_country_codes.sql
```

**Note**: This is a data migration, not a schema migration

---

### 6. Manual Phone Entry Feature
**File**: `migrations/0005_manual_phone_entry.sql`

**Adds**:
- Feature flag: `allow_manual_phone_entry`
- Allows operators to manually enter phone numbers (bypasses DID picklist)

**Prerequisites**: Migration #2 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0005_manual_phone_entry.sql
```

---

### 7. ConnectWise Integration
**File**: `migrations/0006_connectwise_integration.sql`

**Creates**:
- `connectwise_credentials` - ConnectWise API credentials per tenant
- Encrypted storage for API keys
- Default time entry configuration

**Adds**:
- Feature flag: `connectwise_integration`

**Prerequisites**: Migration #1, #2 completed

**Command**:
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0006_connectwise_integration.sql
```

---

## Complete Migration Script

Run all migrations in sequence:

```bash
# Set PostgreSQL password
set PGPASSWORD=[YOUR_PRODUCTION_PASSWORD]
set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"

# Run migrations in order
%PSQL% -U postgres -d ucrmanager -f migrations/0001_initial_schema.sql
%PSQL% -U postgres -d ucrmanager -f migrations/0002_feature_flags.sql
%PSQL% -U postgres -d ucrmanager -f migrations/0003_3cx_integration.sql
%PSQL% -U postgres -d ucrmanager -f migrations/0004_country_codes.sql
%PSQL% -U postgres -d ucrmanager -f migrations/add_country_codes.sql
%PSQL% -U postgres -d ucrmanager -f migrations/0005_manual_phone_entry.sql
%PSQL% -U postgres -d ucrmanager -f migrations/0006_connectwise_integration.sql

echo Migrations complete!
```

---

## Verification Commands

### Check All Tables Exist
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "\dt"
```

**Expected Output**:
- admin_users
- audit_logs
- connectwise_credentials
- country_codes
- customer_tenants
- feature_flags
- operator_users
- phone_number_inventory
- tenant_3cx_credentials

### Check Feature Flags
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT feature_key, feature_name, is_enabled FROM feature_flags ORDER BY feature_key;"
```

**Expected Output**:
- 3cx_integration (disabled)
- 3cx_grafana (disabled)
- allow_manual_phone_entry (disabled)
- connectwise_integration (disabled)

### Check Country Codes Loaded
```bash
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT COUNT(*) FROM country_codes;"
```

**Expected Output**: ~250 rows

---

## Rollback Procedure

If a migration fails:

### Drop Database and Start Over
```bash
# Drop database
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE ucrmanager;"

# Create fresh database
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"

# Re-run migrations from the beginning
```

### Partial Rollback (Not Recommended)
If you need to rollback a specific migration:
1. Manually drop the tables/columns created by that migration
2. Remove the feature flag entries if any
3. Re-run the migration

**Note**: Full database recreation is safer and cleaner for production deployment.

---

## Migration Files Location

All migration files are located in the repository:

```
C:\inetpub\wwwroot\UCRManager\migrations\
├── 0001_initial_schema.sql
├── 0002_feature_flags.sql
├── 0003_3cx_integration.sql
├── 0004_country_codes.sql
├── add_country_codes.sql
├── 0005_manual_phone_entry.sql
└── 0006_connectwise_integration.sql
```

---

## Future Migrations

When adding new migrations:
1. Create new file: `migrations/XXXX_descriptive_name.sql`
2. Update this document with the new migration
3. Include in deployment guide
4. Test on development server first
5. Document rollback procedure

**Naming Convention**: `0007_feature_name.sql`

---

## Migration Best Practices

1. **Always backup before migrations** (production)
2. **Test on development first** (before production)
3. **Run migrations in order** (dependencies)
4. **Verify after each migration** (check tables/data)
5. **Document all changes** (update this file)
6. **Use transactions** (migrations include BEGIN/COMMIT)
7. **Idempotent where possible** (CREATE IF NOT EXISTS, etc.)

---

**Last Updated**: November 14, 2025
**Total Migrations**: 7 (6 schema + 1 data)
**Estimated Time**: 5-10 minutes to run all
