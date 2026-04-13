"use client";

// ─── /admin/vault ─────────────────────────────────────────────────────────────
// Painel para gerenciar URLs do Video Vault sem mexer no código.
// Requer login. Usa a API /api/admin/vault (GET / PUT / DELETE).
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast, ToastContainer } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type VaultEntry = {
  category:       string;
  slot:           number;
  title:          string;
  url:            string;
  active:         boolean;
  is_placeholder: boolean;
};

type VaultData = Record<string, VaultEntry[]>;

// ─── Category labels ──────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  hook_dr_choque:            "🎣 Gancho — DR Choque",
  hook_financas_hype:        "🎣 Gancho — Finanças Hype",
  hook_trad_dinamico:        "🎣 Gancho — Tradicional Dinâmico",
  dr_nutra_dores:            "💊 DR — Dores Articulares",
  dr_nutra_emagrecimento:    "💊 DR — Emagrecimento",
  dr_nutra_cerebro:          "💊 DR — Memória / Cognição",
  dr_financas_indenizacoes:  "💊 DR — Indenizações",
  dr_financas_renda_extra:   "💊 DR — Renda Extra",
  dr_relacionamento_seducao: "💊 DR — Relacionamento / Sedução",
  trad_imobiliario:          "🏠 Trad — Imobiliário",
  trad_corporativo:          "🏠 Trad — Corporativo",
  trad_local_food:           "🏠 Trad — Food Local",
  creator_podcast:           "🎙 Creator — Podcast",
  creator_vlog:              "🎙 Creator — Vlog",
  social_wedding:            "🎉 Evento — Casamento",
  ecom_beauty:               "🛍 E-com — Beauty",
  ecom_food_porn:            "🛍 E-com — Food Porn",
};

const CATEGORY_ORDER = Object.keys(LABELS);

