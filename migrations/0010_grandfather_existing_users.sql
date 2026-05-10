-- Migration: grandfather existing users past onboarding
--
-- 0009 added users.onboarding_completed_at as a nullable column with no
-- default, so every pre-existing user has a NULL value and the Sprint 6
-- onboarding gate would force-redirect them all to /onboarding/seeker or
-- /onboarding/employer on next visit.
--
-- This is a one-shot backfill that marks anyone who existed at migration
-- time as already onboarded. Anyone registering AFTER this migration runs
-- still gets NULL by default and goes through the wizard normally — the
-- runner applies each file once, so this UPDATE only fires at deploy.

UPDATE users
   SET onboarding_completed_at = NOW()
 WHERE onboarding_completed_at IS NULL;
