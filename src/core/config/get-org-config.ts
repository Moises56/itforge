import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { getPresignedUrl, BUCKETS } from '@/core/storage/minio-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgConfig {
  id: string
  name: string
  tagline: string
  logoUrl: string | null
  logoPath: string | null
  faviconUrl: string | null
  faviconPath: string | null
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  enabledModules: {
    development: boolean
    infrastructure: boolean
    support: boolean
  }
  terminology: {
    department: string
    project: string
  }
}

// ─── Loader (cached per request via React cache) ──────────────────────────────

/**
 * Loads org config for the current authenticated user's organization.
 * Result is memoized per request via React cache() — safe to call multiple times.
 */
export const getOrgConfig = cache(async (): Promise<OrgConfig> => {
  const user = await getCurrentUser()

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
    select: {
      id:                   true,
      name:                 true,
      tagline:              true,
      logoPath:             true,
      primaryColor:         true,
      secondaryColor:       true,
      accentColor:          true,
      faviconPath:          true,
      terminology:          true,
      developmentEnabled:   true,
      infrastructureEnabled: true,
      supportEnabled:       true,
    },
  })

  // Generate short-lived presigned URLs for logo / favicon
  let logoUrl: string | null = null
  let faviconUrl: string | null = null

  if (org.logoPath) {
    try {
      logoUrl = await getPresignedUrl(BUCKETS.system, org.logoPath, 3600)
    } catch {
      // MinIO might not have the object yet — ignore
    }
  }
  if (org.faviconPath) {
    try {
      faviconUrl = await getPresignedUrl(BUCKETS.system, org.faviconPath, 3600)
    } catch {
      // ignore
    }
  }

  const terminology = (org.terminology as Record<string, string> | null) ?? {}

  return {
    id:         org.id,
    name:       org.name,
    tagline:    org.tagline ?? 'Portfolio TI',
    logoUrl,
    logoPath:   org.logoPath ?? null,
    faviconUrl,
    faviconPath: org.faviconPath ?? null,
    colors: {
      primary:   org.primaryColor   ?? '#2563eb',
      secondary: org.secondaryColor ?? '#0c1118',
      accent:    org.accentColor    ?? '#06b6d4',
    },
    enabledModules: {
      development:    org.developmentEnabled,
      infrastructure: org.infrastructureEnabled,
      support:        org.supportEnabled,
    },
    terminology: {
      department: terminology['department'] ?? 'Departamento',
      project:    terminology['project']    ?? 'Proyecto',
    },
  }
})