export default function VaultAdminPage() {
  const router  = useRouter();
  const supabase = createClient();
  const { toasts, remove: removeToast, toast } = useToast();

  const [vault,    setVault]    = useState<VaultData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);  // "cat:slot"
  const [edits,    setEdits]    = useState<Record<string, { title: string; url: string }>>({});
  const [dbReady,  setDbReady]  = useState<boolean | null>(null); // null=unknown, true/false

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load vault ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/vault");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.error) {
        // Table doesn't exist yet
        setDbReady(false);
        setVault(null);
      } else {
        setDbReady(true);
        setVault(data.vault as VaultData);
      }
    } catch {
      toast.error("Erro ao carregar vault");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => { load(); }, [load]);

  // ── Save a single entry ──
  const save = async (category: string, slot: number) => {
    const key  = `${category}:${slot}`;
    const edit = edits[key];
    if (!edit) return;

    setSaving(key);
    try {
      const res = await fetch("/api/admin/vault", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category, slot, title: edit.title, url: edit.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");

      toast.success("Salvo ✓");
      setEdits(e => { const n = { ...e }; delete n[key]; return n; });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(null);
    }
  };

  // ── Clear a single entry (revert to placeholder) ──
  const clear = async (category: string, slot: number) => {
    setSaving(`${category}:${slot}`);
    try {
      const res = await fetch("/api/admin/vault", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category, slot }),
      });
      if (!res.ok) throw new Error("Erro ao limpar");
      toast.success("Entrada desactivada — Pexels será usado como fallback");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(null);
    }
  };

  const setEdit = (category: string, slot: number, field: "title" | "url", value: string) => {
    const key = `${category}:${slot}`;
    setEdits(e => ({
      ...e,
      [key]: {
        title: field === "title" ? value : (e[key]?.title ?? ""),
        url:   field === "url"   ? value : (e[key]?.url   ?? ""),
      },
    }));
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#131313", color: "#888" }}>
        Carregando vault...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#131313", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header style={{ padding: "16px 28px", borderBottom: "1px solid #222", background: "#1c1b1b", display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Voltar</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎬 Video Vault — Gerenciar URLs</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666", marginTop: 2 }}>
            Cada categoria tem 2 slots. Cole a URL pública do R2. Slots "placeholder" são ignorados — o Pexels é usado como fallback.
          </p>
        </div>
      </header>

      {/* DB not ready banner */}
      {dbReady === false && (
        <div style={{ margin: 28, padding: "16px 20px", background: "#2a1a05", border: "1px solid #F0563A55", borderRadius: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F0563A", marginBottom: 8 }}>⚠ Tabela Supabase não encontrada</div>
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
            Execute o SQL abaixo no seu Supabase Dashboard → SQL Editor:
          </div>
          <pre style={{
            margin: "12px 0 0", padding: 16, background: "#0a0a0a", borderRadius: 8,
            fontSize: 11, color: "#34d399", overflowX: "auto", lineHeight: 1.6,
          }}>{CREATE_TABLE_SQL}</pre>
          <button onClick={load} style={{ marginTop: 12, padding: "8px 18px", background: "#F0563A", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            🔄 Retentar conexão
          </button>
        </div>
      )}

      {/* Vault grid */}
      {vault && (
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24, maxWidth: 960, margin: "0 auto" }}>

          {CATEGORY_ORDER.filter(cat => vault[cat]).map(category => {
            const entries = vault[category];
            const label   = LABELS[category] ?? category;
            const liveCount = entries.filter(e => !e.is_placeholder && e.active).length;

            return (
              <div key={category} style={{ background: "#1a1a1a", borderRadius: 12, border: `1px solid ${liveCount > 0 ? "#34d39933" : "#2a2a2a"}`, overflow: "hidden" }}>

                {/* Category header */}
                <div style={{ padding: "12px 18px", background: liveCount > 0 ? "#0f1f10" : "#111", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: liveCount > 0 ? "#34d399" : "#aaa" }}>{label}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
                    background: liveCount > 0 ? "#34d39922" : "#F0563A22",
                    color:      liveCount > 0 ? "#34d399"   : "#F0563A",
                    border:     `1px solid ${liveCount > 0 ? "#34d39933" : "#F0563A33"}`,
                  }}>
                    {liveCount}/{entries.length} ativos
                  </span>
                </div>

                {/* Slots */}
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {entries.map(entry => {
                    const key      = `${category}:${entry.slot}`;
                    const hasEdit  = !!edits[key];
                    const isLive   = !entry.is_placeholder && entry.active;
                    const isSaving = saving === key;

                    const titleVal = hasEdit ? edits[key].title : entry.title;
                    const urlVal   = hasEdit ? edits[key].url   : entry.url;

                    return (
                      <div key={entry.slot} style={{ borderRadius: 8, border: `1px solid ${isLive ? "#34d39933" : "#222"}`, background: isLive ? "#0d1a0d" : "#111", padding: "12px 14px" }}>

                        {/* Slot badge + status */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 700, background: "#222", color: "#666" }}>
                            SLOT {entry.slot}
                          </span>
                          {isLive
                            ? <span style={{ fontSize: 10, color: "#34d399", fontWeight: 600 }}>✓ ATIVO</span>
                            : <span style={{ fontSize: 10, color: "#F0563A", fontWeight: 600 }}>⏸ PLACEHOLDER — Pexels fallback</span>
                          }
                        </div>

                        {/* Title input */}
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Título</label>
                          <input
                            value={titleVal}
                            onChange={e => setEdit(category, entry.slot, "title", e.target.value)}
                            placeholder="Ex: DR Choque — Pattern Interrupt"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${hasEdit ? "#F0563A66" : "#2a2a2a"}`, background: "#0a0a0a", color: "#ccc", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                          />
                        </div>

                        {/* URL input */}
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>URL do R2</label>
                          <input
                            value={urlVal}
                            onChange={e => setEdit(category, entry.slot, "url", e.target.value)}
                            placeholder="https://pub-xxx.r2.dev/videos/hook_dr_choque/video.mp4"
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${hasEdit ? "#F0563A66" : "#2a2a2a"}`, background: "#0a0a0a", color: "#ccc", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                          />
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => save(category, entry.slot)}
                            disabled={!hasEdit || isSaving}
                            style={{
                              padding: "6px 16px", borderRadius: 6, border: "none", cursor: hasEdit && !isSaving ? "pointer" : "not-allowed",
                              background: hasEdit ? "#F0563A" : "#222",
                              color:      hasEdit ? "#fff"    : "#555",
                              fontSize: 11, fontWeight: 700, opacity: isSaving ? 0.6 : 1,
                            }}
                          >
                            {isSaving ? "Salvando..." : "💾 Salvar"}
                          </button>

                          {isLive && (
                            <button
                              onClick={() => clear(category, entry.slot)}
                              disabled={isSaving}
                              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #F0563A44", background: "transparent", color: "#F0563A88", fontSize: 11, cursor: "pointer" }}
                            >
                              × Limpar
                            </button>
                          )}

                          {urlVal && !urlVal.includes("placeholder") && (
                            <a
                              href={urlVal} target="_blank" rel="noopener noreferrer"
                              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", fontSize: 11, textDecoration: "none" }}
                            >
                              ↗ Testar URL
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Info footer */}
          <div style={{ padding: "14px 18px", background: "#111", borderRadius: 8, border: "1px solid #1a1a1a", fontSize: 11, color: "#555", lineHeight: 1.8 }}>
            <strong style={{ color: "#888" }}>Como funciona:</strong><br />
            1. Faça o upload do MP4 para o bucket R2 → copie a URL pública.<br />
            2. Cole no campo "URL do R2" do slot correspondente e clique Salvar.<br />
            3. A IA vai injectar o vídeo <em>antes</em> dos resultados do Pexels, com source "Premium Vault".<br />
            4. Slots com URL placeholder são ignorados silenciosamente (Pexels é usado como fallback).<br />
            5. O cache do servidor expira em 5 minutos após qualquer salvar.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SQL para criar a tabela ──────────────────────────────────────────────────
const CREATE_TABLE_SQL = `-- Execute no Supabase Dashboard → SQL Editor
create table if not exists vault_videos (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  slot        int  not null,
  title       text not null,
  url         text not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  unique (category, slot)
);

-- RLS
alter table vault_videos enable row level security;
create policy "vault_read"  on vault_videos for select using (true);
create policy "vault_write" on vault_videos for all    using (auth.role() = 'authenticated');`;
