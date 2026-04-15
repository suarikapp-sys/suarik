-- ─── Performance indexes ─────────────────────────────────────────────────────
-- Run once in Supabase SQL Editor (or via migration).
-- These cover the most common query patterns at scale (100+ users).

-- Projects: history tab and dashboard list (user_id + recency)
CREATE INDEX IF NOT EXISTS idx_projects_user_created
  ON projects(user_id, created_at DESC);

-- Generations: usage log queries per user
CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON generations(user_id, created_at DESC);

-- Stripe events: idempotency table — prune old entries by date
CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON stripe_events(received_at DESC);

-- Profiles: Stripe customer lookup (webhook needs this)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
