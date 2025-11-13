-- Remove mfa_code column from 3CX credentials table
-- MFA code will be entered interactively during connection/authentication

ALTER TABLE tenant_3cx_credentials DROP COLUMN IF EXISTS mfa_code;

COMMIT;
