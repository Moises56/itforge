import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// ─── Public org meta (no auth required) ──────────────────────────────────────

export interface PublicOrgMeta {
  name: string
  hasFavicon: boolean
}

/**
 * Loads minimal public org metadata — no authentication required.
 * Used in the root layout for dynamic title and favicon link.
 * Returns safe defaults if DB is unavailable (e.g., during build).
 */
export const getPublicOrgMeta = cache(async (): Promise<PublicOrgMeta> => {
  try {
    const org = await prisma.organization.findFirst({
      where: { deletedAt: null },
      select: { name: true, faviconPath: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!org) return { name: 'ITForge', hasFavicon: false }
    return { name: org.name, hasFavicon: !!org.faviconPath }
  } catch {
    return { name: 'ITForge', hasFavicon: false }
  }
})
