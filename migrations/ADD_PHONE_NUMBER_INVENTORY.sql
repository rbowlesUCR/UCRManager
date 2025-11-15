-- Add Missing Phone Number Inventory Table
-- Date: November 15, 2025
-- Purpose: Add phone_number_inventory table that was missing from FIX_PRODUCTION_SCHEMA.sql

BEGIN;

-- Create phone_number_inventory table
CREATE TABLE IF NOT EXISTS phone_number_inventory (
    id VARCHAR DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id VARCHAR NOT NULL REFERENCES customer_tenants(id) ON DELETE CASCADE,

    -- Phone number details
    line_uri TEXT NOT NULL,
    display_name TEXT,
    user_principal_name TEXT,

    -- Service provider and location information
    carrier TEXT,
    location TEXT,
    usage_location TEXT,

    -- Teams/UC configuration
    online_voice_routing_policy TEXT,

    -- Number classification and status
    number_type TEXT NOT NULL DEFAULT 'did',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'aging')),

    -- Lifecycle management
    reserved_by TEXT,
    reserved_at TIMESTAMP,
    aging_until TIMESTAMP,
    assigned_at TIMESTAMP,

    -- Additional metadata
    notes TEXT,
    tags TEXT,
    number_range TEXT,

    -- External system tracking (for 3CX integration)
    external_system_type TEXT,
    external_system_id TEXT,

    -- Audit fields
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    created_by TEXT,
    last_modified_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_modified_by TEXT,

    -- Ensure unique phone numbers per tenant
    UNIQUE(tenant_id, line_uri)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_phone_number_status ON phone_number_inventory(status);
CREATE INDEX IF NOT EXISTS idx_phone_number_tenant ON phone_number_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_number_upn ON phone_number_inventory(user_principal_name);
CREATE INDEX IF NOT EXISTS idx_phone_number_line_uri ON phone_number_inventory(line_uri);

COMMIT;

-- Verification
SELECT 'phone_number_inventory table created' as status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'phone_number_inventory'
ORDER BY ordinal_position;

SELECT 'phone_number_inventory indexes' as status;
SELECT indexname FROM pg_indexes
WHERE tablename = 'phone_number_inventory';
