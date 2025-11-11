-- Migration 0005: Add before/after state tracking to audit logs
-- Purpose: Enable revert functionality by capturing complete user configuration before and after changes
-- Created: 2025-11-11

-- Add JSONB columns for flexible state tracking (supports all 10 policy types)
ALTER TABLE audit_logs
  ADD COLUMN before_state JSONB,
  ADD COLUMN after_state JSONB;

-- Add helpful comments for documentation
COMMENT ON COLUMN audit_logs.before_state IS 'Complete user configuration before change (for revert functionality). Stores JSON with all relevant Teams properties.';
COMMENT ON COLUMN audit_logs.after_state IS 'Complete user configuration after change. Stores JSON with all relevant Teams properties.';

-- Verify columns were added successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'before_state'
  ) THEN
    RAISE EXCEPTION 'Migration failed: before_state column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'after_state'
  ) THEN
    RAISE EXCEPTION 'Migration failed: after_state column not found';
  END IF;

  RAISE NOTICE 'Migration 0005 completed successfully: before_state and after_state columns added to audit_logs';
END $$;
