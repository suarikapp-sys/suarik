// ─── /api/upload/proxy — Proxy de upload para o R2 ──────────────────────────
// Evita problemas de CORS: o browser envia o vídeo para cá,
// e nós repassamos para a pre-signed URL do R2 server-side.
// Edge Runtime = streaming sem buffering, suporta arquivos grandes.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Allowed R2 hostname suffixes — any subdomain of these is permitted.
// Presigned URLs use virtual-hosted style: {bucket}.{accountId}.r2.cloudflarestorage.com
const ALLOWED_R2_SUFFIXES = [
  ".r2.cloudflarestorage.com",
  "r2.cloudflarestorage.com",
];

export async function PUT(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");

  if (!target) {
    return NextResponse.json(
      { error: "Query param 'target' (pre-signed URL) é obrigatório." },
      { status: 400 },
    );
  }

  // Block SSRF — only forward to Cloudflare R2 storage endpoints
  try {
    const { hostname, protocol } = new URL(target);
    const allowed = protocol === "https:" &&
      ALLOWED_R2_SUFFIXES.some(suffix => hostname === suffix || hostname.endsWith(suffix));
    if (!allowed) {
      return NextResponse.json({ error: "URL de destino não permitida." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "URL de destino inválida." }, { status: 400 });
  }

  try {
    const contentType = req.headers.get("content-type") || "video/mp4";

    // Repassa o body diretamente para o R2 (streaming, sem buffering)
    const r2Res = await fetch(target, {
      method: "PUT",
      body: req.body,
      headers: { "Content-Type": contentType },
      // @ts-expect-error — duplex required for streaming body in edge
      duplex: "half",
    });

    if (!r2Res.ok) {
      const errText = await r2Res.text().catch(() => "");
      console.error("[/api/upload/proxy] R2 respondeu:", r2Res.status, errText);
      return NextResponse.json(
        { error: `R2 rejeitou o upload (HTTP ${r2Res.status})` },
        { status: r2Res.status },
      );
    }

    return NextResponse.json({ ok: true, status: r2Res.status });
  } catch (err: unknown) {
    console.error("[/api/upload/proxy] Erro:", err);
    return NextResponse.json(
      { error: "Falha no proxy de upload." },
      { status: 500 },
    );
  }
}
