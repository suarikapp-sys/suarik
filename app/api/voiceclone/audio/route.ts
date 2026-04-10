// ─── /api/voiceclone/audio ── Serve áudio do R2 para APIs externas ────────────
// Newport AI precisa de uma URL pública para buscar o áudio.
// Este endpoint faz proxy do R2 sem presigned URL complexa.
// Segurança: a chave (key) é aleatória e não-adivinhável.

import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const r2 = new S3Client({
  region:   "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  // Only allow keys under the uploads/ prefix — prevents path traversal
  if (!key.startsWith("uploads/") || key.includes("..")) {
    return new NextResponse("Invalid key", { status: 403 });
  }

  try {
    const cmd = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_UPLOADS!,
      Key:    key,
    });

    const obj = await r2.send(cmd);

    if (!obj.Body) {
      return new NextResponse("Not found", { status: 404 });
    }

    const stream      = obj.Body.transformToWebStream();
    const contentType = obj.ContentType || "audio/mpeg";
    const headers: HeadersInit = {
      "Content-Type":  contentType,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };
    if (obj.ContentLength) {
      headers["Content-Length"] = String(obj.ContentLength);
    }

    return new NextResponse(stream, { status: 200, headers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[voiceclone/audio] R2 fetch error:", msg);
    if (msg.includes("NoSuchKey") || msg.includes("404")) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse("Internal error", { status: 500 });
  }
}
