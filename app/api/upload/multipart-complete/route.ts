// ─── /api/upload/multipart-complete ──────────────────────────────────────────
// Completes the S3 multipart upload on R2.
// Body: { uploadId, key, parts: [{ ETag, PartNumber }] }
// Returns: { ok: true }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { S3Client, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { uploadId, key, parts } = (await req.json()) as {
      uploadId: string;
      key: string;
      parts: Array<{ ETag: string; PartNumber: number }>;
    };

    if (!uploadId || !key || !parts?.length) {
      return NextResponse.json(
        { error: "Campos obrigatórios: uploadId, key, parts." },
        { status: 400 },
      );
    }

    const bucket = process.env.R2_BUCKET_UPLOADS!;

    const cmd = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.PartNumber - b.PartNumber)
          .map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
      },
    });

    await r2.send(cmd);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[multipart-complete] Error:", msg, err);
    return NextResponse.json(
      { error: `Falha ao finalizar upload: ${msg}` },
      { status: 500 },
    );
  }
}
