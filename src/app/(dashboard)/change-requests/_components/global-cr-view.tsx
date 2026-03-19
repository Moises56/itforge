'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  LayoutGrid, List, ExternalLink, Flame, AlertTriangle,
  ArrowDown, Minus, MessageSquare, Paperclip, Filter, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GlobalCRItem = {
  id:                  string
  title:               string
  status:              string
  priority:            string
  type:                string
  requesterName:       string
  requesterDepartment: { id: string; name: string } | null
  assignedTo:          { id: string; firstName: string; lastName: string } | null
  project:             { id: string; name: string; code: string }
  commentCount:        number
  attachmentCount:     number
  createdAt:           string
  updatedAt:           string
}

type Project    = { id: string; name: string; code: string }
type User       = { id: string; firstName: string; lastName: string }

interface Props {
  changeRequests: GlobalCRItem[]
  projects:       Project[]
  users:          User[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { status: 'REQUESTED',    label: 'Solicitado',  color: '#64748b', glow: 'rgba(100,116,139,0.12)' },
  { status: 'UNDER_REVIEW', label: 'En Revisión', color: '#3b82f6', glow: 'rgba(59,130,246,0.12)' },
  { status: 'APPROVED',     label: 'Aprobado',    color: '#10b981', glow: 'rgba(16,185,129,0.12)' },
  { status: 'REJECTED',     label: 'Rechazado',   color: '#ef4444', glow: 'rgba(239,68,68,0.12)' },
  { status: 'IN_PROGRESS',  label: 'En Progreso', color: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
  { status: 'COMPLETED',    label: 'Completado',  color: '#059669', glow: 'rgba(5,150,105,0.12)' },
  { status: 'CANCELLED',    label: 'Cancelado',   color: '#475569', glow: 'rgba(71,85,105,0.12)' },
] as const

const STATUS_CONFIG: Record<string, { label: string; color: string }> = Object.fromEntries(
  COLUMNS.map((c) => [c.status, { label: c.label, color: c.color }]),
)

const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Crítica',  color: '#ef4444', icon: <Flame         size={10} /> },
  HIGH:     { label: 'Alta',     color: '#f59e0b', icon: <AlertTriangle size={10} /> },
  MEDIUM:   { label: 'Media',    color: '#3b82f6', icon: <ArrowDown     size={10} /> },
  LOW:      { label: 'Baja',     color: '#64748b', icon: <Minus         size={10} /> },
} as const

const TYPE_LABELS: Record<string, string> = {
  NEW_FEATURE: 'Nueva Función', MODIFICATION: 'Modificación', BUG_FIX: 'Corrección',
  DATA_CORRECTION: 'Datos', REPORT: 'Reporte', VISUAL_CHANGE: 'Visual', OTHER: 'Otro',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  < 2)  return 'ahora'
  if (mins  < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days  < 7)  return `${days}d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({ cr }: { cr: GlobalCRItem }) {
  const prio   = PRIORITY_CONFIG[cr.priority as keyof typeof PRIORITY_CONFIG]
  const pColor = prio?.color ?? '#64748b'
  return (
    <Link
      href={`/projects/${cr.project.id}/changes`}
      className="block rounded transition-all"
      style={{
        background:  'var(--surface)',
        border:      `1px solid var(--border)`,
        borderLeft:  `3px solid ${pColor}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.borderLeftColor = pColor }}
    >
      {/* Project badge */}
      <div className="px-2.5 pt-2 pb-1 flex items-center gap-1.5">
        <span
          className="text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
          style={{
            background: 'var(--accent-cyan-dim)',
            color:      'var(--accent-cyan)',
            border:     '1px solid rgba(6,182,212,0.15)',
            fontFamily: 'var(--font-jetbrains)',
          }}
        >
          {cr.project.code}
        </span>
        <span className="text-[9px] truncate" style={{ color: 'var(--foreground-dim)' }}>{cr.project.name}</span>
      </div>

      {/* Title */}
      <div className="px-2.5 pb-1">
        <p className="text-xs font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
          {cr.title}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2 flex-wrap">
        <span
          className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: 'var(--surface-2)', color: 'var(--foreground-dim)', border: '1px solid var(--border)', fontFamily: 'var(--font-jetbrains)' }}
        >
          {TYPE_LABELS[cr.type] ?? cr.type}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold" style={{ color: pColor }}>
          {prio?.icon}{prio?.label}
        </span>
        <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}>
          {formatRelative(cr.createdAt)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[9px] truncate flex-1" style={{ color: 'var(--foreground-muted)' }}>{cr.requesterName}</span>
        {cr.assignedTo && (
          <span
            className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}
          >
            {cr.assignedTo.firstName[0]}{cr.assignedTo.lastName[0]}
          </span>
        )}
        {cr.commentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--foreground-dim)' }}>
            <MessageSquare size={9} /> {cr.commentCount}
          </span>
        )}
        {cr.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px]" style={{ color: 'var(--foreground-dim)' }}>
            <Paperclip size={9} /> {cr.attachmentCount}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function TableRow({ cr }: { cr: GlobalCRItem }) {
  const statusCfg = STATUS_CONFIG[cr.status]
  const prioCfg   = PRIORITY_CONFIG[cr.priority as keyof typeof PRIORITY_CONFIG]

  return (
    <tr
      className="group transition-colors"
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Project */}
      <td className="px-3 py-2.5">
        <Link
          href={`/projects/${cr.project.id}/changes`}
          className="inline-flex items-center gap-1.5"
        >
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.15)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {cr.project.code}
          </span>
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{cr.project.name}</span>
        </Link>
      </td>

      {/* Title */}
      <td className="px-3 py-2.5 max-w-xs">
        <Link href={`/projects/${cr.project.id}/changes`}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{cr.title}</p>
          <p className="text-[9px]" style={{ color: 'var(--foreground-dim)' }}>
            {TYPE_LABELS[cr.type]} · {cr.requesterName}
          </p>
        </Link>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        {statusCfg && (
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}
          >
            {statusCfg.label}
          </span>
        )}
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5">
        {prioCfg && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: prioCfg.color }}>
            {prioCfg.icon} {prioCfg.label}
          </span>
        )}
      </td>

      {/* Assignee */}
      <td className="px-3 py-2.5">
        {cr.assignedTo ? (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            {cr.assignedTo.firstName} {cr.assignedTo.lastName}
          </span>
        ) : (
          <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>Sin asignar</span>
        )}
      </td>

      {/* Date */}
      <td className="px-3 py-2.5">
        <span className="text-[10px] font-mono" style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}>
          {formatRelative(cr.createdAt)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <Link
          href={`/projects/${cr.project.id}/changes`}
          className="inline-flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: 'var(--foreground-dim)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-cyan)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground-dim)' }}
        >
          <ExternalLink size={10} /> Ver
        </Link>
      </td>
    </tr>
  )
}

