"""
celery_app.py
─────────────
Celery application factory.

Broker  : Redis  (REDIS_URL from .env)
Backend : Redis  (same URL — stores task results for polling)

Three isolated queues, one per user tier:
  queue_starter        — free / starter users
  queue_pro            — pro / growth users
  queue_vip_enterprise — enterprise users (dedicated workers, never blocked by lower tiers)

Workers are started from the terminal (see commands at the bottom of queue_router.py).
"""

import os

from celery import Celery
from dotenv import load_dotenv
from kombu import Queue

# Load .env here so the REDIS_URL is available even when this module is
# imported directly (e.g. by a Celery worker process launched without uvicorn).
load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# ── Application instance ──────────────────────────────────────────────────────

celery = Celery(
    "copiloto",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"],        # auto-import tasks.py on worker startup
)

# ── Configuration ─────────────────────────────────────────────────────────────

celery.conf.update(
    # Serialisation — JSON only (safe across Python versions and languages)
    task_serializer   = "json",
    result_serializer = "json",
    accept_content    = ["json"],

    # Timezone
    timezone   = "America/Sao_Paulo",
    enable_utc = True,

    # Keep task results in Redis for 24 hours, then auto-expire
    result_expires = 86_400,

    # Visibility timeout must exceed the longest possible task.
    # DreamFace avatar renders can take ~10 min, so 1 hour is safe.
    broker_transport_options = {"visibility_timeout": 3600},

    # ── The 3 queues ──────────────────────────────────────────────────────────
    task_queues = (
        Queue("queue_starter"),
        Queue("queue_pro"),
        Queue("queue_vip_enterprise"),
    ),
    task_default_queue = "queue_starter",

    # Fallback static routing (dynamic routing via .apply_async(queue=...) takes precedence)
    task_routes = {
        "tasks.process_video_ia": {"queue": "queue_starter"},
    },

    # ── Reliability ───────────────────────────────────────────────────────────
    # ack_late: acknowledge the message AFTER the task completes, not before.
    # If the worker crashes mid-task, the message is re-queued automatically.
    task_acks_late             = True,
    task_reject_on_worker_lost = True,

    # ── Runaway task protection ───────────────────────────────────────────────
    task_soft_time_limit = 600,   # 10 min → SoftTimeLimitExceeded (task can clean up)
    task_time_limit      = 660,   # 11 min → SIGKILL (hard stop)

    # ── Prefetch: 1 message per worker slot keeps queue distribution fair ─────
    worker_prefetch_multiplier = 1,
)
