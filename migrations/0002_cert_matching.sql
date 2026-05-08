-- Migration: cert_matching
-- Adds cert profile columns to users, cert requirement columns to jobs

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cdl_class text,
  ADD COLUMN IF NOT EXISTS cdl_state text,
  ADD COLUMN IF NOT EXISTS cdl_endorsements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cdl_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cdl_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS has_hazmat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_tanker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_double_triple boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_passenger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_school_bus boolean NOT NULL DEFAULT false;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS cdl_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cdl_class_required text,
  ADD COLUMN IF NOT EXISTS cdl_endorsements_required text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cdl_restrictions_allowed text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_years_experience integer;