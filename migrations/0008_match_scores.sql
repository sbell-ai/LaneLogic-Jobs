-- Migration: match_scores
-- Cache of seeker<->job match scores computed by the Sprint 5 scoring engine.
-- Recomputed by POST /api/matches/compute (called directly by seekers and by
-- the Sprint 4 matchRecalc hook when employer requirements change).
--
-- Unique on (seeker_id, job_id) so the engine can upsert. score_breakdown is
-- a denormalized JSONB blob — see shared/matchTypes.ts for shape.
--
-- seeker_id references users(id): in this app a "seeker" is a row in users
-- with role='job_seeker'. There is no separate seekers table.

CREATE TABLE match_scores (
  id                serial PRIMARY KEY,
  seeker_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id            integer NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score             integer NOT NULL CHECK (score >= 0 AND score <= 100),
  projected_score   integer NOT NULL CHECK (projected_score >= 0 AND projected_score <= 100),
  score_breakdown   jsonb NOT NULL,
  has_disqualifier  boolean NOT NULL DEFAULT false,
  computed_at       timestamp NOT NULL DEFAULT now(),
  UNIQUE (seeker_id, job_id)
);

CREATE INDEX idx_match_scores_seeker ON match_scores(seeker_id);
CREATE INDEX idx_match_scores_score  ON match_scores(seeker_id, score DESC);
