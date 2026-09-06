import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "flipbook-storage";

function assertConfigured() {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      "Cloudflare R2 is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY. See SETUP.md."
    );
  }
}

let _client: S3Client | null = null;

export function r2Client(): S3Client {
  assertConfigured();
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

/** Presigned URL the browser can PUT the file to directly, bypassing our server. */
export async function createPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 600) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client(), command, { expiresIn: expiresInSeconds });
}

/** Presigned URL for a short-lived authenticated GET, used when the bucket is not public. */
export async function createPresignedGetUrl(key: string, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2Client(), command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string) {
  await r2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

export function flipbookPdfKey(flipbookId: string, filename: string) {
  return `flipbooks/${flipbookId}/original/${filename}`;
}

export function flipbookCoverKey(flipbookId: string, filename: string) {
  return `flipbooks/${flipbookId}/cover/${filename}`;
}

export function flipbookBackgroundKey(flipbookId: string, filename: string) {
  return `flipbooks/${flipbookId}/background/${filename}`;
}

export function flipbookLogoKey(flipbookId: string, filename: string) {
  return `flipbooks/${flipbookId}/logo/${filename}`;
}
