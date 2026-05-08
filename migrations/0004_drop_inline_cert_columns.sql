-- Migration: drop_inline_cert_columns (Phase 4: contract)
-- Run after seeker_cert_profiles / job_cert_requirements are fully adopted.
-- Cert data has moved to focused side tables; the inline columns are unused.

ALTER TABLE users
  DROP COLUMN IF EXISTS cdl_class,
  DROP COLUMN IF EXISTS cdl_state,
  DROP COLUMN IF EXISTS cdl_endorsements,
  DROP COLUMN IF EXISTS cdl_restrictions,
  DROP COLUMN IF EXISTS cdl_expires_at,
  DROP COLUMN IF EXISTS years_experience,
  DROP COLUMN IF EXISTS has_hazmat,
  DROP COLUMN IF EXISTS has_tanker,
  DROP COLUMN IF EXISTS has_double_triple,
  DROP COLUMN IF EXISTS has_passenger,
  DROP COLUMN IF EXISTS has_school_bus;

ALTER TABLE jobs
  DROP COLUMN IF EXISTS cdl_required,
  DROP COLUMN IF EXISTS cdl_class_required,
  DROP COLUMN IF EXISTS cdl_endorsements_required,
  DROP COLUMN IF EXISTS cdl_restrictions_allowed,
  DROP COLUMN IF EXISTS min_years_experience;
