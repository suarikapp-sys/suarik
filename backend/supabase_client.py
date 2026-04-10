"""
supabase_client.py
──────────────────
Single source of truth for all Supabase access in this backend.

Uses the SERVICE ROLE KEY (bypasses RLS) so it is safe ONLY for
server-side code — never expose this key to the frontend.

All public functions raise descriptive exceptions so callers
(routes, tasks) can decide how to handle each case.
"""

import os
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

# Load .env once at import time (no-op if already loaded by the parent process)
load_dotenv()


# ── Client factory (singleton) ────────────────────────────────────────────────

@lru_cache(maxsize=1)
def get_client() -> Client:
    """
    Return a cached Supabase admin client.

    Reads SUPABASE_URL and SUPABASE_KEY from the environment.
    Using @lru_cache means the connection is created only once per
    process (Celery workers included).

    Raises:
        RuntimeError: if either env var is missing.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")  # service-role key

    if not url or not key:
        raise RuntimeError(
            "Missing required env vars: SUPABASE_URL and SUPABASE_KEY. "
            "Check your .env file."
        )

    return create_client(url, key)


# ── User / profile helpers ────────────────────────────────────────────────────

def get_user_profile(user_id: str) -> dict:
    """
    Fetch a single profiles row by primary key.

    Returns:
        The profile dict (id, credits, plan, email, ...).

    Raises:
        ValueError: user does not exist.
    """
    sb = get_client()
    response = (
        sb.table("profiles")
        .select("id, credits, plan, email, full_name")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError(f"User not found: {user_id}")

    return response.data


def get_coin_balance(user_id: str) -> int:
    """
    Lightweight helper — fetches only the credits column.

    Returns:
        Current coin balance (int, never None).
    """
    sb = get_client()
    response = (
        sb.table("profiles")
        .select("credits")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError(f"User not found: {user_id}")

    return int(response.data.get("credits") or 0)


def add_coins(user_id: str, amount: int) -> int:
    """
    Add `amount` coins to a user's balance (used for refunds).

    Calls the Postgres function add_coins(uid, amount) which performs
    an atomic UPDATE so concurrent refunds never overwrite each other.

    Returns:
        New balance after the addition.

    SQL to create the function (run once in Supabase SQL editor):
        create or replace function add_coins(uid uuid, amount int)
        returns int language plpgsql as $$
        declare new_balance int;
        begin
          update profiles
             set credits = credits + amount
           where id = uid
        returning credits into new_balance;
          return new_balance;
        end; $$;
    """
    if amount <= 0:
        raise ValueError(f"add_coins: amount must be positive, got {amount}")

    sb = get_client()
    response = sb.rpc("add_coins", {"uid": user_id, "amount": amount}).execute()

    # The RPC returns the new balance as a scalar
    new_balance = response.data
    return int(new_balance) if new_balance is not None else 0


# ── Video job helpers ─────────────────────────────────────────────────────────

def create_video_job(job_id: str, user_id: str, payload: dict) -> None:
    """
    Insert a new video_jobs row with status='processing'.

    Called by the FastAPI route immediately before enqueueing to Celery,
    so the job exists in the DB before the worker starts.

    SQL to create the table (run once):
        create table video_jobs (
          id          uuid primary key,
          user_id     uuid references profiles(id) on delete cascade,
          status      text    not null default 'processing',
          result_url  text,
          error_msg   text,
          payload     jsonb,
          coin_cost   int,
          created_at  timestamptz default now(),
          updated_at  timestamptz default now()
        );
    """
    sb = get_client()
    sb.table("video_jobs").insert({
        "id":        job_id,
        "user_id":   user_id,
        "status":    "processing",
        "payload":   payload,
        "coin_cost": payload.get("coin_cost", 0),
    }).execute()


def update_video_status(
    job_id:     str,
    status:     str,
    result_url: Optional[str] = None,
    error_msg:  Optional[str] = None,
) -> None:
    """
    Update a video_jobs row after the Celery task finishes.

    Args:
        job_id:     UUID of the job.
        status:     One of: 'processing', 'completed', 'failed'.
        result_url: Public URL of the generated file (on completion).
        error_msg:  Human-readable reason for failure (on failure).
    """
    sb = get_client()
    payload: dict = {"status": status, "updated_at": "now()"}

    if result_url is not None:
        payload["result_url"] = result_url
    if error_msg is not None:
        payload["error_msg"] = error_msg

    sb.table("video_jobs").update(payload).eq("id", job_id).execute()


def count_active_jobs(user_id: str) -> int:
    """
    Count jobs currently in 'processing' state for this user.
    Used by the concurrency gate in queue_router.py.
    """
    sb = get_client()
    response = (
        sb.table("video_jobs")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "processing")
        .execute()
    )
    return response.count or 0


def get_video_job(job_id: str, user_id: str) -> dict:
    """
    Fetch a single video_jobs row, scoped to the owner.
    Returns the job dict or raises ValueError if not found.
    """
    sb = get_client()
    response = (
        sb.table("video_jobs")
        .select("id, status, result_url, error_msg, created_at")
        .eq("id", job_id)
        .eq("user_id", user_id)   # prevents users peeking at each other's jobs
        .single()
        .execute()
    )

    if not response.data:
        raise ValueError(f"Job {job_id} not found for user {user_id}")

    return response.data
