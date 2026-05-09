-- Migration: employer_dot_mc
-- Adds structured DOT and MC number fields to the users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dot_number text,
  ADD COLUMN IF NOT EXISTS mc_number text;
