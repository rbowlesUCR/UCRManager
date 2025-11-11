-- Migration: Add feature flags table
-- Description: Creates a table for managing feature toggles in the application
-- Date: 2025-11-10

CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on feature_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_feature_key ON feature_flags(feature_key);

-- Insert initial feature flag for number management (disabled by default)
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled)
VALUES (
  'number_management',
  'Number Management',
  'Phone number inventory management system with Microsoft Teams synchronization',
  FALSE
)
ON CONFLICT (feature_key) DO NOTHING;

-- Insert feature flag for bulk assignment (can be added later)
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled)
VALUES (
  'bulk_assignment',
  'Bulk Assignment',
  'Bulk assign phone numbers and policies to multiple users at once',
  TRUE
)
ON CONFLICT (feature_key) DO NOTHING;
