-- ─── stripe_events ── Idempotency log for Stripe webhooks ──────────────────
-- Stripe retries webhooks on non-2xx. Without an idempotency check, a retry
-- after a slow-but-successful processing can double-credit users.
--
-- Pattern: INSERT the event_id BEFORE any side effect. The UNIQUE constraint
-- on event_id is the lock; if the INSERT fails with 23505, we've already
-- processed this event and safely return 200 without re-running the handler.

create table if not exists stripe_events (
  event_id    text primary key,
  event_type  text not null,
  received_at timestamptz not null default now()
);

-- TTL cleanup (optional, run manually or via cron): keep ~90 days
-- delete from stripe_events where received_at < now() - interval '90 days';
