-- UCRManager Production Database Schema
-- Complete schema for fresh production deployment
-- Date: November 14, 2025
-- Version: 1.0

-- This file contains the complete schema as it exists on the development server
-- Run this on a fresh PostgreSQL database for production deployment

BEGIN;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_local_admin BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Customer Tenants Table
CREATE TABLE IF NOT EXISTS customer_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_name TEXT NOT NULL,
    tenant_domain TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Operator Users Table
CREATE TABLE IF NOT EXISTS operator_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, username)
);

-- =============================================================================
-- PHONE NUMBER MANAGEMENT
-- =============================================================================

-- Phone Number Inventory Table
CREATE TABLE IF NOT EXISTS phone_number_inventory (
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
    UNIQUE(tenant_id, line_uri)
);

CREATE INDEX IF NOT EXISTS idx_phone_number_status ON phone_number_inventory(status);
CREATE INDEX IF NOT EXISTS idx_phone_number_tenant ON phone_number_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_upn ON phone_number_inventory(user_principal_name);

-- Country Codes Table
CREATE TABLE IF NOT EXISTS country_codes (
    id SERIAL PRIMARY KEY,
    country_name TEXT NOT NULL,
    iso_code TEXT NOT NULL,
    calling_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- AUDIT & LOGGING
-- =============================================================================

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES operator_users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_user_upn TEXT,
    before_state JSONB,
    after_state JSONB,
    changes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 3CX Audit Logs Table
CREATE TABLE IF NOT EXISTS threecx_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_entity TEXT,
    entity_id TEXT,
    before_state JSONB,
    after_state JSONB,
    changes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);

-- =============================================================================
-- CONFIGURATION
-- =============================================================================

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    feature_key TEXT UNIQUE NOT NULL,
    feature_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    parent_feature_key TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuration Profiles Table
CREATE TABLE IF NOT EXISTS configuration_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE,
    profile_name TEXT NOT NULL,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Operator Config Table
CREATE TABLE IF NOT EXISTS operator_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES operator_users(id) ON DELETE CASCADE,
    config_key TEXT NOT NULL,
    config_value JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(operator_id, config_key)
);

-- =============================================================================
-- INTEGRATION CREDENTIALS
-- =============================================================================

-- PowerShell Credentials Table (Certificate-based authentication)
CREATE TABLE IF NOT EXISTS tenant_powershell_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE UNIQUE,
    certificate_thumbprint TEXT,
    app_id TEXT,
    organization TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3CX Credentials Table
CREATE TABLE IF NOT EXISTS tenant_3cx_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE UNIQUE,
    server_url TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3CX Config Table
CREATE TABLE IF NOT EXISTS tenant_3cx_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE UNIQUE,
    config_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ConnectWise Credentials Table
CREATE TABLE IF NOT EXISTS connectwise_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES customer_tenants(id) ON DELETE CASCADE UNIQUE,
    server_url TEXT NOT NULL,
    company_id TEXT NOT NULL,
    encrypted_public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    client_id TEXT NOT NULL,
    default_member_identifier TEXT,
    default_time_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT
);

-- =============================================================================
-- INITIAL FEATURE FLAGS
-- =============================================================================

INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled) VALUES
    ('3cx_integration', '3CX Integration', 'Enable 3CX phone system management for tenants with 3CX. Includes user, extension, DID, and trunk management.', false),
    ('3cx_grafana', 'Grafana Dashboards (3CX)', 'Enable Grafana dashboard integration for 3CX metrics and reporting.', false),
    ('allow_manual_phone_entry', 'Manual Phone Number Entry', 'Allow operators to manually enter phone numbers in voice configuration (bypasses DID picklist)', false),
    ('connectwise_integration', 'ConnectWise Integration', 'Enable ConnectWise PSA integration for ticket tracking and time entry', false)
ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_operator_users_tenant ON operator_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_profiles_tenant ON configuration_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operator_config_operator ON operator_config(operator_id);
CREATE INDEX IF NOT EXISTS idx_threecx_audit_tenant ON threecx_audit_logs(tenant_id);

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Uncomment to run verification after deployment:

-- \dt  -- List all tables

-- SELECT COUNT(*) AS admin_users FROM admin_users;
-- SELECT COUNT(*) AS customer_tenants FROM customer_tenants;
-- SELECT COUNT(*) AS operator_users FROM operator_users;
-- SELECT COUNT(*) AS phone_numbers FROM phone_number_inventory;
-- SELECT COUNT(*) AS feature_flags FROM feature_flags;
-- SELECT COUNT(*) AS country_codes FROM country_codes;

-- SELECT feature_key, is_enabled FROM feature_flags ORDER BY feature_key;
