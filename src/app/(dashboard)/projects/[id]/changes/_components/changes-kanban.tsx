'use client'

import { useState, useRef, useTransition } from 'react'
import {
  Plus, MessageSquare, Paperclip, GripVertical, ChevronDown,
  AlertTriangle, Flame, ArrowDown, Minus,
} from 'lucide-react'
import { changeStatus } from '@/modules/development/actions/change-requests'
import { ChangeRequestModal } from './change-request-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CRItem = {
  id:                  string
  title:               string
  status:              string
  priority:            string
  type:                string
  requesterName:       string
  requesterDepartment: { id: string; name: string } | null
  assignedTo:          { id: string; firstName: string; lastName: string } | null
  commentCount:        number
  attachmentCount:     number
  createdAt:           string
  updatedAt:           string
}

type User       = { id: string; firstName: string; lastName: string }
type Department = { id: string; name: string; code: string }

interface Props {
  projectId:     string
  projectName:   string
  changeRequests: CRItem[]
  users:         User[]
  departments:   Department[]
  currentUserId: string
  canCreate:     boolean
  canManage:     boolean
  canEdit:       boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED:    ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'REQUESTED'],
  APPROVED:     ['IN_PROGRESS', 'CANCELLED'],
  REJECTED:     ['REQUESTED'],
  IN_PROGRESS:  ['COMPLETED', 'CANCELLED'],
  COMPLETED:    [],
  CANCELLED:    ['REQUESTED'],
}

