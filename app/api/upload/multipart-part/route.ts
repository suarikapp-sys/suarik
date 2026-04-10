// ─── /api/upload/multipart-part ──────────────────────────────────────────────
// Receives a single chunk (≤4MB) and uploads it as a part to R2.
// Body: FormData with "chunk" file + "uploadId", "key", "partNumber" fields.
// Returns: { ETag, partNumber }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";

export const maxDuration = 60;

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
    const formData = await req.formData();
    const chunk = formData.get("chunk");
    const uploadId = formData.get("uploadId") as string;
    const key = formData.get("key") as string;
    const partNumber = parseInt(formData.get("partNumber") as string, 10);

    if (!chunk || !(chunk instanceof Blob) || !uploadId || !key || !partNumber) {
      return NextResponse.json(
        { error: "Campos obrigatórios: chunk, uploadId, key, partNumber." },
        { status: 400 },
      );
    }

    const bucket = process.env.R2_BUCKET_UPLOADS!;
    const buffer = Buffer.from(await chunk.arrayBuffer());

    const cmd = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
    });

    const result = await r2.send(cmd);

    return NextResponse.json({
      ETag: result.ETag,
      partNumber,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[multipart-part] Error:", msg, err);
    return NextResponse.json(
      { error: `Falha ao enviar parte: ${msg}` },
      { status: 500 },
    );
  }
}
