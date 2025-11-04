-- Add new columns for dual authentication support
-- Date: 2025-11-04

-- Add auth_type column with default 'certificate' for existing rows
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'certificate';

-- Add username column for user authentication
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS username TEXT;

-- Add encrypted_password column for user authentication
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Add comments
COMMENT ON COLUMN tenant_powershell_credentials.auth_type IS 'Authentication type: certificate or user';
COMMENT ON COLUMN tenant_powershell_credentials.username IS 'Microsoft 365 admin username for user auth';
COMMENT ON COLUMN tenant_powershell_credentials.encrypted_password IS 'AES-256-GCM encrypted password for user auth';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tenant_powershell_credentials'
ORDER BY ordinal_position;
