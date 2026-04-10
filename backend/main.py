"""
main.py
───────
FastAPI application — Copiloto de Edição backend.

Endpoints:
  POST /generate-video   → validate JWT, deduct coins, enqueue Celery task
  GET  /status/{task_id} → poll job status + result payload when completed
  GET  /health           → liveness probe

Auth:
  Every protected endpoint requires a Supabase JWT in the Authorization header:
    Authorization: Bearer <supabase_access_token>

  The `require_auth` dependency validates the token via the Supabase client,
  extracts the user_id and plan from the profiles table, and injects them into
  the route. No user_id is accepted from the request body.

Error contracts:
  401 → missing / invalid / expired JWT
  402 → InsufficientFundsError  (not enough credits)
  429 → ConcurrencyLimitError   (too many parallel jobs for this plan)
  502 → unexpected internal error
"""

import logging
import uuid as uuid_lib
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from economy import InsufficientFundsError, check_and_deduct, estimate_cost, refund
from queue_router import ConcurrencyLimitError, check_concurrency_limit, get_queue_for_tier
from supabase_client import create_video_job, get_client, get_user_profile, get_video_job
from tasks import process_video_ia

load_dotenv()

logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "Copiloto de Edição API",
    version     = "1.0.0",
    description = "Async VSL generation backend — queue, economy, and brain.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],    # tighten to your Vercel domain before going public
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Auth dependency ───────────────────────────────────────────────────────────

async def require_auth(authorization: str = Header(...)) -> Dict:
    """
    Validate the Supabase JWT and return the caller's profile dict.

    Expects:  Authorization: Bearer <access_token>

    Returns:
        Profile dict with keys: id, credits, plan, email, full_name

    Raises:
        HTTPException 401: token missing, malformed, or expired.
        HTTPException 404: token valid but profile row not found.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header must start with 'Bearer '.")

    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is empty.")

    sb = get_client()

    try:
        user_resp = sb.auth.get_user(token)
    except Exception as exc:
        logger.warning("JWT validation error: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if not user_resp or not user_resp.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = user_resp.user.id

    try:
        profile = get_user_profile(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Profile not found for user {user_id}.")

    return profile


# ── Request / Response models ─────────────────────────────────────────────────

class VideoRequest(BaseModel):
    """Payload for POST /generate-video."""
    script_text: str = Field(
        ...,
        min_length  = 20,
        description = "Full VSL script to be sliced into a timeline",
    )


class QueuedResponse(BaseModel):
    status:  str
    task_id: str
    cost:    int
    balance: int
    queue:   str


class StatusResponse(BaseModel):
    task_id: str
    status:  str
    total:   Optional[int]         = None
    scenes:  Optional[List[dict]]  = None
    error:   Optional[str]         = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/generate-video", response_model=QueuedResponse, status_code=202)
def generate_video(
    body:    VideoRequest,
    profile: Dict = Depends(require_auth),
):
    """
    Entry point for all video generation jobs.

    Flow:
      1. Extract user_id and plan from the validated JWT profile
      2. Estimate coin cost
      3. Check concurrency limit — reject 429 if at cap
      4. Deduct coins atomically — reject 402 if broke
      5. Insert video_jobs row
      6. Enqueue Celery task on the correct tier queue
      7. Return task_id immediately (client polls /status/{task_id})
    """
    user_id   = profile["id"]
    user_tier = profile.get("plan", "starter")

    # ── 1. Estimate cost ───────────────────────────────────────────────────────
    cost = estimate_cost("voice", duration_seconds=60)
    logger.info("[user=%s tier=%s] estimated cost: %d coins", user_id, user_tier, cost)

    # ── 2. Concurrency gate ────────────────────────────────────────────────────
    try:
        check_concurrency_limit(user_id, user_tier)
    except ConcurrencyLimitError as exc:
        logger.warning("[user=%s] concurrency limit hit: %s", user_id, exc)
        raise HTTPException(
            status_code = 429,
            detail = {
                "error":       "CONCURRENCY_LIMIT_REACHED",
                "message":     str(exc),
                "active_jobs": exc.active_jobs,
                "plan_limit":  exc.plan_limit,
            },
        )

    # ── 3. Deduct coins ────────────────────────────────────────────────────────
    try:
        new_balance = check_and_deduct(user_id, cost)
        logger.info("[user=%s] deducted %d coins — new balance: %d", user_id, cost, new_balance)
    except InsufficientFundsError as exc:
        logger.warning("[user=%s] insufficient funds: %s", user_id, exc)
        raise HTTPException(
            status_code = 402,
            detail = {
                "error":     "INSUFFICIENT_FUNDS",
                "message":   str(exc),
                "balance":   exc.balance,
                "cost":      exc.cost,
                "shortfall": exc.shortfall,
            },
        )

    # ── 4. Create job record ───────────────────────────────────────────────────
    task_id = str(uuid_lib.uuid4())

    try:
        create_video_job(
            job_id  = task_id,
            user_id = user_id,
            payload = {
                "script_text": body.script_text,
                "user_tier":   user_tier,
                "cost":        cost,
            },
        )
    except Exception as exc:
        logger.error("[user=%s] DB insert failed: %s — refunding %d coins", user_id, exc, cost)
        refund(user_id, cost)
        raise HTTPException(status_code=502, detail="Failed to create job record. Coins refunded.")

    # ── 5. Enqueue ─────────────────────────────────────────────────────────────
    queue = get_queue_for_tier(user_tier)

    process_video_ia.apply_async(
        kwargs  = {
            "task_id":     task_id,
            "user_id":     user_id,
            "script_text": body.script_text,
            "cost_coins":  cost,
        },
        queue   = queue,
        task_id = task_id,
    )

    logger.info("[task=%s] enqueued on %s", task_id, queue)

    return QueuedResponse(
        status  = "queued",
        task_id = task_id,
        cost    = cost,
        balance = new_balance,
        queue   = queue,
    )


@app.get("/status/{task_id}", response_model=StatusResponse)
def get_status(
    task_id: str,
    profile: Dict = Depends(require_auth),
):
    """
    Poll the status of a video generation job.

    The JWT ensures users can only read their own jobs (enforced in
    get_video_job via a user_id filter on the DB query).

    Returns:
      - processing → just the status
      - completed  → status + scenes list + total count
      - failed     → status + error message
    """
    user_id = profile["id"]

    try:
        job = get_video_job(task_id, user_id)
    except ValueError:
        raise HTTPException(
            status_code = 404,
            detail      = f"Job '{task_id}' not found.",
        )

    response = StatusResponse(
        task_id = job["id"],
        status  = job["status"],
    )

    if job["status"] == "completed":
        payload        = job.get("payload") or {}
        scenes         = payload if isinstance(payload, list) else payload.get("scenes") or []
        response.scenes = scenes
        response.total  = len(scenes)

    elif job["status"] == "failed":
        response.error = job.get("error_msg") or "Unknown error."

    return response


@app.get("/health")
def health():
    """Liveness probe — returns 200 OK as long as the process is alive."""
    return {"status": "ok"}
