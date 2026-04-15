"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { computeCost, CostMeta } from "@/app/lib/creditCost";

export { computeCost };

type CreditsState = {
  credits:  number;
  plan:     string;
  loading:  boolean;
};

type SpendResult =
  | { ok: true;  credits: number; spent: number; refundId: string }
  | { ok: false; code: string; message: string };

// Gera um ID único por chamada — usado como idempotency key no refund
function newRefundId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useCredits() {
  const router = useRouter();
  const [state, setState] = useState<CreditsState>({ credits: 0, plan: "free", loading: true });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      if (res.status === 401) { router.push("/login"); return; }
      const j = await res.json() as { credits: number; plan: string };
      setState({ credits: j.credits, plan: j.plan, loading: false });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  const canAfford = useCallback((action: string, meta?: CostMeta): boolean => {
    return state.credits >= computeCost(action, meta);
  }, [state.credits]);

  // Debita créditos — retorna refundId pra caso precise reembolsar depois
  const spend = useCallback(async (action: string, meta?: CostMeta): Promise<SpendResult> => {
    try {
      const res = await fetch("/api/credits", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, ...meta }),
      });
      const j = await res.json() as {
        ok?: boolean; credits?: number; spent?: number;
        error?: string; code?: string; required?: number;
      };

      if (res.status === 402) {
        return {
          ok:      false,
          code:    "INSUFFICIENT_CREDITS",
          message: `Créditos insuficientes. Necessário: ${j.required}, disponível: ${state.credits}`,
        };
      }

      if (!j.ok) {
        return { ok: false, code: "ERROR", message: j.error ?? "Erro ao debitar créditos" };
      }

      setState(s => ({ ...s, credits: j.credits ?? s.credits - (j.spent ?? 0) }));
      return {
        ok:       true,
        credits:  j.credits!,
        spent:    j.spent!,
        refundId: newRefundId(),
      };
    } catch {
      return { ok: false, code: "NETWORK_ERROR", message: "Erro de rede" };
    }
  }, [state.credits]);

  // Reembolsa créditos idempotentemente — requer refundId da chamada spend()
  const refund = useCallback(async (action: string, refundId: string, meta?: CostMeta) => {
    if (!refundId) {
      console.warn("[refund] chamado sem refundId — skip");
      return;
    }
    try {
      await fetch("/api/credits/refund", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, refundId, meta }),
      });
      refresh();
    } catch { /* non-fatal */ }
  }, [refresh]);

  return {
    credits:  state.credits,
    plan:     state.plan,
    loading:  state.loading,
    canAfford,
    spend,
    refund,
    refresh,
    cost: (action: string, meta?: CostMeta) => computeCost(action, meta),
  };
}
