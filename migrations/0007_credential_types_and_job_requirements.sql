-- Migration: credential_types_and_job_requirements
-- Introduces a modal-agnostic credential registry plus a job<->credential
-- requirements junction table. Trucking namespace is seeded; maritime,
-- aviation, and logistics are accepted by the CHECK but not yet seeded.
--
-- Coexists with the existing CDL-specific job_cert_requirements table from
-- migration 0003. No backfill or dual-write — the two tables describe
-- credentials from different angles for now.

CREATE TABLE credential_types (
  id                  serial PRIMARY KEY,
  modal_namespace     text NOT NULL CHECK (modal_namespace IN ('trucking','maritime','aviation','logistics')),
  code                text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text,
  issuing_authority   text,
  has_expiry          boolean NOT NULL DEFAULT true,
  verification_method text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_credential_types_namespace ON credential_types(modal_namespace);

CREATE TABLE job_credential_requirements (
  id                 serial PRIMARY KEY,
  job_id             integer NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  credential_type_id integer NOT NULL REFERENCES credential_types(id),
  requirement_level  text NOT NULL CHECK (requirement_level IN ('required','preferred')),
  notes              text,
  created_at         timestamp NOT NULL DEFAULT now(),
  UNIQUE (job_id, credential_type_id)
);

CREATE INDEX idx_job_cred_req_job ON job_credential_requirements(job_id);

-- Trucking seed (12 rows). Maritime/aviation/logistics rows are intentionally
-- omitted; they will be seeded in a future sprint.
INSERT INTO credential_types (modal_namespace, code, name, issuing_authority, has_expiry, verification_method) VALUES
  ('trucking', 'CDL_CLASS_A',     'CDL Class A',             'FMCSA', true,  'clearinghouse'),
  ('trucking', 'CDL_CLASS_B',     'CDL Class B',             'FMCSA', true,  'clearinghouse'),
  ('trucking', 'CDL_CLASS_C',     'CDL Class C',             'FMCSA', true,  'clearinghouse'),
  ('trucking', 'END_HAZMAT',      'HazMat Endorsement',      'FMCSA', true,  'clearinghouse'),
  ('trucking', 'END_TANKER',      'Tanker Endorsement',      'FMCSA', true,  'clearinghouse'),
  ('trucking', 'END_DOUBLES',     'Doubles/Triples',         'FMCSA', true,  'clearinghouse'),
  ('trucking', 'END_PASSENGER',   'Passenger Endorsement',   'FMCSA', true,  'clearinghouse'),
  ('trucking', 'END_SCHOOL_BUS',  'School Bus Endorsement',  'FMCSA', true,  'clearinghouse'),
  ('trucking', 'TWIC',            'TWIC Card',               'TSA',   true,  'document_upload'),
  ('trucking', 'MED_CERT_2YR',    'DOT Medical Certificate', 'FMCSA', true,  'document_upload'),
  ('trucking', 'HAZMAT_TRAINING', 'HazMat Safety Training',  'DOT',   true,  'document_upload'),
  ('trucking', 'CLEAN_MVR',       'Clean MVR (3yr)',         NULL,    false, 'self_reported');
