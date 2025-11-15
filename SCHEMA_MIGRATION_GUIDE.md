# Schema Migration Guide - Preventing Future Issues

**Date**: November 15, 2025
**Author**: Production Server Claude
**Purpose**: Document schema issues discovered during production deployment and prevent recurrence

---

## Executive Summary

During production deployment, we discovered that `PRODUCTION_DEPLOYMENT.sql` was significantly out of sync with the current codebase schema definitions. This caused multiple 500 errors when trying to use various features. This document outlines what went wrong and how to prevent it in the future.

## Schema Issues Discovered

### 1. ConnectWise Credentials Table

**Issues Found:**
- Column `server_url` should be `base_url`
- Column `encrypted_public_key` should be `public_key`
- Column `encrypted_private_key` should be `private_key`
- Missing column `auto_update_status` BOOLEAN DEFAULT false
- Missing column `default_status_id` INTEGER

**Root Cause:**
PRODUCTION_DEPLOYMENT.sql used old column names from an earlier version. The feature migration `0006_connectwise_integration.sql` had the correct schema, but PRODUCTION_DEPLOYMENT.sql was never updated to match.

**Error Symptoms:**
```
Error saving credentials: error: column "base_url" does not exist
Error saving credentials: error: column "public_key" does not exist
Error saving credentials: error: column "auto_update_status" does not exist
```

**Fix Applied:**
Updated `migrations/FIX_PRODUCTION_SCHEMA.sql` with conditional column renames and additions.

### 2. 3CX Credentials Table

**Issues Found:**
- Missing column `created_by` TEXT
- Missing column `updated_by` TEXT

**Root Cause:**
Audit/tracking columns were added to the schema definition but PRODUCTION_DEPLOYMENT.sql was not updated.

**Error Symptoms:**
```
Error saving 3CX credentials: error: column "created_by" does not exist
```

**Fix Applied:**
Added columns to `migrations/FIX_PRODUCTION_SCHEMA.sql`.

### 3. Phone Number Inventory Table

**Issues Found:**
Table existed but was missing 11+ columns required by the application, including:
- `carrier`, `location`, `usage_location`
- `number_type`, `number_range`
- `reserved_by`, `reserved_at`
- `aging_until`, `assigned_at`
- `tags`, `updated_at`
- And more...

**Root Cause:**
Phone number inventory schema evolved significantly during development but PRODUCTION_DEPLOYMENT.sql was never updated with new columns.

**Error Symptoms:**
```
Error: column "carrier" does not exist
Error: column "number_type" does not exist
```

**Fix Applied:**
Dev team created dedicated migration: `migrations/ADD_PHONE_NUMBER_INVENTORY.sql` that drops and recreates the table with complete schema (31 columns total).

### 4. Tenant PowerShell Credentials Table

**Issues Found:**
Used old username/password schema instead of certificate-based authentication:
- Missing column `app_id`
- Missing column `certificate_thumbprint`
- Columns `username` and `encrypted_password` should be `username_deprecated` and `encrypted_password_deprecated`

**Fix Applied:**
Updated in `migrations/FIX_PRODUCTION_SCHEMA.sql`.

---

## Migration Files Status

### Current Migration Files

1. **PRODUCTION_DEPLOYMENT.sql** - ❌ **OUTDATED - DO NOT USE FOR FRESH DEPLOYMENTS**
   - Created early in development
   - Never kept in sync with feature migrations
   - Multiple schema mismatches

2. **FIX_PRODUCTION_SCHEMA.sql** - ✅ **USE THIS AFTER PRODUCTION_DEPLOYMENT.sql**
   - Fixes known schema mismatches
   - Idempotent (safe to run multiple times)
   - Includes all fixes discovered during production deployment

3. **ADD_PHONE_NUMBER_INVENTORY.sql** - ✅ **REQUIRED FOR PHONE NUMBER MANAGEMENT**
   - Completely rebuilds phone_number_inventory table
   - 31 columns with proper indexes and constraints
   - Created by dev team based on shared/schema.ts

4. **0006_connectwise_integration.sql** - ✅ **CANONICAL SOURCE FOR CONNECTWISE SCHEMA**
   - Feature-specific migration
   - Has correct ConnectWise schema
   - Should be used as reference

### Recommended Migration Order

For fresh deployments, apply migrations in this order:

```bash
# 1. Basic tables (if starting completely fresh)
psql -U postgres -d ucrmanager -f migrations/PRODUCTION_DEPLOYMENT.sql

# 2. Fix schema mismatches
psql -U postgres -d ucrmanager -f migrations/FIX_PRODUCTION_SCHEMA.sql

# 3. Phone number inventory (complete rebuild)
psql -U postgres -d ucrmanager -f migrations/ADD_PHONE_NUMBER_INVENTORY.sql

# 4. Country codes (optional but recommended)
psql -U postgres -d ucrmanager -f migrations/add_country_codes.sql
```

---

## Preventing Future Issues

### 1. Single Source of Truth

**Problem**: Schema definitions scattered across multiple files that get out of sync.

**Solutions**:
- ✅ Use `shared/schema.ts` as the canonical schema definition
- ✅ Generate SQL migrations FROM schema.ts, not the other way around
- ❌ Don't manually maintain PRODUCTION_DEPLOYMENT.sql

**Recommended Approach**:
```typescript
// In shared/schema.ts - this is the source of truth
export const connectwiseCredentials = pgTable('connectwise_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => customerTenants.id),
  baseUrl: text('base_url').notNull(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  autoUpdateStatus: boolean('auto_update_status').default(false),
  defaultStatusId: integer('default_status_id'),
  // ... etc
});
```

Then use Drizzle Kit to generate migrations:
```bash
npx drizzle-kit generate:pg
```

