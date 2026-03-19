import * as Minio from 'minio'

const globalForMinio = globalThis as unknown as {
  minioClient: Minio.Client | undefined
}

export const minioClient =
  globalForMinio.minioClient ??
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
  })

if (process.env.NODE_ENV !== 'production') globalForMinio.minioClient = minioClient

export const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'itforge-assets'
