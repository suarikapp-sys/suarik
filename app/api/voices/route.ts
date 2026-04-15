// ─── /api/voices ──────────────────────────────────────────────────────────────
// GET    → lista vozes clonadas do usuário (RLS garante isolamento)
// PATCH  → renomeia  { voiceId, voiceName }
// DELETE → remove    { voiceId }
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("cloned_voices")
    .select("voice_id, voice_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error && error.code !== "42P01") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ voices: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId, voiceName } = await req.json() as { voiceId?: string; voiceName?: string };
  if (!voiceId || typeof voiceId !== "string") {
    return NextResponse.json({ error: "voiceId obrigatório" }, { status: 400 });
  }
  if (!voiceName || typeof voiceName !== "string") {
    return NextResponse.json({ error: "voiceName obrigatório" }, { status: 400 });
  }
  const trimmed = voiceName.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    return NextResponse.json({ error: "voiceName deve ter entre 1 e 80 caracteres" }, { status: 400 });
  }

  const { error } = await supabase
    .from("cloned_voices")
    .update({ voice_name: trimmed, updated_at: new Date().toISOString() })
    .eq("voice_id", voiceId)
    .eq("user_id", user.id); // defesa em profundidade além de RLS

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId } = await req.json() as { voiceId?: string };
  if (!voiceId) return NextResponse.json({ error: "voiceId obrigatório" }, { status: 400 });

  const { error } = await supabase
    .from("cloned_voices")
    .delete()
    .eq("voice_id", voiceId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
