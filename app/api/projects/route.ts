// ─── /api/projects ────────────────────────────────────────────────────────────
// GET  → lista projetos do usuário
// POST → salva novo projeto
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/app/lib/rateLimit";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Rate limit: 30 requests per user per minute ──────────────────────────
  if (!await rateLimit(`projects:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  const page  = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10)));
  const tool  = req.nextUrl.searchParams.get("tool") ?? undefined;

  let query = supabase
    .from("projects")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (tool) query = query.eq("tool", tool);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data, total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Rate limit: 30 requests per user per minute ──────────────────────────
  if (!await rateLimit(`projects:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  const body = await req.json() as {
    tool:        string;
    title:       string;
    result_url?: string;
    thumb_url?:  string;
    meta?:       Record<string, unknown>;
  };

  if (!body.tool || !body.title) {
    return NextResponse.json({ error: "tool e title são obrigatórios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id:    user.id,
      tool:       body.tool,
      title:      body.title,
      result_url: body.result_url ?? null,
      thumb_url:  body.thumb_url  ?? null,
      meta:       body.meta       ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Rate limit: 30 requests per user per minute ──────────────────────────
  if (!await rateLimit(`projects:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
