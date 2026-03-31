// ─── /api/upload/multipart-start ─────────────────────────────────────────────
// Inicia um S3 Multipart Upload no R2.
// Body: { filename, contentType }
// Returns: { uploadId, key, publicUrl }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function sanitize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");
}

function uniqueKey(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const name = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `uploads/${sanitize(name)}_${ts}_${rand}${ext}`;
}

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = (await req.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Campos obrigatórios: filename e contentType." },
        { status: 400 },
      );
    }

    const bucket = process.env.R2_BUCKET_UPLOADS!;
    const key = uniqueKey(filename);

    const cmd = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const result = await r2.send(cmd);
    const uploadId = result.UploadId;

    if (!uploadId) {
      return NextResponse.json(
        { error: "R2 não retornou UploadId." },
        { status: 500 },
      );
    }

    const publicUrl = `${process.env.R2_PUBLIC_URL_UPLOADS}/${key}`;

    return NextResponse.json({ uploadId, key, publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[multipart-start] Error:", msg, err);
    return NextResponse.json(
      { error: `Falha ao iniciar upload multipart: ${msg}` },
      { status: 500 },
    );
  }
}
