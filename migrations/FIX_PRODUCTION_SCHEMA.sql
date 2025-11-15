-- Fix Production Schema Mismatch
-- Date: November 14, 2025
-- Purpose: Correct schema to match what the application expects

BEGIN;

-- =============================================================================
-- FIX AUDIT_LOGS TABLE
-- =============================================================================

-- Drop the incorrect audit_logs table and recreate with correct schema
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    operator_email TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    target_user_upn TEXT NOT NULL,
    target_user_name TEXT NOT NULL,
    target_user_id TEXT,
    change_type TEXT NOT NULL,
    change_description TEXT NOT NULL,
    phone_number TEXT,
    routing_policy TEXT,
    previous_phone_number TEXT,
    previous_routing_policy TEXT,
    status TEXT DEFAULT 'success' NOT NULL,
    error_message TEXT,
    before_state JSONB,
    after_state JSONB,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX CUSTOMER_TENANTS TABLE
-- =============================================================================

-- Drop and recreate customer_tenants with correct schema
DROP TABLE IF EXISTS customer_tenants CASCADE;

CREATE TABLE customer_tenants (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    tenant_name TEXT NOT NULL,
    app_registration_id TEXT,
    app_registration_secret TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX OPERATOR_USERS TABLE
-- =============================================================================

-- Drop and recreate operator_users with correct schema
DROP TABLE IF EXISTS operator_users CASCADE;

CREATE TABLE operator_users (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    azure_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX CONFIGURATION_PROFILES TABLE
-- =============================================================================

-- Drop and recreate configuration_profiles with correct schema
DROP TABLE IF EXISTS configuration_profiles CASCADE;

CREATE TABLE configuration_profiles (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    phone_number_prefix TEXT NOT NULL,
    default_routing_policy TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX OPERATOR_CONFIG TABLE
-- =============================================================================

-- Drop and recreate operator_config with correct schema
DROP TABLE IF EXISTS operator_config CASCADE;

CREATE TABLE operator_config (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    azure_tenant_id TEXT NOT NULL,
    azure_client_id TEXT NOT NULL,
    azure_client_secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX TENANT_POWERSHELL_CREDENTIALS TABLE
-- =============================================================================

-- Drop and recreate tenant_powershell_credentials with correct schema
DROP TABLE IF EXISTS tenant_powershell_credentials CASCADE;

CREATE TABLE tenant_powershell_credentials (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id VARCHAR NOT NULL REFERENCES customer_tenants(id) ON DELETE CASCADE,
    app_id TEXT,
    certificate_thumbprint TEXT,
    username_deprecated TEXT NOT NULL DEFAULT '',
    encrypted_password_deprecated TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX CONNECTWISE_CREDENTIALS TABLE
-- =============================================================================

-- Rename server_url to base_url (code expects base_url)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'connectwise_credentials'
        AND column_name = 'server_url'
    ) THEN
        ALTER TABLE connectwise_credentials RENAME COLUMN server_url TO base_url;
    END IF;
END $$;

-- =============================================================================
-- VERIFY ADMIN_USERS TABLE EXISTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- FIX FEATURE_FLAGS TABLE
-- =============================================================================

DROP TABLE IF EXISTS feature_flags CASCADE;

CREATE TABLE feature_flags (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default feature flags
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled) VALUES
    ('3cx_integration', '3CX Integration', 'Enable 3CX phone system integration', FALSE),
    ('3cx_grafana', 'Grafana Dashboards (3CX)', 'Enable Grafana monitoring dashboards for 3CX', FALSE),
    ('allow_manual_phone_entry', 'Manual Phone Number Entry', 'Allow manual entry of phone numbers instead of CSV only', FALSE),
    ('connectwise_integration', 'ConnectWise Integration', 'Enable ConnectWise ticketing integration', FALSE);

COMMIT;

-- =============================================================================
-- INITIALIZE REQUIRED DATA
-- =============================================================================

BEGIN;

-- Insert placeholder operator config (required for app to function)
-- Admin should update this with real Azure AD credentials after deployment
INSERT INTO operator_config (azure_tenant_id, azure_client_id, azure_client_secret, redirect_uri)
SELECT
    'placeholder-tenant-id',
    'placeholder-client-id',
    'placeholder-secret',
    'https://localhost/auth/callback'
WHERE NOT EXISTS (SELECT 1 FROM operator_config LIMIT 1);

COMMIT;

-- Verification queries
SELECT 'audit_logs columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position;

SELECT 'customer_tenants columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_tenants' ORDER BY ordinal_position;

SELECT 'operator_users columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operator_users' ORDER BY ordinal_position;

SELECT 'feature_flags data:' as info;
SELECT feature_key, feature_name, is_enabled FROM feature_flags ORDER BY feature_key;

SELECT 'operator_config data:' as info;
SELECT id, azure_tenant_id, azure_client_id, redirect_uri FROM operator_config;
