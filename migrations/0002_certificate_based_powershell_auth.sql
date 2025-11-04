-- Migration: Update PowerShell credentials to use certificate-based authentication
-- Date: 2025-11-03
-- Description: Changes tenant_powershell_credentials table from username/password to appId/certificateThumbprint

BEGIN;

-- Step 1: Add new columns for certificate-based auth
ALTER TABLE tenant_powershell_credentials
ADD COLUMN IF NOT EXISTS app_id TEXT,
ADD COLUMN IF NOT EXISTS certificate_thumbprint TEXT;

-- Step 2: Rename old columns (keep as backup during transition)
ALTER TABLE tenant_powershell_credentials
RENAME COLUMN username TO username_deprecated;

ALTER TABLE tenant_powershell_credentials
RENAME COLUMN encrypted_password TO encrypted_password_deprecated;

-- Step 3: Make new columns NOT NULL (after data migration if needed)
-- Note: If you have existing data, you'll need to populate app_id and certificate_thumbprint first
-- For new installations, this can be enforced immediately

-- Uncomment after data migration:
-- ALTER TABLE tenant_powershell_credentials
-- ALTER COLUMN app_id SET NOT NULL;

-- ALTER TABLE tenant_powershell_credentials
-- ALTER COLUMN certificate_thumbprint SET NOT NULL;

-- Step 4: Create an index on app_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_powershell_credentials_app_id
ON tenant_powershell_credentials(app_id);

COMMIT;

-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback this migration, run the following:
/*
BEGIN;

-- Rename columns back
ALTER TABLE tenant_powershell_credentials
RENAME COLUMN username_deprecated TO username;

ALTER TABLE tenant_powershell_credentials
RENAME COLUMN encrypted_password_deprecated TO encrypted_password;

-- Drop new columns
ALTER TABLE tenant_powershell_credentials
DROP COLUMN IF EXISTS app_id;

ALTER TABLE tenant_powershell_credentials
DROP COLUMN IF EXISTS certificate_thumbprint;

-- Drop index
DROP INDEX IF EXISTS idx_tenant_powershell_credentials_app_id;

COMMIT;
*/

-- POST-MIGRATION CLEANUP (Run after confirming new system works):
-- Once you've migrated all credentials and confirmed the system works:
/*
BEGIN;

ALTER TABLE tenant_powershell_credentials
DROP COLUMN IF EXISTS username_deprecated;

ALTER TABLE tenant_powershell_credentials
DROP COLUMN IF EXISTS encrypted_password_deprecated;

COMMIT;
*/
