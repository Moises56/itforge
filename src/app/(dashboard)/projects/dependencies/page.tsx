import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Network,
  AlertTriangle,
  ArrowRight,
  GitBranch,
  Database,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Mapa de Dependencias' }

// ─── Types ────────────────────────────────────────────────────────────────────

type RelationType = 'DEPENDS_ON' | 'EXTENDS' | 'REPLACES' | 'SHARES_DATABASE'

interface ProjectNode {
  id: string
  name: string
  code: string
  status: string
  controlLevel: string
}

interface RelationEdge {
  id: string
  type: RelationType
  notes: string | null
  source: ProjectNode
  target: ProjectNode
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PRODUCTION:   'var(--status-green)',
  QA:           'var(--status-blue)',
  DEVELOPMENT:  'var(--status-blue)',
  PLANNING:     'var(--status-purple)',
  IDEA:         'var(--status-slate)',
  SUSPENDED:    'var(--status-amber)',
  DISCONTINUED: 'var(--status-red)',
}

const RELATION_CONFIG: Record<RelationType, {
  label: string
  description: string
  color: string
  bg: string
  border: string
  icon: React.ReactNode
}> = {
  DEPENDS_ON: {
    label:       'Dependencias',
    description: 'Proyectos que necesitan de otro para funcionar',
    color:       '#f59e0b',
    bg:          'rgba(245,158,11,0.08)',
    border:      'rgba(245,158,11,0.2)',
    icon:        <GitBranch size={14} />,
  },
  EXTENDS: {
    label:       'Extensiones',
    description: 'Proyectos satélite que añaden funcionalidad a un sistema base',
    color:       '#3b82f6',
    bg:          'rgba(59,130,246,0.08)',
    border:      'rgba(59,130,246,0.2)',
    icon:        <Layers size={14} />,
  },
  REPLACES: {
    label:       'Reemplazos',
    description: 'Nuevos sistemas que sustituyen a sistemas legacy',
    color:       '#8b5cf6',
    bg:          'rgba(139,92,246,0.08)',
    border:      'rgba(139,92,246,0.2)',
    icon:        <ArrowRight size={14} />,
  },
  SHARES_DATABASE: {
    label:       'BD Compartida',
    description: 'Sistemas que comparten la misma base de datos',
    color:       '#06b6d4',
    bg:          'rgba(6,182,212,0.08)',
    border:      'rgba(6,182,212,0.2)',
    icon:        <Database size={14} />,
  },
}

// ─── Risk computation ─────────────────────────────────────────────────────────

