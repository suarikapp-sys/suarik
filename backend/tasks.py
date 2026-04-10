"""
tasks.py
────────
PILLAR 2 — Asynchronous Executor.

Defines the single Celery task that drives all video generation jobs:

  process_video_ia(task_id, user_id, script_text, cost_coins)

Lifecycle of a job:
  1. Worker picks up the message from the queue.
  2. Status is set to 'processing' in Supabase (idempotent — already set by the
     FastAPI route, but re-confirmed here in case of a late-ack re-delivery).
  3. brain.generate_timeline_vsl() is called with the script text.
  4. On success → status set to 'completed', result JSON saved to the payload column.
  5. On BrainError → retry up to MAX_RETRIES times with exponential backoff.
  6. On final failure (retries exhausted OR unexpected fatal error):
       - status set to 'failed'
       - cost_coins refunded to the user via economy.refund()

Retry strategy:
  - Max 3 retries (4 total attempts)
  - Countdown: 10s → 20s → 40s  (doubles each attempt)
  - Only BrainError triggers a retry (transient AI API failures)
  - All other exceptions fail immediately without retry (programmer errors, etc.)

Logging:
  Every state transition is logged at INFO or ERROR level with the job_id
  prefix so worker terminal output is easy to grep:
      grep "job=<uuid>" celery.log
"""

import json
import logging

from celery import Task
from celery.exceptions import MaxRetriesExceededError
from celery.utils.log import get_task_logger

from brain import BrainError, generate_timeline_vsl
from celery_app import celery
from economy import refund
from supabase_client import create_video_job, update_video_status

logger: logging.Logger = get_task_logger(__name__)

# ── Retry config ──────────────────────────────────────────────────────────────

MAX_RETRIES  = 3
BASE_BACKOFF = 10   # seconds; doubles on each attempt (10 → 20 → 40)


# ── Helper: terminal-friendly status log ─────────────────────────────────────

def _log(job_id: str, level: str, msg: str, *args: object) -> None:
    """Prefix every log line with [job=<id>] for easy grep."""
    getattr(logger, level)(f"[job={job_id}] {msg}", *args)


# ── Task ──────────────────────────────────────────────────────────────────────