const COLUMNS = [
  { status: 'REQUESTED',    label: 'Solicitado',  color: '#64748b', glow: 'rgba(100,116,139,0.15)' },
  { status: 'UNDER_REVIEW', label: 'En Revisión', color: '#3b82f6', glow: 'rgba(59,130,246,0.15)' },
  { status: 'APPROVED',     label: 'Aprobado',    color: '#10b981', glow: 'rgba(16,185,129,0.15)' },
  { status: 'REJECTED',     label: 'Rechazado',   color: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
  { status: 'IN_PROGRESS',  label: 'En Progreso', color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
  { status: 'COMPLETED',    label: 'Completado',  color: '#059669', glow: 'rgba(5,150,105,0.15)' },
  { status: 'CANCELLED',    label: 'Cancelado',   color: '#475569', glow: 'rgba(71,85,105,0.15)' },
] as const

const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Crítica',  color: '#ef4444', icon: <Flame    size={10} /> },
  HIGH:     { label: 'Alta',     color: '#f59e0b', icon: <AlertTriangle size={10} /> },
  MEDIUM:   { label: 'Media',    color: '#3b82f6', icon: <ArrowDown size={10} /> },
  LOW:      { label: 'Baja',     color: '#64748b', icon: <Minus    size={10} /> },
} as const

const TYPE_LABELS: Record<string, string> = {
  NEW_FEATURE:     'Nueva Función',
  MODIFICATION:    'Modificación',
  BUG_FIX:        'Corrección',
  DATA_CORRECTION: 'Datos',
  REPORT:          'Reporte',
  VISUAL_CHANGE:   'Visual',
  OTHER:           'Otro',
}

// ─── Style helpers ────────────────────────────────────────────────────────────

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

// ─── Card ─────────────────────────────────────────────────────────────────────

function CRCard({
  cr,
  onDragStart,
  onDragEnd,
  onOpen,
  isDragging,
}: {
  cr:          CRItem
  onDragStart: (e: React.DragEvent, cr: CRItem) => void
  onDragEnd:   () => void
  onOpen:      (cr: CRItem) => void
  isDragging:  boolean
}) {
  const prio  = PRIORITY_CONFIG[cr.priority as keyof typeof PRIORITY_CONFIG]
  const pColor = prio?.color ?? '#64748b'

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, cr)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(cr)}
      className="group rounded cursor-pointer transition-all select-none"
      style={{
        background:   'var(--surface)',
        border:       `1px solid var(--border)`,
        borderLeft:   `3px solid ${pColor}`,
        opacity:      isDragging ? 0.4 : 1,
        transform:    isDragging ? 'scale(0.98)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor      = 'var(--border-bright)'
        el.style.borderLeftColor  = pColor
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor      = 'var(--border)'
        el.style.borderLeftColor  = pColor
      }}
    >
      {/* Drag handle */}
      <div className="flex items-start gap-1.5 px-2.5 pt-2.5 pb-1">
        <GripVertical
          size={12}
          className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-30 transition-opacity cursor-grab"
          style={{ color: 'var(--foreground-dim)' }}
        />
        <p
          className="text-xs font-medium leading-snug flex-1 min-w-0"
          style={{ color: 'var(--foreground)' }}
        >
          {cr.title}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2 flex-wrap">
        {/* Type */}
        <span
          className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--surface-2)',
            color:      'var(--foreground-dim)',
            border:     '1px solid var(--border)',
            fontFamily: 'var(--font-jetbrains)',
          }}
        >
          {TYPE_LABELS[cr.type] ?? cr.type}
        </span>

        {/* Priority */}
        <span
          className="inline-flex items-center gap-0.5 text-[9px] font-semibold"
          style={{ color: pColor }}
        >
          {prio?.icon}
          {prio?.label}
        </span>

        {/* Time */}
        <span
          className="ml-auto text-[9px] font-mono"
          style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
        >
          {formatRelative(cr.createdAt)}
        </span>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 px-2.5 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Requester */}
        <span className="text-[9px] truncate flex-1" style={{ color: 'var(--foreground-muted)' }}>
          {cr.requesterName}
          {cr.requesterDepartment && (
            <span style={{ color: 'var(--foreground-dim)' }}> · {cr.requesterDepartment.name}</span>
          )}
        </span>

        {/* Assignee avatar */}
        {cr.assignedTo && (
          <span
            className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}
            title={`${cr.assignedTo.firstName} ${cr.assignedTo.lastName}`}
          >
            {cr.assignedTo.firstName[0]}{cr.assignedTo.lastName[0]}
          </span>
        )}

        {/* Counters */}
        {cr.commentCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[9px]"
            style={{ color: 'var(--foreground-dim)' }}
          >
            <MessageSquare size={9} /> {cr.commentCount}
          </span>
        )}
        {cr.attachmentCount > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-[9px]"
            style={{ color: 'var(--foreground-dim)' }}
          >
            <Paperclip size={9} /> {cr.attachmentCount}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  items,
  isDragOver,
  canDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onOpen,
  draggingId,
}: {
  col:         (typeof COLUMNS)[number]
  items:       CRItem[]
  isDragOver:  boolean
  canDrop:     boolean
  onDragOver:  (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop:      (e: React.DragEvent) => void
  onDragStart: (e: React.DragEvent, cr: CRItem) => void
  onDragEnd:   () => void
  onOpen:      (cr: CRItem) => void
  draggingId:  string | null
}) {
  return (
    <div
      className="flex flex-col rounded shrink-0"
      style={{
        width:      268,
        background: isDragOver && canDrop ? col.glow : 'var(--surface)',
        border:     `1px solid ${isDragOver && canDrop ? col.color : 'var(--border)'}`,
        transition: 'border-color 150ms, background 150ms',
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          borderBottom: `1px solid var(--border)`,
          borderTop:    `2px solid ${col.color}`,
        }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: col.color }}
        />
        <span
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em] flex-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {col.label}
        </span>
        <span
          className="text-[9px] font-mono px-1 py-0.5 rounded"
          style={{
            background: 'var(--surface-2)',
            color:      'var(--foreground-dim)',
            border:     '1px solid var(--border)',
            fontFamily: 'var(--font-jetbrains)',
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 min-h-[120px] flex-1">
        {items.map((cr) => (
          <CRCard
            key={cr.id}
            cr={cr}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpen={onOpen}
            isDragging={draggingId === cr.id}
          />
        ))}
        {isDragOver && canDrop && (
          <div
            className="rounded border-dashed border-2 h-14 flex items-center justify-center"
            style={{ borderColor: col.color, opacity: 0.5 }}
          >
            <span className="text-[9px]" style={{ color: col.color }}>Soltar aquí</span>
          </div>
        )}
        {items.length === 0 && !isDragOver && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-[10px] text-center" style={{ color: 'var(--foreground-dim)' }}>
              Sin solicitudes
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Rejection reason modal ───────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string) => void
  onCancel:  () => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-heading font-bold" style={{ color: 'var(--foreground)' }}>
          Motivo de rechazo
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Explica el motivo del rechazo..."
          className="w-full px-3 py-2 rounded text-sm resize-none outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          style={{
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            color:      'var(--foreground)',
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: 'var(--surface-2)',
              border:     '1px solid var(--border)',
              color:      'var(--foreground-muted)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { if (reason.trim()) onConfirm(reason) }}
            disabled={!reason.trim() || isPending}
            className="px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border:     '1px solid rgba(239,68,68,0.3)',
              color:      'var(--status-red)',
            }}
          >
            {isPending ? 'Rechazando...' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Completion notes modal ───────────────────────────────────────────────────

function CompleteModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (notes: string) => void
  onCancel:  () => void
  isPending: boolean
}) {
  const [notes, setNotes] = useState('')
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-heading font-bold" style={{ color: 'var(--foreground)' }}>
          Notas de completado
        </h3>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Opcional: describe qué se hizo para completar esta solicitud.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Descripción del trabajo realizado..."
          className="w-full px-3 py-2 rounded text-sm resize-none outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          style={{
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            color:      'var(--foreground)',
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: 'var(--surface-2)',
              border:     '1px solid var(--border)',
              color:      'var(--foreground-muted)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(notes)}
            disabled={isPending}
            className="px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40"
            style={{
              background: 'rgba(5,150,105,0.15)',
              border:     '1px solid rgba(5,150,105,0.3)',
              color:      '#059669',
            }}
          >
            {isPending ? 'Completando...' : 'Marcar como completado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Kanban ──────────────────────────────────────────────────────────────

export function ChangesKanban({
  projectId,
  projectName,
  changeRequests,
  users,
  departments,
  currentUserId,
  canCreate,
  canManage,
  canEdit,
}: Props) {
  const [items, setItems]                         = useState<CRItem[]>(changeRequests)
  const [openCR, setOpenCR]                       = useState<CRItem | null>(null)
  const [showNewModal, setShowNewModal]           = useState(false)
  const [dragOver, setDragOver]                   = useState<string | null>(null)
  const [draggingId, setDraggingId]               = useState<string | null>(null)
  const [pendingReject, setPendingReject]         = useState<{ id: string } | null>(null)
  const [pendingComplete, setPendingComplete]     = useState<{ id: string } | null>(null)
  const [error, setError]                         = useState<string | null>(null)
  const [, startTransition]                       = useTransition()

  const dragRef = useRef<{ id: string; fromStatus: string } | null>(null)

  const grouped = COLUMNS.reduce<Record<string, CRItem[]>>((acc, col) => {
    acc[col.status] = items.filter((cr) => cr.status === col.status)
    return acc
  }, {})

  // ── Drag handlers ──

  function handleDragStart(e: React.DragEvent, cr: CRItem) {
    dragRef.current = { id: cr.id, fromStatus: cr.status }
    setDraggingId(cr.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOver(null)
    dragRef.current = null
  }

  function handleDragOver(e: React.DragEvent, toStatus: string) {
    e.preventDefault()
    if (!dragRef.current || !canManage) return
    const allowed = VALID_TRANSITIONS[dragRef.current.fromStatus] ?? []
    e.dataTransfer.dropEffect = allowed.includes(toStatus) ? 'move' : 'none'
    setDragOver(toStatus)
  }

  function handleDrop(e: React.DragEvent, toStatus: string) {
    e.preventDefault()
    if (!dragRef.current || !canManage) return
    const { id, fromStatus } = dragRef.current
    dragRef.current = null
    setDraggingId(null)
    setDragOver(null)

    if (fromStatus === toStatus) return
    const allowed = VALID_TRANSITIONS[fromStatus] ?? []
    if (!allowed.includes(toStatus)) return

    // Special handling for statuses that need extra info
    if (toStatus === 'REJECTED') {
      setPendingReject({ id })
      return
    }
    if (toStatus === 'COMPLETED') {
      setPendingComplete({ id })
      return
    }

    doStatusChange(id, toStatus, undefined, undefined)
  }

  function doStatusChange(
    id: string,
    newStatus: string,
    rejectionReason: string | undefined,
    completionNotes: string | undefined,
  ) {
    const prev = [...items]
    setItems((cur) => cur.map((cr) => cr.id === id ? { ...cr, status: newStatus } : cr))
    setError(null)

    startTransition(async () => {
      const res = await changeStatus({
        changeRequestId: id,
        newStatus:       newStatus as never,
        rejectionReason: rejectionReason ?? null,
        completionNotes: completionNotes ?? null,
      })
      if (!res.success) {
        setItems(prev)
        setError(res.error)
      }
    })
  }

  // Update items when modal causes changes (revalidatePath refreshes server, but we need to update local state)
  function handleModalUpdated(updatedCR: Partial<CRItem> & { id: string }) {
    setItems((cur) =>
      cur.map((cr) => cr.id === updatedCR.id ? { ...cr, ...updatedCR } : cr),
    )
    if (openCR?.id === updatedCR.id) {
      setOpenCR((prev) => prev ? { ...prev, ...updatedCR } : prev)
    }
  }

  function handleCRCreated(newCR: CRItem) {
    setItems((cur) => [newCR, ...cur])
  }

  return (
    <>
      {/* Controls bar */}
      <div className="flex items-center gap-3 mb-2">
        {error && (
          <div
            className="flex-1 px-3 py-2 rounded text-xs"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border:     '1px solid rgba(239,68,68,0.25)',
              color:      'var(--status-red)',
            }}
          >
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Cerrar
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                color:      'var(--accent-cyan)',
                background: 'var(--accent-cyan-dim)',
                border:     '1px solid rgba(6,182,212,0.2)',
              }}
            >
              <Plus size={12} />
              Nueva Solicitud
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--foreground-dim)' }}>
            <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
            <span>Arrastra las tarjetas para cambiar estado</span>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              col={col}
              items={grouped[col.status] ?? []}
              isDragOver={dragOver === col.status}
              canDrop={
                canManage &&
                !!dragRef.current &&
                (VALID_TRANSITIONS[dragRef.current.fromStatus] ?? []).includes(col.status)
              }
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, col.status)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onOpen={setOpenCR}
              draggingId={draggingId}
            />
          ))}
        </div>
      </div>

      {/* Rejection reason modal */}
      {pendingReject && (
        <RejectModal
          isPending={false}
          onCancel={() => setPendingReject(null)}
          onConfirm={(reason) => {
            const { id } = pendingReject
            setPendingReject(null)
            doStatusChange(id, 'REJECTED', reason, undefined)
          }}
        />
      )}

      {/* Completion notes modal */}
      {pendingComplete && (
        <CompleteModal
          isPending={false}
          onCancel={() => setPendingComplete(null)}
          onConfirm={(notes) => {
            const { id } = pendingComplete
            setPendingComplete(null)
            doStatusChange(id, 'COMPLETED', undefined, notes)
          }}
        />
      )}

      {/* Detail modal — existing CR */}
      {openCR && (
        <ChangeRequestModal
          mode="detail"
          projectId={projectId}
          projectName={projectName}
          cr={openCR}
          users={users}
          departments={departments}
          currentUserId={currentUserId}
          canEdit={canEdit}
          canManage={canManage}
          onClose={() => setOpenCR(null)}
          onUpdated={handleModalUpdated}
        />
      )}

      {/* Create modal */}
      {showNewModal && (
        <ChangeRequestModal
          mode="create"
          projectId={projectId}
          projectName={projectName}
          users={users}
          departments={departments}
          currentUserId={currentUserId}
          canEdit={canEdit}
          canManage={canManage}
          onClose={() => setShowNewModal(false)}
          onCreated={handleCRCreated}
        />
      )}
    </>
  )
}
