-- Migration: split_cert_tables (Phase 1: expand)
-- Move CDL cert fields from inline columns on users/jobs into focused side tables.
-- Old columns left in place; dropped in a later migration after code cuts over.
--
-- Note: cert values are validated by Zod schemas in shared/certEnums.ts at the
-- app boundary. We use text/text[] (not PG enums) because Drizzle's $inferInsert
-- collapses on tables with pgEnum().array() columns.

CREATE TABLE seeker_cert_profiles (
  user_id            integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cdl_class          text,
  cdl_state          text,
  cdl_endorsements   text[] NOT NULL DEFAULT '{}',
  cdl_restrictions   text[] NOT NULL DEFAULT '{}',
  cdl_expires_at     timestamp,
  years_experience   integer,
  has_hazmat         boolean NOT NULL DEFAULT false,
  has_tanker         boolean NOT NULL DEFAULT false,
  has_double_triple  boolean NOT NULL DEFAULT false,
  has_passenger      boolean NOT NULL DEFAULT false,
  has_school_bus     boolean NOT NULL DEFAULT false,
  updated_at         timestamp NOT NULL DEFAULT now()
);

CREATE TABLE job_cert_requirements (
  job_id                     integer PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  cdl_required               boolean NOT NULL DEFAULT false,
  cdl_class_required         text,
  cdl_endorsements_required  text[] NOT NULL DEFAULT '{}',
  cdl_restrictions_allowed   text[] NOT NULL DEFAULT '{}',
  min_years_experience       integer
);

INSERT INTO seeker_cert_profiles (
  user_id, cdl_class, cdl_state, cdl_endorsements, cdl_restrictions,
  cdl_expires_at, years_experience,
  has_hazmat, has_tanker, has_double_triple, has_passenger, has_school_bus
)
SELECT
  id, cdl_class, cdl_state, cdl_endorsements, cdl_restrictions,
  cdl_expires_at, years_experience,
  has_hazmat, has_tanker, has_double_triple, has_passenger, has_school_bus
FROM users
WHERE role = 'job_seeker'
  AND (cdl_class IS NOT NULL OR cdl_state IS NOT NULL
    OR cdl_endorsements <> '{}' OR cdl_restrictions <> '{}'
    OR cdl_expires_at IS NOT NULL OR years_experience IS NOT NULL
    OR has_hazmat OR has_tanker OR has_double_triple OR has_passenger OR has_school_bus)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO job_cert_requirements (
  job_id, cdl_required, cdl_class_required,
  cdl_endorsements_required, cdl_restrictions_allowed, min_years_experience
)
SELECT
  id, cdl_required, cdl_class_required,
  cdl_endorsements_required, cdl_restrictions_allowed,
  min_years_experience
FROM jobs
WHERE cdl_required
  OR cdl_class_required IS NOT NULL
  OR cdl_endorsements_required <> '{}'
  OR cdl_restrictions_allowed <> '{}'
  OR min_years_experience IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

CREATE INDEX seeker_cert_endorsements_idx ON seeker_cert_profiles USING GIN (cdl_endorsements);
CREATE INDEX seeker_cert_class_idx        ON seeker_cert_profiles (cdl_class);
CREATE INDEX job_cert_required_idx        ON job_cert_requirements (cdl_required) WHERE cdl_required;
CREATE INDEX job_cert_class_idx           ON job_cert_requirements (cdl_class_required);
CREATE INDEX job_cert_endorsements_idx    ON job_cert_requirements USING GIN (cdl_endorsements_required);