@celery.task(
    bind        = True,
    name        = "tasks.process_video_ia",
    max_retries = MAX_RETRIES,
    acks_late   = True,           # inherited from celery_app but explicit here for clarity
)
def process_video_ia(
    self:        Task,
    task_id:     str,   # UUID — matches the video_jobs row id
    user_id:     str,   # UUID — owner of the job
    script_text: str,   # full VSL script to slice into scenes
    cost_coins:  int,   # coins already deducted — returned on final failure
) -> dict:
    """
    Core async task: turn a script into a structured VSL timeline.

    Args:
        task_id:     UUID of the video_jobs row (also used as the Celery task id).
        user_id:     UUID of the authenticated user who submitted the job.
        script_text: Full VSL script text to be sliced into timeline scenes.
        cost_coins:  Number of coins that were deducted at submission time.
                     Refunded automatically if the job ultimately fails.

    Returns:
        {"status": "completed", "scenes": [...], "total": N}

    The return value is stored in the Celery/Redis result backend and can be
    retrieved via AsyncResult(task_id).result.
    """
    attempt = self.request.retries + 1   # human-readable (1-based)
    _log(task_id, "info",
         "attempt %d/%d — user=%s script_len=%d chars",
         attempt, MAX_RETRIES + 1, user_id, len(script_text))

    # ── Step 1: Confirm 'processing' status in Supabase ───────────────────────
    # The FastAPI route already inserted the row with status='processing', but
    # confirming here handles the rare case of late-ack re-delivery after a
    # worker crash, ensuring the row is never left in a stale state.
    try:
        update_video_status(task_id, "processing")
        _log(task_id, "info", "status → processing")
    except Exception as exc:
        # Non-fatal: log and continue — the row was created by the route.
        _log(task_id, "warning", "could not confirm 'processing' status: %s", exc)

    # ── Step 2: Call the AI brain ─────────────────────────────────────────────
    try:
        _log(task_id, "info", "calling generate_timeline_vsl …")
        scenes = generate_timeline_vsl(script_text)
        _log(task_id, "info", "brain returned %d scenes", len(scenes))

    except BrainError as exc:
        # Transient AI failure — retry with exponential backoff
        countdown = BASE_BACKOFF * (2 ** self.request.retries)   # 10s, 20s, 40s
        _log(task_id, "warning",
             "BrainError on attempt %d/%d — retrying in %ds. Error: %s",
             attempt, MAX_RETRIES + 1, countdown, exc)

        try:
            raise self.retry(exc=exc, countdown=countdown)

        except MaxRetriesExceededError:
            # All retries exhausted — fall through to the failure handler below
            _log(task_id, "error",
                 "max retries (%d) exhausted after BrainError: %s", MAX_RETRIES, exc)
            _handle_failure(task_id, user_id, cost_coins, reason=str(exc))
            return {"status": "failed", "error": str(exc)}

    except Exception as exc:
        # Unexpected / non-transient error — fail immediately, no retry
        _log(task_id, "error", "fatal unexpected error: %s", exc, exc_info=True)
        _handle_failure(task_id, user_id, cost_coins, reason=str(exc))
        return {"status": "failed", "error": str(exc)}

    # ── Step 3: Persist result and mark completed ─────────────────────────────
    try:
        result_payload = json.dumps(scenes, ensure_ascii=False)
        update_video_status(
            task_id,
            "completed",
            result_url  = None,            # timeline jobs produce JSON, not a media URL
            error_msg   = None,
        )

        # Store the scene JSON directly in the payload column so the frontend
        # can retrieve it with a single GET /job/<id> — no second API call needed.
        from supabase_client import get_client
        get_client().table("video_jobs").update(
            {"payload": scenes}            # Supabase stores dicts as JSONB natively
        ).eq("id", task_id).execute()

        _log(task_id, "info", "status → completed (%d scenes saved)", len(scenes))

    except Exception as exc:
        # If the DB write fails after a successful AI call, mark failed and refund.
        # The scenes were generated but we can't guarantee the client will see them,
        # so refunding is the correct user-trust choice.
        _log(task_id, "error",
             "DB write failed after successful AI call: %s — refunding", exc)
        _handle_failure(task_id, user_id, cost_coins, reason=f"DB write error: {exc}")
        return {"status": "failed", "error": str(exc)}

    return {
        "status": "completed",
        "scenes": scenes,
        "total":  len(scenes),
    }


# ── Failure handler ───────────────────────────────────────────────────────────

def _handle_failure(
    task_id:    str,
    user_id:    str,
    cost_coins: int,
    reason:     str = "",
) -> None:
    """
    Mark the job as 'failed' in Supabase and refund the user's coins.

    Each operation is wrapped in its own try/except so a DB outage during
    the status update does not prevent the refund from being attempted, and
    vice versa.
    """
    # 1. Update job status
    try:
        update_video_status(task_id, "failed", error_msg=reason[:500])
        _log(task_id, "info", "status → failed (reason: %s)", reason[:120])
    except Exception as exc:
        _log(task_id, "error",
             "could not set status to 'failed' in Supabase: %s", exc)

    # 2. Refund coins
    if cost_coins > 0:
        try:
            new_balance = refund(user_id, cost_coins)
            _log(task_id, "info",
                 "refunded %d coins to user %s — new balance: %d",
                 cost_coins, user_id, new_balance)
        except Exception as exc:
            # Refund failed — this needs manual resolution.
            # In production: push to a dead-letter queue or alert via Sentry.
            _log(task_id, "error",
                 "REFUND FAILED for user %s (%d coins): %s — REQUIRES MANUAL REVIEW",
                 user_id, cost_coins, exc)
