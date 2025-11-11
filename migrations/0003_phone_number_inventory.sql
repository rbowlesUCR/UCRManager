-- Phone Number Inventory Table Migration
-- Adds comprehensive DID/number management system
-- Date: 2025-11-04

CREATE TABLE IF NOT EXISTS "phone_number_inventory" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "customer_tenants"("id") ON DELETE CASCADE,

  -- Phone number details
  "line_uri" text NOT NULL,
  "display_name" text,
  "user_principal_name" text,

  -- Service provider and location information
  "carrier" text,
  "location" text,
  "usage_location" text,

  -- Teams/UC configuration
  "online_voice_routing_policy" text,

  -- Number classification and status
  "number_type" text NOT NULL DEFAULT 'did',
  "status" text NOT NULL DEFAULT 'available',

  -- Lifecycle management
  "reserved_by" text,
  "reserved_at" timestamp,
  "aging_until" timestamp,
  "assigned_at" timestamp,

  -- Additional metadata
  "notes" text,
  "tags" text,
  "number_range" text,

  -- External system tracking (for future integrations)
  "external_system_id" text,
  "external_system_type" text,

  -- Audit fields
  "created_by" text NOT NULL,
  "last_modified_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_phone_number_inventory_tenant_id" ON "phone_number_inventory"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_phone_number_inventory_line_uri" ON "phone_number_inventory"("line_uri");
CREATE INDEX IF NOT EXISTS "idx_phone_number_inventory_status" ON "phone_number_inventory"("status");
CREATE INDEX IF NOT EXISTS "idx_phone_number_inventory_number_type" ON "phone_number_inventory"("number_type");
CREATE INDEX IF NOT EXISTS "idx_phone_number_inventory_user_principal_name" ON "phone_number_inventory"("user_principal_name");
