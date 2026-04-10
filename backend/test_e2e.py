"""
Direct end-to-end test — no Redis / Celery required.
Runs the same logic the Celery task executes, step by step.
"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

USER_ID     = "ae97a707-07ca-4dcc-ac41-c4ae4765d6b1"
USER_TIER   = "starter"
SCRIPT_TEXT = (
    "Você já se sentiu completamente preso, sem saber como sair das dívidas? "
    "A maioria das pessoas acredita que precisa de sorte ou de um salário maior. "
    "Mas a verdade é diferente: existe um método simples que qualquer pessoa pode aplicar hoje. "
    "Eu estava no fundo do poço, com R$40.000 em dívidas e sem perspectiva. "
    "Em 90 dias, usando esta estratégia, zeramos tudo e ainda sobraram R$8.000. "
    "Vou te mostrar exatamente como fazer isso agora."
)

print("=" * 60)
print("COPILOTO DE EDIÇÃO — END-TO-END TEST")
print("=" * 60)

# ── Step 1: Supabase connection ───────────────────────────────────────────────
print("\n[1/4] Connecting to Supabase …")
from supabase_client import get_client, get_coin_balance
try:
    sb = get_client()
    balance = get_coin_balance(USER_ID)
    print(f"      OK — user {USER_ID}")
    print(f"      Current credits balance: {balance}")
except Exception as e:
    print(f"      FAIL — {e}")
    sys.exit(1)

# ── Step 2: Economy — estimate & check funds ──────────────────────────────────
print("\n[2/4] Checking economy …")
from economy import estimate_cost, InsufficientFundsError, check_and_deduct, refund
cost = estimate_cost("voice", duration_seconds=60)
print(f"      Estimated cost: {cost} coins")

if balance < cost:
    print(f"      WARN — balance ({balance}) < cost ({cost}). Adding test credits …")
    from supabase_client import add_coins
    add_coins(USER_ID, cost * 2)
    balance = get_coin_balance(USER_ID)
    print(f"      New balance: {balance}")

try:
    new_balance = check_and_deduct(USER_ID, cost)
    print(f"      OK — deducted {cost} coins. New balance: {new_balance}")
except InsufficientFundsError as e:
    print(f"      FAIL (402) — {e}")
    sys.exit(1)

# ── Step 3: Brain — generate timeline ─────────────────────────────────────────
print("\n[3/4] Calling AI brain (generate_timeline_vsl) …")
from brain import BrainError, generate_timeline_vsl
try:
    scenes = generate_timeline_vsl(SCRIPT_TEXT)
    print(f"      OK — {len(scenes)} scenes generated")
except BrainError as e:
    print(f"      FAIL (BrainError) — {e}")
    print("      Refunding coins …")
    refund(USER_ID, cost)
    sys.exit(1)

# ── Step 4: Print result ───────────────────────────────────────────────────────
print("\n[4/4] RESULT")
print("=" * 60)
print(json.dumps(scenes, indent=2, ensure_ascii=False))
print("=" * 60)
print(f"\nSTATUS : completed")
print(f"SCENES : {len(scenes)}")
print(f"CREDITS: {new_balance} remaining after deduction")
