-- Migration: onboarding and email log
-- Sprint 6: lights up onboarding gating, geolocation-based location scoring,
-- modal preference, and a transactional email dedup log.
--
-- experience_years was deliberately not added — seeker_cert_profiles already
-- has years_experience and Sprint 5's match engine reads from there. The
-- onboarding wizard's years input writes to that existing column instead of
-- creating a parallel users.experience_years.

-- New columns on users
ALTER TABLE users
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN lat NUMERIC(9,6),
  ADD COLUMN lng NUMERIC(9,6),
  ADD COLUMN seeker_preferences JSONB,
  ADD COLUMN primary_modal TEXT
    CHECK (primary_modal IS NULL OR primary_modal IN ('trucking','maritime','aviation','logistics'));

-- Email deduplication log. UNIQUE constraint guarantees we never send the
-- same template to the same user for the same reference more than once.
CREATE TABLE email_log (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template     TEXT NOT NULL,
  reference_id TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template, reference_id)
);

CREATE INDEX idx_email_log_user ON email_log(user_id);
CREATE INDEX idx_email_log_template ON email_log(template, sent_at);
