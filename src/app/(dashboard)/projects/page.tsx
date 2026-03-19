import { Suspense } from 'react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Plus,
  FolderKanban,
  Globe,
  Monitor,
  Server,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react'
import { ProjectFilters } from './_components/project-filters'
import { ProjectCard } from '@/components/shared/project-card'
import { BadgeControlLevel } from '@/components/shared/badge-control-level'
import { BadgeStatus } from '@/components/shared/badge-status'
import type {
  ProjectStatus,
  DeploymentType,
  ControlLevel,
} from '@/generated/prisma/client'

export const metadata: Metadata = { title: 'Proyectos' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20]

const DEPLOYMENT_ICONS: Record<string, React.ReactNode> = {
  WEB:     <Globe    size={14} />,
  DESKTOP: <Monitor  size={14} />,
  SERVICE: <Server   size={14} />,
  MOBILE:  <Smartphone size={14} />,
}

const DEPLOYMENT_LABELS: Record<string, string> = {
  WEB: 'Web', DESKTOP: 'Desktop', SERVICE: 'Servicio', MOBILE: 'Móvil',
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours   / 24)
  if (minutes < 2)  return 'ahora'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours   < 24) return `hace ${hours}h`
  if (days    <  7) return `hace ${days}d`
  if (days    < 30) return `hace ${Math.floor(days / 7)}sem`
  return `hace ${Math.floor(days / 30)}mes`
}

// ─── Type guards ──────────────────────────────────────────────────────────────

const validStatus   = new Set<ProjectStatus>(['IDEA','PLANNING','DEVELOPMENT','QA','PRODUCTION','SUSPENDED','DISCONTINUED'])
const validType     = new Set<DeploymentType>(['WEB','DESKTOP','SERVICE','MOBILE'])
const validControl  = new Set<ControlLevel>(['LEVEL_0','LEVEL_1','LEVEL_2','LEVEL_3'])

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getProjects(
  organizationId: string,
  filters: {
    statuses: string[]
    deploymentType: string
    controlLevel: string
    departmentId: string
    search: string
    page: number
    pageSize: number
  },
) {
  const { statuses, deploymentType, controlLevel, departmentId, search, page, pageSize } =
    filters

  const where = {
    organizationId,
    deletedAt: null,
    ...(statuses.length > 0 && {
      status: {
        in: statuses.filter((s): s is ProjectStatus => validStatus.has(s as ProjectStatus)),
      },
    }),
    ...(deploymentType && validType.has(deploymentType as DeploymentType) && {
      deploymentType: deploymentType as DeploymentType,
    }),
    ...(controlLevel && validControl.has(controlLevel as ControlLevel) && {
      controlLevel: controlLevel as ControlLevel,
    }),
    ...(departmentId && {
      departmentUsages: { some: { departmentId } },
    }),
    ...(search && {
      OR: [
        { name:        { contains: search, mode: 'insensitive' as const } },
        { code:        { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      select: {
        id:             true,
        name:           true,
        code:           true,
        status:         true,
        controlLevel:   true,
        deploymentType: true,
        priority:       true,
        updatedAt:      true,
        responsibleUser: { select: { firstName: true, lastName: true } },
        techStack: {
          take:    3,
          orderBy: { createdAt: 'asc' },
          select:  { name: true, category: true },
        },
        environments: {
          where:  { type: 'PRODUCTION' },
          select: { url: true },
          take:   1,
        },
        _count: { select: { changeRequests: true, credentials: true } },
      },
    }),
    prisma.project.count({ where }),
  ])

  return {
    projects: projects.map((p) => ({
      ...p,
      productionUrl: p.environments[0]?.url ?? null,
    })),
    total,
  }
}

async function getDepartments(organizationId: string) {
  return prisma.department.findMany({
    where:   { organizationId, deletedAt: null },
    orderBy: { name: 'asc' },
    select:  { id: true, name: true, code: true },
  })
}

// ─── Pagination component ─────────────────────────────────────────────────────

function Pagination({
  currentPage,
  pageSize,
  total,
  baseQuery,
}: {
  currentPage: number
  pageSize:    number
  total:       number
  baseQuery:   string
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const buildUrl = (page: number, size?: number) => {
    const params = new URLSearchParams(baseQuery)
    params.set('page', String(page))
    if (size) params.set('pageSize', String(size))
    return `/projects?${params.toString()}`
  }

  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
        Mostrando {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, total)} de {total} proyectos
      </p>
      <div className="flex items-center gap-1">
        {/* Prev */}
        {currentPage > 1 ? (
          <Link
            href={buildUrl(currentPage - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
            }}
          >
            <ChevronLeft size={12} />
            Anterior
          </Link>
        ) : (
          <span
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs opacity-30"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <ChevronLeft size={12} />
            Anterior
          </span>
        )}

        {/* Pages */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs" style={{ color: 'var(--foreground-dim)' }}>
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildUrl(p)}
              className="w-7 h-7 flex items-center justify-center rounded text-xs font-mono font-medium transition-all"
              style={{
                background: p === currentPage ? 'var(--accent)' : 'var(--surface)',
                border: p === currentPage ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: p === currentPage ? '#fff' : 'var(--foreground-muted)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              {p}
            </Link>
          ),
        )}

        {/* Next */}
        {currentPage < totalPages ? (
          <Link
            href={buildUrl(currentPage + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
            }}
          >
            Siguiente
            <ChevronRight size={12} />
          </Link>
        ) : (
          <span
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs opacity-30"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Siguiente
            <ChevronRight size={12} />
          </span>
        )}

        {/* Page size selector */}
        <div className="ml-3 flex items-center gap-1.5">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Link
              key={size}
              href={buildUrl(1, size)}
              className="px-2 py-1 rounded text-xs font-mono transition-all"
              style={{
                background: pageSize === size ? 'var(--accent-glow)' : 'var(--surface)',
                border: pageSize === size ? '1px solid var(--border-bright)' : '1px solid var(--border)',
                color: pageSize === size ? 'var(--accent-cyan)' : 'var(--foreground-dim)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              {size}
            </Link>
          ))}
          <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>/ pág.</span>
        </div>
      </div>
    </div>
  )
}

