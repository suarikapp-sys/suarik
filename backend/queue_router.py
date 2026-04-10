"""
queue_router.py
───────────────
PILLAR 3 — VIP Routing and Concurrency Limits.

Maps user plan tiers to the correct Celery queue and enforces per-user
concurrency caps by querying the database (not an in-memory counter,
so it's accurate across multiple worker processes and restarts).

Queue hierarchy:
  queue_starter        → starter plan          (default, shared workers)
  queue_pro            → pro / growth plans    (dedicated workers)
  queue_vip_enterprise → enterprise plan       (exclusive workers, zero wait)

Concurrency limits (max simultaneous 'processing' jobs per user):
  starter    → 1
  pro        → 3
  growth     → 5
  enterprise → 10

Usage in FastAPI route:
  from queue_router import ConcurrencyLimitError, check_concurrency_limit, get_queue_for_tier

  queue = get_queue_for_tier(user_tier)

  try:
      check_concurrency_limit(user_id, user_tier)
  except ConcurrencyLimitError as e:
      raise HTTPException(status_code=429, detail=str(e))

─────────────────────────────────────────────────────────────────────────
STARTING WORKERS (run in the terminal from the backend/ directory)
─────────────────────────────────────────────────────────────────────────

# Development — one worker handles all three queues
celery -A celery_app.celery worker --loglevel=info \\
       -Q queue_starter,queue_pro,queue_vip_enterprise -c 4

# Production — dedicated process per tier
# Starter (2 slots — cost efficient)
celery -A celery_app.celery worker --loglevel=info \\
       -Q queue_starter -c 2 -n worker_starter@%h

# Pro (4 slots)
celery -A celery_app.celery worker --loglevel=info \\
       -Q queue_pro -c 4 -n worker_pro@%h

# Enterprise (8 slots — exclusive, never blocked by lower-tier load)
celery -A celery_app.celery worker --loglevel=info \\
       -Q queue_vip_enterprise -c 8 -n worker_enterprise@%h \\
       --prefetch-multiplier 1

# Monitor via Flower
celery -A celery_app.celery flower --port=5555
─────────────────────────────────────────────────────────────────────────
"""

from supabase_client import count_active_jobs

# ── Custom exception ──────────────────────────────────────────────────────────

class ConcurrencyLimitError(Exception):
    """
    Raised when a user tries to queue more jobs than their plan allows.

    FastAPI routes catch this and return HTTP 429:

        except ConcurrencyLimitError as e:
            raise HTTPException(status_code=429, detail=str(e))

    Structured fields (active_jobs, plan_limit, user_tier) are available
    as attributes for richer API responses.
    """
    def __init__(self, user_tier: str, active_jobs: int, plan_limit: int) -> None:
        self.user_tier  = user_tier
        self.active_jobs = active_jobs
        self.plan_limit  = plan_limit
        super().__init__(
            f"Concurrency limit reached for plan '{user_tier}': "
            f"{active_jobs} job(s) already processing "
            f"(max allowed: {plan_limit}). "
            "Wait for a job to finish or upgrade your plan."
        )


# ── Routing table ─────────────────────────────────────────────────────────────

_TIER_QUEUE: dict[str, str] = {
    "starter":    "queue_starter",
    "pro":        "queue_pro",
    "growth":     "queue_pro",
    "enterprise": "queue_vip_enterprise",
}

_DEFAULT_QUEUE = "queue_starter"

# ── Concurrency caps ──────────────────────────────────────────────────────────

_TIER_LIMIT: dict[str, int] = {
    "starter":    1,
    "pro":        3,
    "growth":     5,
    "enterprise": 10,
}

_DEFAULT_LIMIT = 1


# ── Public API ────────────────────────────────────────────────────────────────

def get_queue_for_tier(user_tier: str) -> str:
    """
    Return the Celery queue name for the given user tier.

    Unknown tiers default to queue_starter (safest fallback — never
    accidentally grants VIP throughput to an unrecognised plan name).

    Args:
        user_tier: Plan name from the user's profile (case-insensitive).

    Returns:
        One of: "queue_starter", "queue_pro", "queue_vip_enterprise".

    Examples:
        >>> get_queue_for_tier("starter")
        "queue_starter"
        >>> get_queue_for_tier("growth")
        "queue_pro"
        >>> get_queue_for_tier("enterprise")
        "queue_vip_enterprise"
        >>> get_queue_for_tier("unknown_plan")
        "queue_starter"
    """
    return _TIER_QUEUE.get(user_tier.lower(), _DEFAULT_QUEUE)


def check_concurrency_limit(user_id: str, user_tier: str) -> None:
    """
    Raise ConcurrencyLimitError if the user has reached their parallel job cap.

    Counts jobs with status='processing' directly in Supabase so the check
    is accurate across multiple Celery worker processes and server restarts
    (no shared in-memory state required).

    Args:
        user_id:   UUID of the authenticated user.
        user_tier: Plan name from the user's profile (case-insensitive).

    Returns:
        None — function returns silently when the user is within their limit.

    Raises:
        ConcurrencyLimitError: user has ≥ plan_limit jobs currently processing.

    Example:
        # A starter user with 1 job already processing:
        check_concurrency_limit("uuid-...", "starter")
        # → raises ConcurrencyLimitError("starter", active_jobs=1, plan_limit=1)
    """
    tier  = user_tier.lower()
    limit = _TIER_LIMIT.get(tier, _DEFAULT_LIMIT)

    # Single DB query — count_active_jobs uses .select("id", count="exact")
    active = count_active_jobs(user_id)

    if active >= limit:
        raise ConcurrencyLimitError(
            user_tier  = user_tier,
            active_jobs = active,
            plan_limit  = limit,
        )
