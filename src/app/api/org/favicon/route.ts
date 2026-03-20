import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPresignedUrl, BUCKETS } from '@/core/storage/minio-client'

/**
 * GET /api/org/favicon
 * Serves the organization favicon by redirecting to a short-lived MinIO presigned URL.
 * No authentication required — favicons are public assets.
 */
export async function GET() {
  try {
    const org = await prisma.organization.findFirst({
      where: { deletedAt: null },
      select: { faviconPath: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!org?.faviconPath) return new NextResponse(null, { status: 404 })

    const url = await getPresignedUrl(BUCKETS.system, org.faviconPath, 300)
    return NextResponse.redirect(url, { headers: { 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