// ─── Filters bar ─────────────────────────────────────────────────────────────

function FiltersBar({
  projects,
  users,
  filters,
  onChange,
  activeCount,
  onReset,
}: {
  projects:    Project[]
  users:       User[]
  filters:     { project: string; status: string; priority: string; assignee: string }
  onChange:    (key: keyof typeof filters, value: string) => void
  activeCount: number
  onReset:     () => void
}) {
  const selCls = 'px-2.5 py-1.5 rounded text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
  const selSty: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }

  return (
    <div
      className="flex items-center gap-2 flex-wrap p-3 rounded"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <Filter size={12} style={{ color: 'var(--foreground-dim)' }} />
      <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--foreground-muted)' }}>Filtros</span>

      <select value={filters.project}  onChange={(e) => onChange('project',  e.target.value)} className={selCls} style={selSty}>
        <option value="">Todos los proyectos</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
      </select>

      <select value={filters.status}   onChange={(e) => onChange('status',   e.target.value)} className={selCls} style={selSty}>
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
      </select>

      <select value={filters.priority} onChange={(e) => onChange('priority', e.target.value)} className={selCls} style={selSty}>
        <option value="">Todas las prioridades</option>
        {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
      </select>

      <select value={filters.assignee} onChange={(e) => onChange('assignee', e.target.value)} className={selCls} style={selSty}>
        <option value="">Todos los responsables</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
      </select>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ml-auto"
          style={{ color: 'var(--status-red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <X size={10} /> Limpiar ({activeCount})
        </button>
      )}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function GlobalCRView({ changeRequests, projects, users }: Props) {
  const [view, setView]     = useState<'kanban' | 'table'>('kanban')
  const [filters, setFilters] = useState({
    project:  '',
    status:   '',
    priority: '',
    assignee: '',
  })

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  const filtered = useMemo(() => {
    return changeRequests.filter((cr) => {
      if (filters.project  && cr.project.id              !== filters.project)  return false
      if (filters.status   && cr.status                  !== filters.status)   return false
      if (filters.priority && cr.priority                !== filters.priority) return false
      if (filters.assignee && cr.assignedTo?.id          !== filters.assignee) return false
      return true
    })
  }, [changeRequests, filters])

  const grouped = COLUMNS.reduce<Record<string, GlobalCRItem[]>>((acc, col) => {
    acc[col.status] = filtered.filter((cr) => cr.status === col.status)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <div
          className="flex rounded overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setView('kanban')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: view === 'kanban' ? 'var(--accent-cyan-dim)' : 'var(--surface)',
              color:      view === 'kanban' ? 'var(--accent-cyan)'    : 'var(--foreground-muted)',
              borderRight: '1px solid var(--border)',
            }}
          >
            <LayoutGrid size={12} /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: view === 'table' ? 'var(--accent-cyan-dim)' : 'var(--surface)',
              color:      view === 'table' ? 'var(--accent-cyan)'    : 'var(--foreground-muted)',
            }}
          >
            <List size={12} /> Tabla
          </button>
        </div>
        <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
          {filtered.length} de {changeRequests.length} solicitudes
        </span>
      </div>

      {/* Filters */}
      <FiltersBar
        projects={projects}
        users={users}
        filters={filters}
        onChange={setFilter}
        activeCount={activeFilterCount}
        onReset={() => setFilters({ project: '', status: '', priority: '', assignee: '' })}
      />

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {COLUMNS.map((col) => {
              const colItems = grouped[col.status] ?? []
              return (
                <div
                  key={col.status}
                  className="flex flex-col rounded shrink-0"
                  style={{ width: 268, background: 'var(--surface)', border: `1px solid var(--border)` }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2.5"
                    style={{ borderBottom: '1px solid var(--border)', borderTop: `2px solid ${col.color}` }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                    <span className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em] flex-1" style={{ color: 'var(--foreground-muted)' }}>
                      {col.label}
                    </span>
                    <span
                      className="text-[9px] font-mono px-1 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', color: 'var(--foreground-dim)', border: '1px solid var(--border)', fontFamily: 'var(--font-jetbrains)' }}
                    >
                      {colItems.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                    {colItems.map((cr) => <KanbanCard key={cr.id} cr={cr} />)}
                    {colItems.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-6">
                        <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>Sin solicitudes</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table view */}
      {view === 'table' && (
        <div
          className="rounded overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Sin solicitudes con los filtros actuales</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {['Proyecto', 'Solicitud', 'Estado', 'Prioridad', 'Responsable', 'Fecha', ''].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cr) => <TableRow key={cr.id} cr={cr} />)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
