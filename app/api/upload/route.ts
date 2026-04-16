// ─── /api/upload — Pre-signed URL para upload direto ao Cloudflare R2 ────────
// O frontend envia { filename, contentType } e recebe de volta:
//   • uploadUrl  → PUT pre-signed (válido 1h) para o R2
//   • publicUrl  → URL pública do arquivo após o upload
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }                from "@aws-sdk/s3-request-presigner";
import { createClient }                from "@/lib/supabase/server";
import { rateLimit }                   from "@/app/lib/rateLimit";

// ── S3-compatible client apontando para o Cloudflare R2 ─────────────────────
// requestChecksumCalculation: "WHEN_REQUIRED" prevents the SDK from injecting
// x-amz-checksum-crc32 into pre-signed URLs — Cloudflare R2 rejects those with 403.
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function sanitize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_") // troca chars perigosos por _
    .replace(/_{2,}/g, "_");           // colapsa underscores repetidos
}

function uniqueKey(filename: string): string {
  const dot  = filename.lastIndexOf(".");
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : "";
  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 8); // 6-char alfanumérico
  return `uploads/${sanitize(name)}_${ts}_${rand}${ext}`;
}

// ── POST handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // ── Rate limit: 10 uploads per user per minute ──────────────────────────
  if (!await rateLimit(`upload:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  try {
    const { filename, contentType } = (await req.json()) as {
      filename?: string;
      contentType?: string;
    };

    // Validação básica
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Campos obrigatórios: filename e contentType." },
        { status: 400 },
      );
    }

    // Aceita vídeo, áudio e imagem (foto para Talking Photo / DreamAct)
    if (
      !contentType.startsWith("video/") &&
      !contentType.startsWith("audio/") &&
      !contentType.startsWith("image/")
    ) {
      return NextResponse.json(
        { error: "Apenas arquivos de vídeo, áudio ou imagem são permitidos." },
        { status: 415 },
      );
    }

    const bucket = process.env.R2_BUCKET_UPLOADS!;
    const key    = uniqueKey(filename);

    // Gera a pre-signed URL (PUT) válida por 1 hora
    const command = new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

    // URL pública de leitura (após o upload completar)
    const publicUrl = `${process.env.R2_PUBLIC_URL_UPLOADS}/${key}`;

    // Presigned GET URL — para APIs externas que precisam descarregar o ficheiro
    // (não requer que o bucket seja público)
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const downloadUrl = await getSignedUrl(r2, getCommand, { expiresIn: 86400 }); // 24h

    return NextResponse.json({ uploadUrl, publicUrl, downloadUrl, key });
  } catch (err: unknown) {
    console.error("[/api/upload] Erro ao gerar pre-signed URL:", err);
    return NextResponse.json(
      { error: "Falha ao gerar URL de upload." },
      { status: 500 },
    );
  }
}
