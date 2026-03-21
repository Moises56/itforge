import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { DomainsClient } from './_components/domains-client'

export const metadata: Metadata = { title: 'Dominios' }

export default async function DomainsPage() {
  const user = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'infrastructure.domains', 'view')
  if (!canView) redirect('/infrastructure')

  const [canCreate, canEdit] = await Promise.all([
    resolvePermission(user.id, 'infrastructure.domains', 'create'),
    resolvePermission(user.id, 'infrastructure.domains', 'edit'),
  ])

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [domains, servers, projects] = await Promise.all([
    prisma.domain.findMany({
      where:   { organizationId: user.organizationId, deletedAt: null },
      include: {
        server:  { select: { id: true, hostname: true } },
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.server.findMany({
      where:   { organizationId: user.organizationId, deletedAt: null },
      orderBy: { hostname: 'asc' },
      select:  { id: true, hostname: true, displayName: true, ip: true },
    }),
    prisma.project.findMany({
      where:   { organizationId: user.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, code: true },
    }),
  ])

  const serialized = domains.map((d) => ({
    id:          d.id,
    name:        d.name,
    type:        d.type,
    pointsTo:    d.pointsTo,
    sslEnabled:  d.sslEnabled,
    sslExpiresAt:d.sslExpiresAt?.toISOString() ?? null,
    registrar:   d.registrar,
    expiresAt:   d.expiresAt?.toISOString() ?? null,
    notes:       d.notes,
    createdAt:   d.createdAt.toISOString(),
    updatedAt:   d.updatedAt.toISOString(),
    server:      d.server ? { id: d.server.id, hostname: d.server.hostname } : null,
    project:     d.project ? { id: d.project.id, name: d.project.name, code: d.project.code } : null,
    sslAlert:    d.sslEnabled && d.sslExpiresAt ? d.sslExpiresAt <= in30 : false,
    domainAlert: d.type === 'PUBLIC' && d.expiresAt ? d.expiresAt <= in30 : false,
  }))

  return (
    <DomainsClient
      domains={serialized}
      servers={servers.map((s) => ({ id: s.id, hostname: s.hostname, displayName: s.displayName, ip: s.ip }))}
      projects={projects}
      canCreate={canCreate}
      canEdit={canEdit}
    />
  )
}
