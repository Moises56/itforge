import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { getDataScope } from '@/core/permissions/scope'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Database } from 'lucide-react'
import { DatabaseDetailTabs } from './_components/database-detail-tabs'

type PageParams = Promise<{ id: string }>

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const db = await prisma.database.findUnique({
    where:  { id },
    select: { name: true },
  })
  if (!db) return { title: 'Base de datos no encontrada' }
  return { title: `BD — ${db.name}` }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  POSTGRESQL: 'PostgreSQL',
  MYSQL:      'MySQL',
  SQL_SERVER: 'SQL Server',
  MONGODB:    'MongoDB',
  SQLITE:     'SQLite',
  OTHER:      'Otro',
}

const ENGINE_COLORS: Record<string, string> = {
  POSTGRESQL: '#3b82f6',
  MYSQL:      '#f59e0b',
  SQL_SERVER: '#ef4444',
  MONGODB:    '#10b981',
  SQLITE:     '#14b8a6',
  OTHER:      '#6b7280',
}

const MANAGED_BY_LABELS: Record<string, string> = {
  DBA_TEAM: 'Equipo DBA',
  DEV_TEAM: 'Desarrollo',
  EXTERNAL: 'Externo',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DatabaseDetailPage({ params }: { params: PageParams }) {
  const { id }  = await params
  const user    = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'databases', 'view')
  if (!canView) notFound()

  const scope = getDataScope(user.id, user.roles, 'databases')

  const db = await prisma.database.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null, ...scope },
    include: {
      project:     { select: { id: true, name: true, code: true } },
      credentials: {
        where:   { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select:  {
          id:          true,
          label:       true,
          username:    true,
          accessLevel: true,
          createdAt:   true,
        },
      },
    },
  })
  if (!db) notFound()

  // Fetch last reveal log per credential
  const credentialIds = db.credentials.map((c) => c.id)
  const revealLogs = credentialIds.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          action:     'reveal',
          resource:   'databases.credentials',
          resourceId: { in: credentialIds },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          resourceId: true,
          createdAt:  true,
          user: { select: { firstName: true, lastName: true } },
        },
      })
    : []

  // Build last reveal map: credentialId → { at, by }
  const lastRevealMap = new Map<string, { at: string; by: string }>()
  for (const log of revealLogs) {
    const rid = log.resourceId
    if (rid && !lastRevealMap.has(rid)) {
      lastRevealMap.set(rid, {
        at: log.createdAt.toISOString(),
        by: `${log.user.firstName} ${log.user.lastName}`,
      })
    }
  }

  // Permissions
  const [canEdit, canManageCreds] = await Promise.all([
    resolvePermission(user.id, 'databases', 'edit'),
    resolvePermission(user.id, 'databases.credentials', 'create'),
  ])

  // Available projects (for reassignment)
  const availableProjects = canEdit
    ? await prisma.project.findMany({
        where:   { organizationId: user.organizationId, deletedAt: null },
        orderBy: { name: 'asc' },
        select:  { id: true, name: true, code: true },
      })
    : []

  const engColor = ENGINE_COLORS[db.engine] ?? '#6b7280'

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <Link
          href="/databases"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={14} />
          Bases de Datos
        </Link>
        <span style={{ color: 'var(--foreground-dim)' }}>/</span>
        <span className="text-sm truncate max-w-[200px]" style={{ color: 'var(--foreground)' }}>
          {db.name}
        </span>
      </div>

      {/* ── Header ── */}
      <div
        className="rounded overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Engine color bar */}
        <div className="h-1 w-full" style={{ background: engColor }} />

        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="w-12 h-12 rounded flex items-center justify-center shrink-0"
              style={{ background: `${engColor}18`, border: `1px solid ${engColor}30` }}
            >
              <Database size={20} style={{ color: engColor }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1
                  className="text-xl font-heading font-bold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {db.name}
                </h1>
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                  style={{
                    background: `${engColor}18`,
                    color:      engColor,
                    border:     `1px solid ${engColor}30`,
                    fontFamily: 'var(--font-jetbrains)',
                  }}
                >
                  {ENGINE_LABELS[db.engine] ?? db.engine}
                  {db.version ? ` ${db.version}` : ''}
                </span>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    background: db.managedBy === 'DBA_TEAM'
                      ? 'var(--accent-cyan-dim)'
                      : db.managedBy === 'DEV_TEAM'
                      ? 'rgba(139,92,246,0.08)'
                      : 'rgba(245,158,11,0.08)',
                    color: db.managedBy === 'DBA_TEAM'
                      ? 'var(--accent-cyan)'
                      : db.managedBy === 'DEV_TEAM'
                      ? 'var(--status-purple)'
                      : 'var(--status-amber)',
                    border: '1px solid currentColor',
                  }}
                >
                  {MANAGED_BY_LABELS[db.managedBy] ?? db.managedBy}
                </span>
              </div>

              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                {db.serverIp ? (
                  <span
                    className="font-mono"
                    style={{ fontFamily: 'var(--font-jetbrains)' }}
                  >
                    {db.serverIp}{db.port ? `:${db.port}` : ''}
                    {db.databaseName ? ` / ${db.databaseName}` : ''}
                  </span>
                ) : (
                  'Sin servidor configurado'
                )}
                {db.project && (
                  <>
                    {' · '}
                    <Link
                      href={`/projects/${db.project.id}`}
                      className="transition-colors"
                      style={{ color: 'var(--accent-cyan)' }}
                    >
                      {db.project.code} — {db.project.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <DatabaseDetailTabs
        db={{
          id:           db.id,
          name:         db.name,
          engine:       db.engine,
          version:      db.version,
          serverIp:     db.serverIp,
          port:         db.port,
          databaseName: db.databaseName,
          managedBy:    db.managedBy,
          notes:        db.notes,
          createdAt:    db.createdAt.toISOString(),
          updatedAt:    db.updatedAt.toISOString(),
          project:      db.project,
          credentials:  db.credentials.map((c) => ({
            id:          c.id,
            label:       c.label,
            username:    c.username,
            accessLevel: c.accessLevel,
            createdAt:   c.createdAt.toISOString(),
            lastReveal:  lastRevealMap.get(c.id) ?? null,
          })),
        }}
        availableProjects={availableProjects}
        canEdit={canEdit}
        canManageCreds={canManageCreds}
      />
    </div>
  )
}
