-- Migration: AI job seeding agent (Sprint 7)
--
-- Adds the columns the seeding agent uses to mark a job as internally
-- scraped, the (title|company|location) hash that gates duplicate inserts,
-- and lat/lng so location scoring (Sprint 5) can use seeded jobs without a
-- second geocoding pass at match time.
--
-- jobs.source_url already exists (added in an earlier import sprint), so we
-- only add the new columns. The unique index is partial — it lets pre-seed
-- jobs (NULL hash) coexist with seeded ones without triggering uniqueness.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_seeded   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS lat         NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS lng         NUMERIC(9, 6);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_hash
  ON jobs(source_hash)
  WHERE source_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS seed_log (
  id                SERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  triggered_by      TEXT NOT NULL CHECK (triggered_by IN ('cron', 'admin')),
  admin_user_id     INTEGER REFERENCES users(id),
  total_scraped     INTEGER NOT NULL DEFAULT 0,
  total_normalized  INTEGER NOT NULL DEFAULT 0,
  total_inserted    INTEGER NOT NULL DEFAULT 0,
  total_skipped     INTEGER NOT NULL DEFAULT 0,
  total_errors      INTEGER NOT NULL DEFAULT 0,
  per_source        JSONB,
  error_log         JSONB
);

CREATE INDEX IF NOT EXISTS idx_seed_log_started ON seed_log(started_at DESC);
