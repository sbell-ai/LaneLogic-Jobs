import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "";
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
    }
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return client;
}

export function isR2Configured(): boolean {
  return !!(accountId && accessKeyId && secretAccessKey && bucketName && publicUrl);
}

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL is not configured. Cannot generate image URLs.");
  }
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${publicUrl}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  const s3 = getClient();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}
