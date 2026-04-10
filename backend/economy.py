"""
economy.py
──────────
PILLAR 4 — Coin Economy.
Single source of truth for all credit operations in this backend.

Pricing:
  voice  → 20 coins / minute  (rounded up to the nearest full minute)
  avatar → 500 coins / minute (rounded up)

Examples:
  cost = estimate_cost("voice", duration_seconds=90)   # → 40  (2 min × 20)
  cost = estimate_cost("avatar", duration_seconds=30)  # → 500 (1 min × 500)
  new_balance = check_and_deduct(user_id, cost)         # raises InsufficientFundsError if broke
  refund(user_id, cost)                                 # called by tasks on failure

Design decisions:
  - check_and_deduct uses a Postgres RPC (deduct_coins) so the balance check
    and the decrement happen in a single atomic transaction. This prevents the
    double-click bug where two concurrent requests both read the same balance
    and both succeed even though only one should.
  - refund delegates to supabase_client.add_coins which also uses an RPC, so
    concurrent refunds never overwrite each other.

SQL to run once in the Supabase SQL editor:
─────────────────────────────────────────────
  -- Atomic deduct: returns new balance, or -1 if insufficient funds
  create or replace function deduct_coins(uid uuid, amount int)
  returns int language plpgsql as $$
  declare
    current_balance int;
    new_balance     int;
  begin
    select credits into current_balance
      from profiles
     where id = uid
       for update;               -- row-level lock prevents concurrent races

    if current_balance is null then
      raise exception 'user_not_found' using errcode = 'P0001';
    end if;

    if current_balance < amount then
      return -1;                 -- sentinel: caller raises 402
    end if;

    update profiles
       set credits = credits - amount
     where id = uid
    returning credits into new_balance;

    return new_balance;
  end;
  $$;
─────────────────────────────────────────────
The add_coins RPC is documented in supabase_client.py.
"""

import math
from fastapi import HTTPException

from supabase_client import add_coins, get_client, get_coin_balance

# ── Pricing table ─────────────────────────────────────────────────────────────

COINS_PER_MINUTE: dict[str, int] = {
    "voice":  20,    # MiniMax TTS / voice-clone generation
    "avatar": 500,   # DreamFace / lip-sync avatar render
}


# ── Custom exception ──────────────────────────────────────────────────────────

class InsufficientFundsError(Exception):
    """
    Raised by check_and_deduct when the user cannot afford the operation.

    FastAPI routes should catch this and return HTTP 402:

        except InsufficientFundsError as e:
            raise HTTPException(status_code=402, detail=str(e))

    The exception message is a human-readable string safe for the client.
    Structured detail (balance, cost, shortfall) is available as attributes.
    """
    def __init__(self, balance: int, cost: int) -> None:
        self.balance  = balance
        self.cost     = cost
        self.shortfall = cost - balance
        super().__init__(
            f"This operation costs {cost} coins but your balance is {balance}. "
            f"Top up {self.shortfall} more coins to continue."
        )


# ── Public API ────────────────────────────────────────────────────────────────

def estimate_cost(video_type: str, duration_seconds: float) -> int:
    """
    Calculate the coin cost for a job before it runs.

    Duration is rounded UP to the nearest full minute so users always know
    the worst-case cost upfront (no surprise overages after the job starts).

    Args:
        video_type:       "voice" or "avatar"
        duration_seconds: requested output duration in seconds

    Returns:
        Cost in coins (int ≥ 1).

    Raises:
        ValueError: if video_type is not in the pricing table.

    Examples:
        >>> estimate_cost("voice", 60)    # 1 min  → 20
        20
        >>> estimate_cost("voice", 61)    # 2 min  → 40
        40
        >>> estimate_cost("avatar", 30)   # 1 min  → 500
        500
    """
    rate = COINS_PER_MINUTE.get(video_type)
    if rate is None:
        raise ValueError(
            f"Unknown video_type {video_type!r}. "
            f"Valid types: {list(COINS_PER_MINUTE)}"
        )

    # math.ceil ensures sub-minute jobs cost at least 1 minute
    minutes = max(1, math.ceil(duration_seconds / 60))
    return minutes * rate


def check_and_deduct(user_id: str, cost: int) -> int:
    """
    Atomically verify the user can afford `cost` coins and deduct them.

    Uses the Postgres RPC deduct_coins(uid, amount) so the balance check
    and the UPDATE happen inside a single database transaction. This prevents
    double-click and concurrent-request bugs.

    Args:
        user_id: UUID of the user (from Supabase JWT).
        cost:    Number of coins to deduct (must be > 0).

    Returns:
        New coin balance after the deduction.

    Raises:
        InsufficientFundsError: balance < cost (caller should return HTTP 402).
        ValueError:             user not found (RPC raised P0001).
        RuntimeError:           unexpected RPC response.
    """
    if cost <= 0:
        raise ValueError(f"check_and_deduct: cost must be positive, got {cost}")

    sb = get_client()
    response = sb.rpc("deduct_coins", {"uid": user_id, "amount": cost}).execute()

    new_balance = response.data

    # The RPC returns -1 as a sentinel when the balance is too low.
    # We need the current balance to build a helpful error message.
    if new_balance == -1:
        current_balance = get_coin_balance(user_id)
        raise InsufficientFundsError(balance=current_balance, cost=cost)

    if new_balance is None:
        # The RPC raised P0001 (user_not_found) — Supabase turns it into an
        # error in response.error rather than response.data.
        raise ValueError(f"User not found: {user_id}")

    return int(new_balance)


def refund(user_id: str, cost: int) -> int:
    """
    Return `cost` coins to the user (called by Celery task on failure).

    Delegates to add_coins which uses an atomic Postgres RPC, so concurrent
    refunds are safe.

    Args:
        user_id: UUID of the user.
        cost:    Number of coins to restore. Silently ignored if 0.

    Returns:
        New balance after the refund.
    """
    if cost <= 0:
        # Nothing to refund — e.g., free operation or cost already returned.
        return get_coin_balance(user_id)

    return add_coins(user_id, cost)


def get_balance(user_id: str) -> int:
    """
    Return the current coin balance for display / polling.

    This is a thin wrapper over supabase_client.get_coin_balance so that
    all coin reads go through the economy module and are easy to mock in tests.

    Args:
        user_id: UUID of the user.

    Returns:
        Current balance (int ≥ 0).
    """
    return get_coin_balance(user_id)