function computeRisks(edges: RelationEdge[]) {
  const risks: { type: 'level0_dependency' | 'long_chain' | 'shared_db_cluster'; title: string; description: string; projects: ProjectNode[] }[] = []

  // 1. Level-0 projects with dependents
  const dependsOnEdges = edges.filter((e) => e.type === 'DEPENDS_ON')
  const targetIds = new Set(dependsOnEdges.map((e) => e.target.id))
  const level0WithDependents = dependsOnEdges
    .filter((e) => e.target.controlLevel === 'LEVEL_0' && targetIds.has(e.target.id))
    .map((e) => e.target)
  const uniqueLevel0 = [...new Map(level0WithDependents.map((p) => [p.id, p])).values()]
  if (uniqueLevel0.length > 0) {
    risks.push({
      type: 'level0_dependency',
      title: 'Legacy sin control con dependientes',
      description: `${uniqueLevel0.length} proyecto${uniqueLevel0.length !== 1 ? 's' : ''} de Nivel 0 (caja negra) tiene otros proyectos que dependen de ${uniqueLevel0.length !== 1 ? 'ellos' : 'él'}. Si falla, afecta a sus dependientes.`,
      projects: uniqueLevel0,
    })
  }

  // 2. Long dependency chains (depth >= 3)
  const dependencyMap = new Map<string, string[]>()
  for (const e of dependsOnEdges) {
    if (!dependencyMap.has(e.source.id)) dependencyMap.set(e.source.id, [])
    dependencyMap.get(e.source.id)!.push(e.target.id)
  }
  const projectMap = new Map<string, ProjectNode>()
  for (const e of edges) {
    projectMap.set(e.source.id, e.source)
    projectMap.set(e.target.id, e.target)
  }

  const chainRoots: ProjectNode[] = []
  const visited = new Set<string>()

  function maxDepth(id: string, seen = new Set<string>()): number {
    if (seen.has(id)) return 0 // cycle guard
    seen.add(id)
    const children = dependencyMap.get(id) ?? []
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map((c) => maxDepth(c, new Set(seen))))
  }

  for (const [sourceId] of dependencyMap) {
    if (!visited.has(sourceId)) {
      visited.add(sourceId)
      const depth = maxDepth(sourceId)
      if (depth >= 3) {
        const proj = projectMap.get(sourceId)
        if (proj) chainRoots.push(proj)
      }
    }
  }

  if (chainRoots.length > 0) {
    risks.push({
      type: 'long_chain',
      title: 'Cadenas de dependencia largas',
      description: `${chainRoots.length} proyecto${chainRoots.length !== 1 ? 's' : ''} inicia${chainRoots.length !== 1 ? 'n' : ''} una cadena de dependencia de 3 o más niveles. Un fallo en la base puede propagarse.`,
      projects: chainRoots,
    })
  }

  // 3. Shared DB clusters (3+ projects)
  const sharedDbEdges = edges.filter((e) => e.type === 'SHARES_DATABASE')
  const sharedDbClusters = new Map<string, Set<string>>()
  for (const e of sharedDbEdges) {
    const key = [e.source.id, e.target.id].sort().join('|')
    if (!sharedDbClusters.has(e.source.id)) sharedDbClusters.set(e.source.id, new Set())
    sharedDbClusters.get(e.source.id)!.add(e.target.id)
    if (!sharedDbClusters.has(e.target.id)) sharedDbClusters.set(e.target.id, new Set())
    sharedDbClusters.get(e.target.id)!.add(e.source.id)
    void key
  }

  const largeClusterNodes = new Set<string>()
  for (const [nodeId, neighbors] of sharedDbClusters) {
    if (neighbors.size >= 2) largeClusterNodes.add(nodeId)
  }

  if (largeClusterNodes.size >= 3) {
    const clusterProjects = [...largeClusterNodes]
      .map((id) => projectMap.get(id))
      .filter((p): p is ProjectNode => p !== undefined)
    risks.push({
      type: 'shared_db_cluster',
      title: 'Cluster de BD compartida',
      description: `${clusterProjects.length} proyectos comparten la misma base de datos. Cambios en el schema pueden afectar a todos simultáneamente.`,
      projects: clusterProjects,
    })
  }

  return risks
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProjectBadge({ project, showLevel = false }: { project: ProjectNode; showLevel?: boolean }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      }}
    >
      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}>
        {project.code}
      </span>
      <span className="font-medium max-w-[140px] truncate">{project.name}</span>
      <span style={{ color: STATUS_COLORS[project.status] ?? 'var(--foreground-dim)' }}>●</span>
      {showLevel && (
        <span
          className="text-[9px] px-1 py-0 rounded"
          style={{
            background: project.controlLevel === 'LEVEL_0' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
            color: project.controlLevel === 'LEVEL_0' ? '#ef4444' : 'var(--foreground-dim)',
          }}
        >
          {project.controlLevel.replace('LEVEL_', 'L')}
        </span>
      )}
    </Link>
  )
}

function RiskCard({
  risk,
}: {
  risk: ReturnType<typeof computeRisks>[number]
}) {
  const colors = {
    level0_dependency: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
    long_chain:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' },
    shared_db_cluster: { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.25)' },
  }
  const c = colors[risk.type]
  return (
    <div className="rounded p-3 space-y-2.5" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: c.color }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: c.color }}>{risk.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{risk.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-5">
        {risk.projects.map((p) => (
          <ProjectBadge key={p.id} project={p} showLevel />
        ))}
      </div>
    </div>
  )
}

