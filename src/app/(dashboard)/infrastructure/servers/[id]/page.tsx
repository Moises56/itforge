import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Server } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { ServerDetailTabs } from './_components/server-detail-tabs'

type PageParams = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const srv = await prisma.server.findUnique({ where: { id }, select: { hostname: true, displayName: true } })
  if (!srv) return { title: 'Servidor no encontrado' }
  return { title: `Servidor — ${srv.displayName ?? srv.hostname}` }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OS_COLORS: Record<string, string> = {
  WINDOWS_SERVER: '#3b82f6',
  UBUNTU:         '#e95420',
  CENTOS:         '#932279',
  DEBIAN:         '#d70a53',
  RHEL:           '#cc0000',
  OTHER:          '#6b7280',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:         { label: 'Activo',         color: 'var(--status-green)',  bg: 'rgba(16,185,129,0.08)'  },
  MAINTENANCE:    { label: 'Mantenimiento',   color: 'var(--status-amber)',  bg: 'rgba(245,158,11,0.08)'  },
  INACTIVE:       { label: 'Inactivo',        color: 'var(--status-red)',    bg: 'rgba(239,68,68,0.08)'   },
  DECOMMISSIONED: { label: 'Decomisionado',   color: 'var(--foreground-dim)',bg: 'var(--surface-2)'       },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ServerDetailPage({ params }: { params: PageParams }) {
  const { id } = await params
  const user   = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'infrastructure.servers', 'view')
  if (!canView) notFound()

  const server = await prisma.server.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      group:       { select: { id: true, name: true } },
      credentials: { where: { deletedAt: null }, orderBy: { isDefault: 'desc' } },
      services:    { orderBy: { name: 'asc' } },
      documents:   { where: { deletedAt: null }, orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  })
  if (!server) notFound()

  // Projects hosted on this server (match by IP in project environments)
  const hostedProjects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt:      null,
      environments: { some: { serverIp: server.ip } },
    },
    select: {
      id: true, name: true, code: true, status: true, deploymentType: true,
      environments: {
        where:  { serverIp: server.ip },
        select: { type: true, serverPort: true, url: true },
      },
    },
  })

  // Last reveal logs per credential
  const credIds = server.credentials.map((c) => c.id)
  const revealLogs = credIds.length > 0
    ? await prisma.auditLog.findMany({
        where:   { action: 'reveal', resource: 'infrastructure.servers.credentials', resourceId: { in: credIds } },
        orderBy: { createdAt: 'desc' },
        select:  { resourceId: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      })
    : []

  const lastRevealMap = new Map<string, { at: string; by: string }>()
  for (const log of revealLogs) {
    if (log.resourceId && !lastRevealMap.has(log.resourceId)) {
      lastRevealMap.set(log.resourceId, {
        at: log.createdAt.toISOString(),
        by: `${log.user.firstName} ${log.user.lastName}`,
      })
    }
  }

  const [canEdit, canManageCreds] = await Promise.all([
    resolvePermission(user.id, 'infrastructure.servers', 'edit'),
    resolvePermission(user.id, 'infrastructure.servers.credentials', 'create'),
  ])

  const groups = canEdit ? await prisma.serverGroup.findMany({
    where:   { organizationId: user.organizationId },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true },
  }) : []

  const osColor  = OS_COLORS[server.os] ?? '#6b7280'
  const statusMeta = STATUS_META[server.status] ?? STATUS_META.INACTIVE!

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/infrastructure/servers" className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Servidores
        </Link>
        <span style={{ color: 'var(--foreground-dim)' }}>/</span>
        <span className="text-sm truncate max-w-[200px]" style={{ color: 'var(--foreground)' }}>
          {server.displayName ?? server.hostname}
        </span>
      </div>

      {/* Header */}
      <div
        className="rounded overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-1 w-full" style={{ background: osColor }} />
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded flex items-center justify-center shrink-0"
              style={{ background: `${osColor}18`, border: `1px solid ${osColor}30` }}
            >
              <Server size={20} style={{ color: osColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
                  {server.displayName ?? server.hostname}
                </h1>
                {server.displayName && (
                  <span
                    className="text-xs font-mono"
                    style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                  >
                    {server.hostname}
                  </span>
                )}
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1"
                  style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}
                >
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-sm font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                {server.ip}
                {server.secondaryIp && ` · ${server.secondaryIp}`}
                {server.group && (
                  <span style={{ color: 'var(--foreground-dim)' }}> · {server.group.name}</span>
                )}
              </p>
              {server.description && (
                <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{server.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ServerDetailTabs
        server={{
          id:          server.id,
          hostname:    server.hostname,
          displayName: server.displayName,
          description: server.description,
          ip:          server.ip,
          secondaryIp: server.secondaryIp,
          os:          server.os,
          type:        server.type,
          groupId:     server.groupId,
          specs:       server.specs as Record<string, string> | null,
          location:    server.location,
          domain:      server.domain,
          status:      server.status,
          notes:       server.notes,
          createdAt:   server.createdAt.toISOString(),
          updatedAt:   server.updatedAt.toISOString(),
          group:       server.group,
          credentials: server.credentials.map((c) => ({
            id:        c.id,
            label:     c.label,
            protocol:  c.protocol,
            port:      c.port,
            username:  c.username,
            domain:    c.domain,
            isDefault: c.isDefault,
            notes:     c.notes,
            createdAt: c.createdAt.toISOString(),
            lastReveal: lastRevealMap.get(c.id) ?? null,
          })),
          services: server.services.map((s) => ({
            id:       s.id,
            name:     s.name,
            port:     s.port,
            protocol: s.protocol,
            status:   s.status,
            notes:    s.notes,
          })),
          documents: server.documents.map((d) => ({
            id:         d.id,
            title:      d.title,
            type:       d.type,
            filePath:   d.filePath,
            fileSize:   d.fileSize,
            mimeType:   d.mimeType,
            createdAt:  d.createdAt.toISOString(),
            uploadedBy: d.uploadedBy
              ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`
              : null,
          })),
        }}
        hostedProjects={hostedProjects.map((p) => ({
          id:             p.id,
          name:           p.name,
          code:           p.code,
          status:         p.status,
          deploymentType: p.deploymentType,
          environments:   p.environments,
        }))}
        groups={groups}
        canEdit={canEdit}
        canManageCreds={canManageCreds}
      />
    </div>
  )
}
