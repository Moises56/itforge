import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { ArrowRight, AlertTriangle, AlertCircle, Clock, TrendingUp, Database } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 2) return 'ahora'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`
  return `hace ${Math.floor(days / 30)}mes`
}

const STATUS_LABELS: Record<string, string> = {
  PRODUCTION:   'Producción',
  QA:           'QA',
  DEVELOPMENT:  'Desarrollo',
  PLANNING:     'Planificación',
  IDEA:         'Idea',
  SUSPENDED:    'Suspendido',
  DISCONTINUED: 'Descontinuado',
}

const CONTROL_LABELS: Record<string, string> = {
  LEVEL_0: 'L0',
  LEVEL_1: 'L1',
  LEVEL_2: 'L2',
  LEVEL_3: 'L3',
}

const STATUS_DOT: Record<string, string> = {
  PRODUCTION:   'var(--status-green)',
  QA:           'var(--status-blue)',
  DEVELOPMENT:  'var(--status-blue)',
  PLANNING:     'var(--status-purple)',
  IDEA:         'var(--status-slate)',
  SUSPENDED:    'var(--status-amber)',
  DISCONTINUED: 'var(--status-red)',
}

// ─── Data fetching ───────────────────────────────────────────────────────────

async function getDashboardData(organizationId: string) {
  const baseWhere = { organizationId, deletedAt: null }

  const [
    projectStatusCounts,
    pendingCRs,
    recentProjects,
    noDocCount,
    level0NoOwnerCount,
    totalProjects,
    totalDatabases,
  ] = await Promise.all([
    // Projects grouped by status
    prisma.project.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    }),

    // Change requests: REQUESTED or IN_PROGRESS
    prisma.changeRequest.count({
      where: {
        project: { organizationId, deletedAt: null },
        status: { in: ['REQUESTED', 'IN_PROGRESS'] },
      },
    }),

    // Last 5 modified projects
    prisma.project.findMany({
      where: baseWhere,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        controlLevel: true,
        updatedAt: true,
        priority: true,
      },
    }),

    // Projects with zero non-deleted documents
    prisma.project.count({
      where: {
        ...baseWhere,
        documents: { none: { deletedAt: null } },
      },
    }),

    // Level 0 projects without a responsible user
    prisma.project.count({
      where: {
        ...baseWhere,
        controlLevel: 'LEVEL_0',
        responsibleUserId: null,
      },
    }),

    // Total projects
    prisma.project.count({ where: baseWhere }),

    // Total databases
    prisma.database.count({ where: { organizationId, deletedAt: null } }),
  ])

  // Build a status → count map
  const statusMap: Partial<Record<string, number>> = {}
  for (const row of projectStatusCounts) {
    statusMap[row.status] = row._count._all
  }
  const sc = (s: string) => statusMap[s] ?? 0

  return {
    totalProjects,
    totalDatabases,
    inProduction:  sc('PRODUCTION'),
    inDevelopment: sc('DEVELOPMENT') + sc('QA') + sc('PLANNING'),
    inIdea:        sc('IDEA'),
    suspended:     sc('SUSPENDED') + sc('DISCONTINUED'),
    pendingCRs,
    recentProjects,
    noDocCount,
    level0NoOwnerCount,
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  caption,
  accentColor,
  href,
}: {
  label: string
  value: number
  caption: string
  accentColor: string
  href?: string
}) {
  const inner = (
    <div
      className="relative rounded overflow-hidden transition-all duration-150 group h-full"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: accentColor }} />

      <div className="p-5">
        <p
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.2em] mb-3"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {label}
        </p>

        <p
          className="text-4xl font-mono font-bold leading-none mb-2"
          style={{ color: accentColor, fontFamily: 'var(--font-jetbrains)' }}
        >
          {value}
        </p>

        <p
          className="text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {caption}
        </p>

        {href && (
          <div
            className="mt-3 flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: accentColor }}
          >
            <span>Ver detalles</span>
            <ArrowRight size={11} />
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    )
  }
  return inner
}

function RiskBadge({
  count,
  label,
  icon,
  severity,
}: {
  count: number
  label: string
  icon: React.ReactNode
  severity: 'warning' | 'danger'
}) {
  const color = severity === 'danger' ? 'var(--status-red)' : 'var(--status-amber)'
  const bg = severity === 'danger' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'
  const border = severity === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'

  return (
    <div
      className="flex items-center gap-3 rounded px-4 py-3"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span style={{ color }}>{icon}</span>
      <div>
        <span
          className="text-2xl font-mono font-bold leading-none"
          style={{ color, fontFamily: 'var(--font-jetbrains)' }}
        >
          {count}
        </span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const data = await getDashboardData(user.organizationId)

  const now = new Date()
  const dateStr = now.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-2xl font-heading font-bold uppercase tracking-wider"
            style={{ color: 'var(--foreground)' }}
          >
            Sistema de Portafolio TI
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            Bienvenido,{' '}
            <span style={{ color: 'var(--foreground)' }}>{user.firstName} {user.lastName}</span>
            {' · '}
            <span
              className="capitalize"
              style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '12px' }}
            >
              {dateStr}
            </span>
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <TrendingUp size={14} style={{ color: 'var(--foreground-muted)' }} />
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {data.totalProjects} proyectos registrados
          </span>
        </div>
      </div>

      {/* ── Status cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Producción"
          value={data.inProduction}
          caption="sistemas activos"
          accentColor="var(--status-green)"
          href="/projects"
        />
        <StatCard
          label="En Desarrollo"
          value={data.inDevelopment}
          caption="planif. + dev + QA"
          accentColor="var(--status-blue)"
          href="/projects"
        />
        <StatCard
          label="Ideas"
          value={data.inIdea}
          caption="por evaluar"
          accentColor="var(--status-purple)"
          href="/projects"
        />
        <StatCard
          label="Suspendidos"
          value={data.suspended}
          caption="inactivos / descontinuados"
          accentColor="var(--status-amber)"
          href="/projects"
        />
      </div>

      {/* ── Databases mini-card ── */}
      <Link href="/databases" className="block">
        <div
          className="flex items-center gap-4 rounded px-5 py-3 transition-all group"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Database size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {data.totalDatabases} base{data.totalDatabases !== 1 ? 's' : ''} de datos registrada{data.totalDatabases !== 1 ? 's' : ''}
            </span>
            <span className="text-xs ml-2" style={{ color: 'var(--foreground-muted)' }}>
              en el inventario
            </span>
          </div>
          <ArrowRight
            size={14}
            style={{ color: 'var(--accent-cyan)' }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </Link>

      {/* ── Pending CRs banner ── */}
      {data.pendingCRs > 0 && (
        <Link href="/change-requests">
          <div
            className="flex items-center gap-4 rounded px-5 py-3.5 transition-all duration-150 group"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--border-bright)',
            }}
          >
            <Clock size={18} style={{ color: 'var(--accent-cyan)' }} />
            <div className="flex-1">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                {data.pendingCRs} solicitud{data.pendingCRs !== 1 ? 'es' : ''} de cambio pendiente
                {data.pendingCRs !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs ml-2"
                style={{ color: 'var(--foreground-muted)' }}
              >
                en estado SOLICITADO o EN PROGRESO
              </span>
            </div>
            <ArrowRight
              size={16}
              style={{ color: 'var(--accent-cyan)' }}
              className="group-hover:translate-x-1 transition-transform"
            />
          </div>
        </Link>
      )}

      {/* ── Bottom grid: recent projects + risk indicators ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Recent projects — takes 2/3 width */}
        <div
          className="lg:col-span-2 rounded overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Table header */}
          <div
            className="flex items-center justify-between px-5 py-3.5 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2
              className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Proyectos Recientes
            </h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-[11px] font-medium transition-colors"
              style={{ color: 'var(--accent-cyan)' }}
            >
              Ver todos
              <ArrowRight size={11} />
            </Link>
          </div>

          {data.recentProjects.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                No hay proyectos registrados
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Código', 'Nombre', 'Estado', 'Nivel', 'Actualizado'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--foreground-dim)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentProjects.map((project, idx) => (
                  <tr
                    key={project.id}
                    style={{
                      borderBottom:
                        idx < data.recentProjects.length - 1
                          ? '1px solid var(--border)'
                          : 'none',
                    }}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    {/* Code */}
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-mono"
                        style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                      >
                        {project.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium truncate max-w-[180px] block transition-colors"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {project.name}
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: STATUS_DOT[project.status] ?? 'var(--foreground-muted)' }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: STATUS_DOT[project.status] ?? 'var(--foreground-muted)' }}
                        >
                          {STATUS_LABELS[project.status] ?? project.status}
                        </span>
                      </span>
                    </td>

                    {/* Control level */}
                    <td className="px-5 py-3">
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--foreground-muted)',
                          fontFamily: 'var(--font-jetbrains)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {CONTROL_LABELS[project.controlLevel] ?? project.controlLevel}
                      </span>
                    </td>

                    {/* Updated at */}
                    <td className="px-5 py-3">
                      <span
                        className="text-xs"
                        style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                      >
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Risk indicators — takes 1/3 width */}
        <div className="space-y-3">
          <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="px-5 py-3.5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2
                className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Indicadores de Riesgo
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <RiskBadge
                count={data.noDocCount}
                label="proyectos sin documentación"
                icon={<AlertTriangle size={18} />}
                severity="warning"
              />
              <RiskBadge
                count={data.level0NoOwnerCount}
                label="proyectos L0 sin responsable"
                icon={<AlertCircle size={18} />}
                severity="danger"
              />

              {data.noDocCount === 0 && data.level0NoOwnerCount === 0 && (
                <p
                  className="text-xs text-center py-2"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  Sin alertas activas
                </p>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="px-5 py-3.5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2
                className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--foreground-muted)' }}
              >
                Acceso Rápido
              </h2>
            </div>

            <div className="p-2">
              {[
                { label: 'Nuevo proyecto',   href: '/projects/new'      },
                { label: 'Nueva base de datos', href: '/databases/new'  },
                { label: 'Nueva solicitud',  href: '/change-requests/new' },
                { label: 'Ver Kanban',       href: '/change-requests'   },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-colors group"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <span>{link.label}</span>
                  <ArrowRight
                    size={13}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--accent-cyan)' }}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