### 2. Automated Schema Validation

**Problem**: No way to know if database schema matches code expectations until runtime error.

**Solution**: Add schema validation tests.

**Example Test** (recommended for CI/CD):
```typescript
// tests/schema-validation.test.ts
describe('Database Schema Validation', () => {
  it('should have all required columns for connectwise_credentials', async () => {
    const result = await db.execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'connectwise_credentials'
    `);

    const columns = result.rows.map(r => r.column_name);

    expect(columns).toContain('base_url');
    expect(columns).toContain('public_key');
    expect(columns).toContain('private_key');
    expect(columns).toContain('auto_update_status');
    expect(columns).toContain('default_status_id');
  });

  // Repeat for all tables...
});
```

### 3. Migration Versioning System

**Problem**: No tracking of which migrations have been applied to which database.

**Current State**: Migrations are SQL files run manually with no state tracking.

**Recommended Solutions**:

**Option A: Use Drizzle Kit (already in project)**
```bash
# Generate migration from schema changes
npx drizzle-kit generate:pg

# Apply pending migrations
npx drizzle-kit push:pg
```

**Option B: Use a dedicated migration tool**
- Flyway
- node-pg-migrate
- Knex.js migrations

These tools create a `schema_migrations` table that tracks:
- Which migrations have been applied
- When they were applied
- Success/failure status

### 4. Pre-Deployment Checklist

Before deploying to production:

- [ ] Run schema validation tests
- [ ] Compare `shared/schema.ts` with latest migrations
- [ ] Test all API endpoints in staging with production-like data
- [ ] Verify all feature flags work
- [ ] Check all credential management endpoints (ConnectWise, 3CX, PowerShell)
- [ ] Test phone number inventory operations
- [ ] Review migration files for consistency

### 5. Documentation Requirements

For every schema change:

- [ ] Update `shared/schema.ts` (source of truth)
- [ ] Generate or write migration file
- [ ] Update API documentation if endpoints change
- [ ] Add validation test for new columns
- [ ] Document breaking changes in CHANGELOG.md

---

## Lessons Learned

### What Went Wrong

1. **Manual Migration Maintenance**: PRODUCTION_DEPLOYMENT.sql was manually maintained and fell behind
2. **No Validation**: No automated checks to catch schema drift
3. **Multiple Sources of Truth**: Schema definitions in TypeScript, migration files, and database got out of sync
4. **Ad-Hoc Fixes**: Schema changes were applied directly to database without updating migration files

### What Went Right

1. **Feature Migrations**: Individual feature migrations (like 0006_connectwise_integration.sql) were correct
2. **TypeScript Schema**: shared/schema.ts generally reflected actual code expectations
3. **Idempotent Fixes**: FIX_PRODUCTION_SCHEMA.sql uses `IF EXISTS` and `ADD COLUMN IF NOT EXISTS` to be safely re-runnable
4. **Quick Discovery**: Runtime errors provided clear column names, making fixes straightforward

### Key Takeaways

1. **Treat Schema as Code**: Use version control, code review, and automated testing
2. **Single Source of Truth**: One schema definition (TypeScript) that generates everything else
3. **Fail Fast**: Automated validation catches issues before production
4. **Track State**: Know which migrations have been applied to which environment
5. **Document Everything**: Clear migration guides prevent confusion during deployments

---

## Reference: Complete Table Schemas

For reference, here are the final working schemas for tables that had issues:

### connectwise_credentials (15 columns)
```sql
CREATE TABLE connectwise_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES customer_tenants(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL,
    company_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    client_id TEXT NOT NULL,
    default_member_identifier TEXT,
    default_time_minutes INTEGER DEFAULT 15,
    auto_update_status BOOLEAN DEFAULT false,
    default_status_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);
```

### tenant_3cx_credentials (10 columns)
```sql
CREATE TABLE tenant_3cx_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES customer_tenants(id) ON DELETE CASCADE,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);
```

### phone_number_inventory (31 columns)
```sql
CREATE TABLE phone_number_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE,
    line_uri TEXT NOT NULL,
    display_name TEXT,
    user_principal_name TEXT,
    online_voice_routing_policy TEXT,
    voice_routing_policy TEXT,
    external_system_type TEXT CHECK (external_system_type IN ('teams', '3cx', 'other')),
    external_system_id TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'aging')),
    reserved_until TIMESTAMP,
    last_assigned_date TIMESTAMP,
    last_released_date TIMESTAMP,
    aging_started_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT,
    last_modified_at TIMESTAMP DEFAULT NOW(),
    last_modified_by TEXT,
    country_code TEXT,
    carrier TEXT,
    location TEXT,
    usage_location TEXT,
    number_type TEXT NOT NULL DEFAULT 'did' CHECK (number_type IN ('did', 'extension', 'toll-free', 'mailbox')),
    reserved_by TEXT,
    reserved_at TIMESTAMP,
    aging_until TIMESTAMP,
    assigned_at TIMESTAMP,
    tags TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    number_range TEXT,
    UNIQUE (tenant_id, line_uri)
);

CREATE INDEX idx_phone_number_status ON phone_number_inventory(status);
CREATE INDEX idx_phone_number_tenant ON phone_number_inventory(tenant_id);
CREATE INDEX idx_phone_number_upn ON phone_number_inventory(user_principal_name);
CREATE INDEX idx_phone_number_country_code ON phone_number_inventory(country_code);
CREATE INDEX idx_phone_number_line_uri ON phone_number_inventory(line_uri);
```

---

## Contact & Support

For questions about this guide:
- Review Git history: commits cedd4fa through b2df80f
- Check PRODUCTION_DEPLOYMENT_LOG.md for deployment details
- Review individual migration files in `migrations/` directory

**Last Updated**: November 15, 2025
