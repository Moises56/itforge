import { Suspense } from 'react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { getDataScope } from '@/core/permissions/scope'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Plus, Database, ChevronRight, Key } from 'lucide-react'
import { DatabaseFilters } from './_components/database-filters'
import type { DatabaseEngine, DatabaseManagedBy } from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Bases de Datos' }

// ─── Constants ────────────────────────────────────────────────────────────────

export const ENGINE_META: Record<string, { label: string; color: string; short: string }> = {
  POSTGRESQL: { label: 'PostgreSQL', color: '#3b82f6', short: 'PG'  },
  MYSQL:      { label: 'MySQL',      color: '#f59e0b', short: 'MY'  },
  SQL_SERVER: { label: 'SQL Server', color: '#ef4444', short: 'SQL' },
  MONGODB:    { label: 'MongoDB',    color: '#10b981', short: 'MDB' },
  SQLITE:     { label: 'SQLite',     color: '#14b8a6', short: 'SL'  },
  OTHER:      { label: 'Otro',       color: '#6b7280', short: '?'   },
}

export const MANAGED_BY_META: Record<string, { label: string; color: string; bg: string }> = {
  DBA_TEAM: { label: 'Equipo DBA', color: 'var(--accent-cyan)',   bg: 'var(--accent-cyan-dim)'   },
  DEV_TEAM: { label: 'Desarrollo', color: 'var(--status-purple)', bg: 'rgba(139,92,246,0.08)'    },
  EXTERNAL: { label: 'Externo',    color: 'var(--status-amber)',  bg: 'rgba(245,158,11,0.08)'    },
}

// ─── Type guards ──────────────────────────────────────────────────────────────

const validEngines   = new Set<DatabaseEngine>(['POSTGRESQL','MYSQL','SQL_SERVER','MONGODB','SQLITE','OTHER'])
const validManagedBy = new Set<DatabaseManagedBy>(['DBA_TEAM','DEV_TEAM','EXTERNAL'])

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDatabases(
  organizationId: string,
  userId: string,
  roles: string[],
  filters: { engine: string; managedBy: string; projectId: string; search: string },
) {
  const scope = getDataScope(userId, roles, 'databases')

  const where = {
    organizationId,
    deletedAt: null,
    ...scope,
    ...(filters.engine && validEngines.has(filters.engine as DatabaseEngine) && {
      engine: filters.engine as DatabaseEngine,
    }),
    ...(filters.managedBy && validManagedBy.has(filters.managedBy as DatabaseManagedBy) && {
      managedBy: filters.managedBy as DatabaseManagedBy,
    }),
    ...(filters.projectId && { projectId: filters.projectId }),
    ...(filters.search && {
      OR: [
        { name:         { contains: filters.search, mode: 'insensitive' as const } },
        { databaseName: { contains: filters.search, mode: 'insensitive' as const } },
        { serverIp:     { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
  }

  return prisma.database.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id:           true,
      name:         true,
      engine:       true,
      version:      true,
      serverIp:     true,
      port:         true,
      databaseName: true,
      managedBy:    true,
      project:      { select: { id: true, name: true, code: true } },
      _count:       { select: { credentials: { where: { deletedAt: null } } } },
    },
  })
}

async function getProjects(organizationId: string) {
  return prisma.project.findMany({
    where:   { organizationId, deletedAt: null },
    orderBy: { name: 'asc' },
    select:  { id: true, name: true, code: true },
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  engine?:    string
  managedBy?: string
  project?:   string
  q?:         string
}>

export default async function DatabasesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'databases', 'view')
  if (!canView) redirect('/')

  const canCreate = await resolvePermission(user.id, 'databases', 'create')

  const params = await searchParams

  const [databases, projects] = await Promise.all([
    getDatabases(user.organizationId, user.id, user.roles, {
      engine:    params.engine    ?? '',
      managedBy: params.managedBy ?? '',
      projectId: params.project   ?? '',
      search:    params.q         ?? '',
    }),
    getProjects(user.organizationId),
  ])

  const hasFilters = !!(params.engine || params.managedBy || params.project || params.q)

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-heading font-bold uppercase tracking-wider"
            style={{ color: 'var(--foreground)' }}
          >
            Bases de Datos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {databases.length} base{databases.length !== 1 ? 's' : ''} registrada{databases.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtrado)'}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/databases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            Nueva Base de Datos
          </Link>
        )}
      </div>

      {/* ── Filters ── */}
      <Suspense
        fallback={
          <div
            className="rounded p-4 h-14 animate-pulse"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
        }
      >
        <DatabaseFilters projects={projects} />
      </Suspense>

      {/* ── Empty state ── */}
      {databases.length === 0 ? (
        <div
          className="rounded p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Database
            size={48}
            className="mx-auto mb-4 opacity-20"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
            {hasFilters
              ? 'No se encontraron bases de datos con los filtros seleccionados'
              : 'No hay bases de datos registradas aún'}
          </p>
          {!hasFilters && canCreate && (
            <Link
              href="/databases/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={14} />
              Registrar primera base de datos
            </Link>
          )}
        </div>
      ) : (
        /* ── Table ── */
        <div
          className="rounded overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Base de datos', 'Servidor', 'Proyecto', 'Equipo', 'Credenciales', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--foreground-dim)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {databases.map((db, idx) => {
                const eng  = ENGINE_META[db.engine]    ?? ENGINE_META.OTHER!
                const mgmt = MANAGED_BY_META[db.managedBy] ?? MANAGED_BY_META.EXTERNAL!

                return (
                  <tr
                    key={db.id}
                    className="transition-colors hover:bg-white/[0.02] group"
                    style={{
                      borderBottom:
                        idx < databases.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {/* Name + engine */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: `${eng.color}18`,
                            color:      eng.color,
                            border:     `1px solid ${eng.color}30`,
                            fontFamily: 'var(--font-jetbrains)',
                          }}
                        >
                          {eng.short}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/databases/${db.id}`}
                            className="block font-medium truncate max-w-[180px] group-hover:text-[var(--accent-cyan)] transition-colors"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {db.name}
                          </Link>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
                          >
                            {eng.label}{db.version ? ` ${db.version}` : ''}
                            {db.databaseName ? ` · ${db.databaseName}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Server */}
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-mono"
                        style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                      >
                        {db.serverIp
                          ? `${db.serverIp}${db.port ? `:${db.port}` : ''}`
                          : <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-3">
                      {db.project ? (
                        <Link
                          href={`/projects/${db.project.id}`}
                          className="text-xs font-mono transition-colors"
                          style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
                        >
                          {db.project.code}
                        </Link>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>—</span>
                      )}
                    </td>

                    {/* ManagedBy */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: mgmt.bg,
                          color:      mgmt.color,
                          border:     `1px solid ${mgmt.color}30`,
                        }}
                      >
                        {mgmt.label}
                      </span>
                    </td>

                    {/* Credentials count */}
                    <td className="px-4 py-3">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{
                          color: db._count.credentials > 0
                            ? 'var(--foreground-muted)'
                            : 'var(--foreground-dim)',
                        }}
                      >
                        <Key size={11} />
                        {db._count.credentials}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/databases/${db.id}`}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                        style={{
                          color:      'var(--accent-cyan)',
                          background: 'var(--accent-cyan-dim)',
                          border:     '1px solid rgba(6,182,212,0.2)',
                        }}
                      >
                        Ver
                        <ChevronRight size={10} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
