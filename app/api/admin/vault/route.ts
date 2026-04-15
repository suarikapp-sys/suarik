// ─── /api/admin/vault ─────────────────────────────────────────────────────────
// CRUD para entradas do Video Vault armazenadas no Supabase.
//   GET  → retorna todas as categorias (DB + fallback estático mesclados)
//   PUT  → upsert de uma entrada  { category, slot, title, url, active? }
//   DELETE → desativa uma entrada { category, slot }
//
// Protegido: requer sessão autenticada em qualquer ambiente.
// ──────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { VIDEO_VAULT, bustVaultCache, type VaultRow } from "@/app/lib/videoVault";
import { requireAdmin } from "@/app/lib/admin";

// ── GET — retorna vault mesclado (DB + estático) ──────────────────────────────
export async function GET() {
  const { error: authErr, supabase } = await requireAdmin();
  if (authErr) return authErr;

  // Fetch all DB rows (active + inactive) for the admin UI
  const { data: rows, error } = await supabase
    .from("vault_videos")
    .select("category, slot, title, url, active")
    .order("category")
    .order("slot");

  if (error && error.code !== "42P01") {
    // 42P01 = table doesn't exist yet — we degrade gracefully
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build a map from DB rows (keyed by "category:slot")
  const dbMap: Record<string, VaultRow> = {};
  for (const row of (rows ?? []) as VaultRow[]) {
    dbMap[`${row.category}:${row.slot}`] = row;
  }

  // Merge with static baseline
  const result: Record<string, Array<VaultRow & { is_placeholder: boolean }>> = {};
  for (const [category, staticEntries] of Object.entries(VIDEO_VAULT)) {
    result[category] = staticEntries.map((sv, i) => {
      const slot = i + 1;
      const key  = `${category}:${slot}`;
      const dbRow = dbMap[key];
      return dbRow
        ? { ...dbRow, is_placeholder: dbRow.url.includes("placeholder") }
        : {
            category,
            slot,
            title:  sv.title,
            url:    sv.url,
            active: true,
            is_placeholder: sv.url.includes("placeholder"),
          };
    });
  }

  return NextResponse.json({ vault: result });
}

// ── PUT — upsert de uma entrada ───────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { error: authErr, supabase } = await requireAdmin();
  if (authErr) return authErr;

  const body = await req.json() as Partial<VaultRow>;
  const { category, slot, title, url } = body;

  if (!category || !slot || !title || !url) {
    return NextResponse.json({ error: "Campos obrigatórios: category, slot, title, url" }, { status: 400 });
  }

  if (!url.startsWith("http")) {
    return NextResponse.json({ error: "URL deve começar com http(s)://" }, { status: 400 });
  }

  const { error } = await supabase.from("vault_videos").upsert(
    { category, slot, title, url, active: body.active ?? true, updated_at: new Date().toISOString() },
    { onConflict: "category,slot" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  bustVaultCache();
  return NextResponse.json({ ok: true });
}

// ── DELETE — desativa (soft-delete) uma entrada ───────────────────────────────
export async function DELETE(req: NextRequest) {
  const { error: authErr, supabase } = await requireAdmin();
  if (authErr) return authErr;

  const { category, slot } = await req.json() as { category: string; slot: number };
  if (!category || !slot) {
    return NextResponse.json({ error: "Campos obrigatórios: category, slot" }, { status: 400 });
  }

  const { error } = await supabase
    .from("vault_videos")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("category", category)
    .eq("slot", slot);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  bustVaultCache();
  return NextResponse.json({ ok: true });
}