// ─── Table view ───────────────────────────────────────────────────────────────

type ProjectRow = {
  id: string
  name: string
  code: string
  status: string
  controlLevel: string
  deploymentType: string
  priority: string
  updatedAt: Date
  productionUrl: string | null
  responsibleUser: { firstName: string; lastName: string } | null
  techStack: Array<{ name: string; category: string }>
  _count: { changeRequests: number; credentials: number }
}

function ProjectTableView({ projects }: { projects: ProjectRow[] }) {
  return (
    <div
      className="rounded overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Proyecto', 'Stack', 'Estado', 'Nivel', 'Responsable', 'Actualizado', ''].map((h) => (
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
          {projects.map((project, idx) => (
            <tr
              key={project.id}
              className="transition-colors hover:bg-white/[0.02] group"
              style={{
                borderBottom:
                  idx < projects.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Project name + code */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {DEPLOYMENT_ICONS[project.deploymentType] ?? <FolderKanban size={12} />}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block font-medium truncate max-w-[200px] group-hover:text-[var(--accent-cyan)] transition-colors"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {project.name}
                    </Link>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
                    >
                      {project.code}
                    </span>
                  </div>
                </div>
              </td>

              {/* Tech stack */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 flex-wrap">
                  {project.techStack.slice(0, 3).map((t, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{
                        color: 'var(--foreground-muted)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {t.name}
                    </span>
                  ))}
                  {project.techStack.length === 0 && (
                    <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
                      —
                    </span>
                  )}
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-3">
                <BadgeStatus status={project.status} size="xs" />
              </td>

              {/* Control level */}
              <td className="px-4 py-3">
                <BadgeControlLevel level={project.controlLevel} size="xs" />
              </td>

              {/* Responsible */}
              <td className="px-4 py-3">
                <span className="text-xs truncate max-w-[120px] block" style={{ color: 'var(--foreground-muted)' }}>
                  {project.responsibleUser
                    ? `${project.responsibleUser.firstName} ${project.responsibleUser.lastName}`
                    : '—'}
                </span>
              </td>

              {/* Updated */}
              <td className="px-4 py-3">
                <span
                  className="text-xs"
                  style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                >
                  {formatRelativeTime(project.updatedAt)}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end">
                  {project.productionUrl && (
                    <a
                      href={project.productionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                      style={{
                        color: '#10b981',
                        background: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={10} />
                      Sitio
                    </a>
                  )}
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                    style={{
                      color: 'var(--accent-cyan)',
                      background: 'var(--accent-cyan-dim)',
                      border: '1px solid rgba(6,182,212,0.2)',
                    }}
                  >
                    Ver
                    <ChevronRight size={10} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{
  status?:     string
  type?:       string
  level?:      string
  department?: string
  q?:          string
  view?:       string
  page?:       string
  pageSize?:   string
}>

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getCurrentUser()

  // Permission check
  const canView = await resolvePermission(user.id, 'projects', 'view')
  if (!canView) redirect('/')

  const canCreate = await resolvePermission(user.id, 'projects', 'create')

  const params      = await searchParams
  const statuses    = (params.status ?? '').split(',').filter(Boolean)
  const page        = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize    = PAGE_SIZE_OPTIONS.includes(parseInt(params.pageSize ?? '', 10))
    ? parseInt(params.pageSize!, 10)
    : 10
  const view        = params.view === 'table' ? 'table' : 'grid'

  const [{ projects, total }, departments] = await Promise.all([
    getProjects(user.organizationId, {
      statuses,
      deploymentType: params.type   ?? '',
      controlLevel:   params.level  ?? '',
      departmentId:   params.department ?? '',
      search:         params.q      ?? '',
      page,
      pageSize,
    }),
    getDepartments(user.organizationId),
  ])

  // Build base query string (for pagination links, preserving filters)
  const baseParams = new URLSearchParams()
  if (params.status)     baseParams.set('status',     params.status)
  if (params.type)       baseParams.set('type',        params.type)
  if (params.level)      baseParams.set('level',       params.level)
  if (params.department) baseParams.set('department',  params.department)
  if (params.q)          baseParams.set('q',           params.q)
  if (params.view)       baseParams.set('view',        params.view)
  if (pageSize !== 10)   baseParams.set('pageSize',    String(pageSize))

  const hasFilters = statuses.length > 0 || params.type || params.level || params.department || params.q

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-heading font-bold uppercase tracking-wider"
            style={{ color: 'var(--foreground)' }}
          >
            Proyectos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {total} proyecto{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
            {hasFilters && ' (filtrado)'}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            Nuevo Proyecto
          </Link>
        )}
      </div>

      {/* ── Filters (client, needs Suspense for useSearchParams) ── */}
      <Suspense
        fallback={
          <div
            className="rounded p-4 h-14 animate-pulse"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
        }
      >
        <ProjectFilters departments={departments} />
      </Suspense>

      {/* ── Empty state ── */}
      {projects.length === 0 ? (
        <div
          className="rounded p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <FolderKanban
            size={48}
            className="mx-auto mb-4 opacity-20"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
            {hasFilters
              ? 'No se encontraron proyectos con los filtros seleccionados'
              : 'No hay proyectos registrados aún'}
          </p>
          {!hasFilters && canCreate && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={14} />
              Crear primer proyecto
            </Link>
          )}
        </div>
      ) : view === 'grid' ? (
        /* ── Grid view ── */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        /* ── Table view ── */
        <ProjectTableView projects={projects} />
      )}

      {/* ── Pagination ── */}
      {total > 0 && (
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          total={total}
          baseQuery={baseParams.toString()}
        />
      )}
    </div>
  )
}
