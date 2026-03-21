import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Network, ExternalLink } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { NetworkDetailTabs } from './_components/network-detail-tabs'

type PageParams = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const eq = await prisma.networkEquipment.findUnique({ where: { id }, select: { name: true } })
  return eq ? { title: `Red — ${eq.name}` } : { title: 'Equipo no encontrado' }
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  SWITCH:       { label: 'Switch',       color: '#3b82f6' },
  ROUTER:       { label: 'Router',       color: '#8b5cf6' },
  ACCESS_POINT: { label: 'Access Point', color: '#10b981' },
  FIREWALL:     { label: 'Firewall',     color: '#ef4444' },
  UPS:          { label: 'UPS',          color: '#f59e0b' },
  OTHER:        { label: 'Otro',         color: '#6b7280' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:      { label: 'Activo',        color: 'var(--status-green)', bg: 'rgba(16,185,129,0.08)' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'var(--status-amber)', bg: 'rgba(245,158,11,0.08)' },
  INACTIVE:    { label: 'Inactivo',      color: 'var(--status-red)',   bg: 'rgba(239,68,68,0.08)'  },
}

export default async function NetworkDetailPage({ params }: { params: PageParams }) {
  const { id } = await params
  const user   = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'infrastructure.network', 'view')
  if (!canView) notFound()

  const eq = await prisma.networkEquipment.findFirst({
    where:   { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      credentials: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      ports:       { orderBy: { portNumber: 'asc' } },
    },
  })
  if (!eq) notFound()

  // Last reveal logs
  const credIds = eq.credentials.map((c) => c.id)
  const revealLogs = credIds.length > 0
    ? await prisma.auditLog.findMany({
        where:   { action: 'reveal', resource: 'infrastructure.network.credentials', resourceId: { in: credIds } },
        orderBy: { createdAt: 'desc' },
        select:  { resourceId: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      })
    : []

  const lastRevealMap = new Map<string, { at: string; by: string }>()
  for (const log of revealLogs) {
    if (log.resourceId && !lastRevealMap.has(log.resourceId)) {
      lastRevealMap.set(log.resourceId, { at: log.createdAt.toISOString(), by: `${log.user.firstName} ${log.user.lastName}` })
    }
  }

  const [canEdit, canManageCreds] = await Promise.all([
    resolvePermission(user.id, 'infrastructure.network', 'edit'),
    resolvePermission(user.id, 'infrastructure.network.credentials', 'create'),
  ])

  const typeMeta   = TYPE_META[eq.type]     ?? TYPE_META.OTHER!
  const statusMeta = STATUS_META[eq.status] ?? STATUS_META.INACTIVE!

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/infrastructure/network" className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Equipos de Red
        </Link>
        <span style={{ color: 'var(--foreground-dim)' }}>/</span>
        <span className="text-sm truncate max-w-[200px]" style={{ color: 'var(--foreground)' }}>{eq.name}</span>
      </div>

      {/* Header */}
      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="h-1 w-full" style={{ background: typeMeta.color }} />
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded flex items-center justify-center shrink-0"
              style={{ background: `${typeMeta.color}18`, border: `1px solid ${typeMeta.color}30` }}
            >
              <Network size={20} style={{ color: typeMeta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>{eq.name}</h1>
                <span className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ background: `${typeMeta.color}18`, color: typeMeta.color, border: `1px solid ${typeMeta.color}30` }}>
                  {typeMeta.label}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}>
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-sm font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                {[eq.brand, eq.model].filter(Boolean).join(' · ') || 'Sin marca/modelo'}
                {eq.ip && ` · ${eq.ip}`}
                {eq.totalPorts && ` · ${eq.totalPorts} puertos`}
              </p>
              {eq.managementUrl && (
                <a href={eq.managementUrl} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs mt-1 transition-colors"
                   style={{ color: 'var(--accent-cyan)' }}>
                  <ExternalLink size={11} /> Abrir panel de administración
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <NetworkDetailTabs
        equipment={{
          id:            eq.id,
          name:          eq.name,
          type:          eq.type,
          brand:         eq.brand,
          model:         eq.model,
          ip:            eq.ip,
          location:      eq.location,
          managementUrl: eq.managementUrl,
          totalPorts:    eq.totalPorts,
          firmware:      eq.firmware,
          status:        eq.status,
          notes:         eq.notes,
          createdAt:     eq.createdAt.toISOString(),
          updatedAt:     eq.updatedAt.toISOString(),
          credentials:   eq.credentials.map((c) => ({
            id:        c.id,
            label:     c.label,
            protocol:  c.protocol,
            port:      c.port,
            username:  c.username,
            notes:     c.notes,
            createdAt: c.createdAt.toISOString(),
            lastReveal: lastRevealMap.get(c.id) ?? null,
          })),
          ports: eq.ports.map((p) => ({
            id:          p.id,
            portNumber:  p.portNumber,
            label:       p.label,
            vlan:        p.vlan,
            connectedTo: p.connectedTo,
            status:      p.status,
            notes:       p.notes,
          })),
        }}
        canEdit={canEdit}
        canManageCreds={canManageCreds}
        isSwitch={eq.type === 'SWITCH'}
      />
    </div>
  )
}
