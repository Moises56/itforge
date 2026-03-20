import 'server-only'

import * as Minio from 'minio'

// ─── Buckets ──────────────────────────────────────────────────────────────────

export const BUCKETS = {
  dev:     'dev-assets',
  infra:   'infra-assets',
  support: 'support-assets',
  system:  'system-assets',
} as const

export type StorageBucket = (typeof BUCKETS)[keyof typeof BUCKETS]

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalRef = globalThis as unknown as { _minioStorage: Minio.Client | undefined }

function getClient(): Minio.Client {
  if (globalRef._minioStorage) return globalRef._minioStorage

  const client = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT ?? 'localhost',
    port:      parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
  })

  if (process.env.NODE_ENV !== 'production') globalRef._minioStorage = client
  return client
}

// ─── Bucket initialization ────────────────────────────────────────────────────

let _bucketsReady = false

export async function ensureBuckets(): Promise<void> {
  const client = getClient()
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await client.bucketExists(bucket)
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1')
      console.log(`[minio] Created bucket: ${bucket}`)
    }
  }
}

async function ensureBucketsOnce(): Promise<void> {
  if (_bucketsReady) return
  await ensureBuckets()
  _bucketsReady = true
}

// ─── Operations ───────────────────────────────────────────────────────────────

/**
 * Uploads a file Buffer to MinIO.
 * Returns the objectPath (store this in DB — never store full URLs).
 */
export async function uploadFile(
  bucket: StorageBucket,
  objectPath: string,
  buffer: Buffer,
  mimeType: string,
  metadata?: Record<string, string>,
): Promise<string> {
  await ensureBucketsOnce()
  const client = getClient()
  await client.putObject(bucket, objectPath, buffer, buffer.length, {
    'Content-Type': mimeType,
    ...metadata,
  })
  return objectPath
}

/**
 * Generates a presigned GET URL valid for `expiresInSeconds` (default 5 min).
 * Always generate fresh — never cache presigned URLs.
 */
export async function getPresignedUrl(
  bucket: StorageBucket,
  objectPath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getClient()
  return client.presignedGetObject(bucket, objectPath, expiresInSeconds)
}

/**
 * Permanently deletes an object from MinIO.
 * Silently succeeds if the object doesn't exist.
 */
export async function deleteFile(
  bucket: StorageBucket,
  objectPath: string,
): Promise<void> {
  const client = getClient()
  await client.removeObject(bucket, objectPath)
}
