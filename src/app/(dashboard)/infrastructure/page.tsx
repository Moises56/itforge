import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import {
  Server, Network, Globe, AlertTriangle,
  CheckCircle, Wrench, PowerOff, ChevronRight,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Infraestructura' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const SERVER_STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE:         { label: 'Activo',         color: 'var(--status-green)',  icon: <CheckCircle size={14} /> },
  MAINTENANCE:    { label: 'Mantenimiento',   color: 'var(--status-amber)',  icon: <Wrench size={14} />     },
  INACTIVE:       { label: 'Inactivo',        color: 'var(--status-red)',    icon: <PowerOff size={14} />   },
  DECOMMISSIONED: { label: 'Decomisionado',   color: 'var(--foreground-dim)',icon: <PowerOff size={14} />   },
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, href, color = 'var(--accent-cyan)',
}: {
  label: string; value: number | string; sub?: string; href?: string; color?: string
}) {
  const inner = (
    <div
      className="rounded p-5 flex flex-col gap-2 transition-all duration-150"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
         style={{ color: 'var(--foreground-dim)' }}>
        {label}
      </p>
      <p className="text-3xl font-heading font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{sub}</p>}
    </div>
  )
  if (href) return <Link href={href} className="block hover:scale-[1.01] transition-transform">{inner}</Link>
  return inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InfrastructurePage() {
  const user = await getCurrentUser()

  const [canViewServers, canViewNetwork, canViewDomains] = await Promise.all([
    resolvePermission(user.id, 'infrastructure.servers', 'view'),
    resolvePermission(user.id, 'infrastructure.network', 'view'),
    resolvePermission(user.id, 'infrastructure.domains', 'view'),
  ])

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [serverStats, networkStats, sslExpiring, domainExpiring, topServers] = await Promise.all([
    // Server counts by status
    canViewServers ? prisma.server.groupBy({
      by:    ['status'],
      where: { organizationId: user.organizationId, deletedAt: null },
      _count: true,
    }) : Promise.resolve([]),

    // Network equipment count by status
    canViewNetwork ? prisma.networkEquipment.groupBy({
      by:    ['status'],
      where: { organizationId: user.organizationId, deletedAt: null },
      _count: true,
    }) : Promise.resolve([]),

    // SSL expiring soon
    canViewDomains ? prisma.domain.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt:      null,
        sslEnabled:     true,
        sslExpiresAt:   { not: null, lte: in30Days },
      },
      select: { id: true, name: true, sslExpiresAt: true },
      orderBy: { sslExpiresAt: 'asc' },
    }) : Promise.resolve([]),

    // Domain expiring soon
    canViewDomains ? prisma.domain.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt:      null,
        type:           'PUBLIC',
        expiresAt:      { not: null, lte: in30Days },
      },
      select: { id: true, name: true, expiresAt: true },
      orderBy: { expiresAt: 'asc' },
    }) : Promise.resolve([]),

    // Top servers by service count
    canViewServers ? prisma.server.findMany({
      where:   { organizationId: user.organizationId, deletedAt: null },
      select:  {
        id: true, hostname: true, displayName: true, ip: true, status: true, os: true,
        _count: { select: { services: true } },
      },
      orderBy: [{ services: { _count: 'desc' } }],
      take:    5,
    }) : Promise.resolve([]),
  ])

  const totalServers  = serverStats.reduce((s, r) => s + r._count, 0)
  const activeServers = serverStats.find((r) => r.status === 'ACTIVE')?._count ?? 0
  const totalNetwork  = networkStats.reduce((s, r) => s + r._count, 0)
  const activeNetwork = networkStats.find((r) => r.status === 'ACTIVE')?._count ?? 0
  const alerts        = sslExpiring.length + domainExpiring.length

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-heading font-bold uppercase tracking-wider"
          style={{ color: 'var(--foreground)' }}
        >
          Infraestructura
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
          Panel de control de servidores, equipos de red y dominios
        </p>
      </div>

      {/* Alerts banner */}
      {alerts > 0 && (
        <div
          className="rounded p-4 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--status-amber)' }}>
              {alerts} alerta{alerts !== 1 ? 's' : ''} de expiración en los próximos 30 días
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              {sslExpiring.length > 0 && `${sslExpiring.length} certificado SSL`}
              {sslExpiring.length > 0 && domainExpiring.length > 0 && ' · '}
              {domainExpiring.length > 0 && `${domainExpiring.length} dominio público`}
            </p>
          </div>
          <Link
            href="/infrastructure/domains"
            className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium shrink-0"
            style={{ color: 'var(--status-amber)', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}
          >
            Ver dominios <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Servidores activos"
          value={activeServers}
          sub={`de ${totalServers} total`}
          href="/infrastructure/servers"
          color="var(--status-green)"
        />
        <StatCard
          label="Equipos de red"
          value={activeNetwork}
          sub={`de ${totalNetwork} total`}
          href="/infrastructure/network"
          color="var(--accent-cyan)"
        />
        <StatCard
          label="SSL por expirar"
          value={sslExpiring.length}
          sub="en los próximos 30 días"
          href="/infrastructure/domains"
          color={sslExpiring.length > 0 ? 'var(--status-amber)' : 'var(--foreground-dim)'}
        />
        <StatCard
          label="Dominios por expirar"
          value={domainExpiring.length}
          sub="en los próximos 30 días"
          href="/infrastructure/domains"
          color={domainExpiring.length > 0 ? 'var(--status-red)' : 'var(--foreground-dim)'}
        />
      </div>

      {/* Server status breakdown + top servers */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Status breakdown */}
        {canViewServers && (
          <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Server size={15} style={{ color: 'var(--accent-cyan)' }} />
                <h2
                  className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Servidores por Estado
                </h2>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'DECOMMISSIONED'] as const).map((status) => {
                const meta  = SERVER_STATUS_META[status]!
                const count = serverStats.find((r) => r.status === status)?._count ?? 0
                return (
                  <div key={status} className="px-5 py-3 flex items-center gap-3">
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="text-sm flex-1" style={{ color: 'var(--foreground-muted)' }}>
                      {meta.label}
                    </span>
                    <span className="font-heading font-bold text-sm" style={{ color: meta.color }}>{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <Link
                href="/infrastructure/servers"
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--accent-cyan)' }}
              >
                Ver todos los servidores <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        )}

        {/* Top servers */}
        {canViewServers && topServers.length > 0 && (
          <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Server size={15} style={{ color: 'var(--accent-cyan)' }} />
                <h2
                  className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Servidores con más Servicios
                </h2>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {topServers.map((srv) => {
                const statusColor = SERVER_STATUS_META[srv.status]?.color ?? 'var(--foreground-dim)'
                return (
                  <Link
                    key={srv.id}
                    href={`/infrastructure/servers/${srv.id}`}
                    className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.02] group"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate group-hover:text-[var(--accent-cyan)] transition-colors"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {srv.displayName ?? srv.hostname}
                      </p>
                      <p
                        className="text-[10px] font-mono"
                        style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
                      >
                        {srv.ip}
                      </p>
                    </div>
                    <span
                      className="text-xs font-medium"
                      style={{ color: statusColor }}
                    >
                      {srv._count.services} servicios
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4">
        {canViewServers && (
          <Link
            href="/infrastructure/servers"
            className="rounded p-5 flex items-center gap-4 transition-all hover:border-[var(--border-bright)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                 style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Servidores</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {totalServers} servidor{totalServers !== 1 ? 'es' : ''} registrado{totalServers !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: 'var(--foreground-dim)' }} />
          </Link>
        )}
        {canViewNetwork && (
          <Link
            href="/infrastructure/network"
            className="rounded p-5 flex items-center gap-4 transition-all hover:border-[var(--border-bright)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                 style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Network size={18} style={{ color: 'var(--status-purple)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Equipos de Red</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {totalNetwork} equipo{totalNetwork !== 1 ? 's' : ''} registrado{totalNetwork !== 1 ? 's' : ''}
              </p>
            </div>
            <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: 'var(--foreground-dim)' }} />
          </Link>
        )}
        {canViewDomains && (
          <Link
            href="/infrastructure/domains"
            className="rounded p-5 flex items-center gap-4 transition-all hover:border-[var(--border-bright)]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                 style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Globe size={18} style={{ color: 'var(--status-green)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Dominios</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                {alerts > 0 ? `${alerts} alerta${alerts !== 1 ? 's' : ''} activa${alerts !== 1 ? 's' : ''}` : 'Sin alertas activas'}
              </p>
            </div>
            <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: 'var(--foreground-dim)' }} />
          </Link>
        )}
      </div>
    </div>
  )
}
