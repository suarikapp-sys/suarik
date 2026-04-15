// ─── admin.ts ── Server-side admin allowlist ────────────────────────────────
// Admin emails configured via SUARIK_ADMIN_EMAILS env (comma-separated).
// Example: SUARIK_ADMIN_EMAILS=gabriel@example.com,admin@suarik.com
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function parseAdminEmails(): string[] {
  const raw = process.env.SUARIK_ADMIN_EMAILS ?? "";
  return raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), user: null, supabase };
  }

  const allowlist = parseAdminEmails();
  const email = (user.email ?? "").toLowerCase();
  if (!allowlist.length || !allowlist.includes(email)) {
    return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }), user: null, supabase };
  }

  return { error: null, user, supabase };
}