function RelationSection({ type, edges }: { type: RelationType; edges: RelationEdge[] }) {
  const cfg = RELATION_CONFIG[type]
  if (edges.length === 0) return null
  return (
    <div className="rounded overflow-hidden" style={{ border: `1px solid ${cfg.border}` }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: cfg.bg }}>
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[11px] ml-2" style={{ color: 'var(--foreground-dim)' }}>{cfg.description}</span>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          {edges.length}
        </span>
      </div>

      {/* Edge list */}
      <div className="divide-y divide-[var(--border)]">
        {edges.map((edge) => (
          <div
            key={edge.id}
            className="px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--surface)' }}
          >
            <ProjectBadge project={edge.source} />
            <ChevronRight size={13} style={{ color: 'var(--foreground-dim)', flexShrink: 0 }} />
            <ProjectBadge project={edge.target} />
            {edge.notes && (
              <span
                className="ml-auto text-[11px] max-w-[240px] truncate"
                style={{ color: 'var(--foreground-muted)' }}
                title={edge.notes}
              >
                {edge.notes}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DependenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; project?: string }>
}) {
  const user = await getCurrentUser()
  const canView = await resolvePermission(user.id, 'projects', 'view')
  if (!canView) notFound()

  const { type: filterType, project: filterProject } = await searchParams

  const rawRelations = await prisma.projectRelation.findMany({
    where: {
      sourceProject: { organizationId: user.organizationId, deletedAt: null },
      targetProject: { organizationId: user.organizationId, deletedAt: null },
    },
    include: {
      sourceProject: { select: { id: true, name: true, code: true, status: true, controlLevel: true } },
      targetProject: { select: { id: true, name: true, code: true, status: true, controlLevel: true } },
    },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })

  const allProjects = await prisma.project.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: [{ code: 'asc' }],
  })

  const edges: RelationEdge[] = rawRelations.map((r) => ({
    id:     r.id,
    type:   r.type as RelationType,
    notes:  r.notes,
    source: { ...r.sourceProject, status: r.sourceProject.status as string, controlLevel: r.sourceProject.controlLevel as string },
    target: { ...r.targetProject, status: r.targetProject.status as string, controlLevel: r.targetProject.controlLevel as string },
  }))

  // Apply filters
  const filteredEdges = edges.filter((e) => {
    if (filterType && e.type !== filterType) return false
    if (filterProject && e.source.id !== filterProject && e.target.id !== filterProject) return false
    return true
  })

  const risks = computeRisks(edges) // always computed on unfiltered data

  const typeKeys: RelationType[] = ['DEPENDS_ON', 'EXTENDS', 'REPLACES', 'SHARES_DATABASE']

  const byType = typeKeys.reduce<Record<RelationType, RelationEdge[]>>((acc, t) => {
    acc[t] = filteredEdges.filter((e) => e.type === t)
    return acc
  }, {} as Record<RelationType, RelationEdge[]>)

  const isFiltered = Boolean(filterType || filterProject)

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      {/* ── Header ── */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center shrink-0"
            style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <Network size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
              Mapa de Dependencias
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Vista global de todas las relaciones entre proyectos — {edges.length} relación{edges.length !== 1 ? 'es' : ''} totales
            </p>
          </div>
        </div>

        {/* Summary strip */}
        {edges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {typeKeys.map((t) => {
              const cfg = RELATION_CONFIG[t]
              const count = edges.filter((e) => e.type === t).length
              if (count === 0) return null
              return (
                <div
                  key={t}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="font-mono font-bold" style={{ color: cfg.color }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <form
        className="flex flex-wrap gap-3 items-end"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.375rem',
          padding: '0.875rem 1rem',
        }}
      >
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--foreground-dim)' }}>
            Tipo de relación
          </label>
          <select
            name="type"
            defaultValue={filterType ?? ''}
            className="w-full px-2.5 py-2 rounded text-xs outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="">Todos los tipos</option>
            {typeKeys.map((t) => (
              <option key={t} value={t}>{RELATION_CONFIG[t].label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--foreground-dim)' }}>
            Proyecto específico
          </label>
          <select
            name="project"
            defaultValue={filterProject ?? ''}
            className="w-full px-2.5 py-2 rounded text-xs outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="">Todos los proyectos</option>
            {allProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Filtrar
        </button>

        {isFiltered && (
          <Link
            href="/projects/dependencies"
            className="px-3 py-2 rounded text-xs font-medium"
            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Risk indicators ── */}
      {risks.length > 0 && !isFiltered && (
        <div
          className="rounded p-4 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
            <h2 className="text-xs font-heading font-semibold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
              Indicadores de Riesgo
            </h2>
          </div>
          {risks.map((r, i) => (
            <RiskCard key={i} risk={r} />
          ))}
        </div>
      )}

      {/* ── Relations ── */}
      {filteredEdges.length === 0 ? (
        <div
          className="rounded p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border-bright)' }}
        >
          <Network size={40} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
            {isFiltered ? 'Sin relaciones para este filtro' : 'No hay relaciones entre proyectos'}
          </p>
          {!isFiltered && (
            <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
              Las relaciones se definen desde el tab &ldquo;Relaciones&rdquo; en el detalle de cada proyecto.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {typeKeys.map((t) => (
            <RelationSection key={t} type={t} edges={byType[t]} />
          ))}
        </div>
      )}

      {/* ── Info footer ── */}
      <div
        className="flex items-start gap-2 px-4 py-3 rounded text-[11px]"
        style={{
          background: 'rgba(100,116,139,0.06)',
          border: '1px solid var(--border)',
          color: 'var(--foreground-dim)',
        }}
      >
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          Las relaciones se gestionan desde el tab <strong style={{ color: 'var(--foreground-muted)' }}>Relaciones</strong> en el detalle de cada proyecto.
          Los indicadores de riesgo se calculan automáticamente en base a los niveles de control y la estructura de dependencias.
        </span>
      </div>
    </div>
  )
}
