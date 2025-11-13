-- Add 3CX credentials table for storing 3CX authentication details per tenant

CREATE TABLE IF NOT EXISTS tenant_3cx_credentials (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES customer_tenants(id) ON DELETE CASCADE,
  server_url TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_code TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  last_modified_by TEXT NOT NULL,
  UNIQUE(tenant_id) -- One set of 3CX credentials per tenant
);

-- Create index for faster lookups by tenant
CREATE INDEX IF NOT EXISTS idx_3cx_credentials_tenant_id ON tenant_3cx_credentials(tenant_id);

COMMIT;
