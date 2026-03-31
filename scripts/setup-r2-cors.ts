// ─── One-time script: configura CORS no bucket R2 para permitir upload direto ─
// Rodar com: npx tsx scripts/setup-r2-cors.ts

import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
// Parse .env.local manually (no dotenv dependency needed)
const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?\s*$/);
  if (match) process.env[match[1]] = match[2];
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  const bucket = process.env.R2_BUCKET_UPLOADS!;
  console.log(`Configurando CORS no bucket: ${bucket}...`);

  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [
              "https://copiloto-edicao.vercel.app",
              "http://localhost:3000",
              "http://localhost:3001",
            ],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Length"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );

  console.log("✅ CORS configurado com sucesso!");
  console.log("   Origins: copiloto-edicao.vercel.app, localhost:3000/3001");
  console.log("   Methods: PUT, GET, HEAD");
  console.log("   MaxAge: 3600s");
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
