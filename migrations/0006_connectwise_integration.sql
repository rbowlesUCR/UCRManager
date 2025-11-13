-- Migration: ConnectWise PSA Integration
-- Date: 2025-11-13
-- Description: Adds feature flag and credentials storage for ConnectWise Manage API integration

-- Add ConnectWise integration feature flag
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled)
VALUES (
    'connectwise_integration',
    'ConnectWise PSA Integration',
    'Enable ConnectWise Manage integration for ticket tracking, time entries, and status updates',
    false
) ON CONFLICT (feature_key) DO UPDATE SET
    feature_name = EXCLUDED.feature_name,
    description = EXCLUDED.description;

-- Create ConnectWise credentials table (per tenant)
CREATE TABLE IF NOT EXISTS connectwise_credentials (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES customer_tenants(id) ON DELETE CASCADE,

    -- ConnectWise instance details
    base_url TEXT NOT NULL, -- e.g., https://api-na.myconnectwise.net
    company_id TEXT NOT NULL, -- ConnectWise company identifier

    -- API authentication (encrypted)
    public_key TEXT NOT NULL, -- Encrypted public API key
    private_key TEXT NOT NULL, -- Encrypted private API key
    client_id TEXT NOT NULL, -- Encrypted client ID

    -- Configuration
    default_time_minutes INTEGER DEFAULT 15, -- Default time entry in minutes
    auto_update_status BOOLEAN DEFAULT false, -- Automatically update ticket status
    default_status_id INTEGER, -- Default status to set (if auto_update_status = true)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR REFERENCES admin_users(id),
    updated_by VARCHAR REFERENCES admin_users(id),

    -- Ensure one credential set per tenant
    UNIQUE(tenant_id)
);

-- Create index for tenant lookup
CREATE INDEX IF NOT EXISTS idx_connectwise_credentials_tenant
ON connectwise_credentials(tenant_id);

-- Add comments for documentation
COMMENT ON TABLE connectwise_credentials IS 'Stores encrypted ConnectWise Manage API credentials per tenant';
COMMENT ON COLUMN connectwise_credentials.base_url IS 'ConnectWise API base URL (e.g., https://api-na.myconnectwise.net)';
COMMENT ON COLUMN connectwise_credentials.company_id IS 'ConnectWise company identifier';
COMMENT ON COLUMN connectwise_credentials.public_key IS 'Encrypted ConnectWise public API key';
COMMENT ON COLUMN connectwise_credentials.private_key IS 'Encrypted ConnectWise private API key';
COMMENT ON COLUMN connectwise_credentials.client_id IS 'Encrypted ConnectWise client ID (application GUID)';
COMMENT ON COLUMN connectwise_credentials.default_time_minutes IS 'Default time entry duration in minutes (default: 15)';
COMMENT ON COLUMN connectwise_credentials.auto_update_status IS 'Whether to automatically update ticket status after changes';
COMMENT ON COLUMN connectwise_credentials.default_status_id IS 'Default ConnectWise status ID to set when auto-updating';
