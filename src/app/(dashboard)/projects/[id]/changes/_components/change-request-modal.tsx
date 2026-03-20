'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import {
  X, Send, Paperclip, Download, Trash2, Loader2,
  Clock, CheckCircle2, XCircle, AlertTriangle, Flame,
  ArrowDown, Minus, User, Building2, Tag, Calendar,
  ChevronRight, MessageSquare, FileText, GitPullRequest,
  Plus,
} from 'lucide-react'
import {
  createChangeRequest,
  updateChangeRequest,
  changeStatus,
  addComment,
  deleteComment,
  addAttachment,
  deleteAttachment,
  getAttachmentDownloadUrl,
  getChangeRequestDetail,
  type CRDetail,
} from '@/modules/development/actions/change-requests'
import type { CRItem } from './changes-kanban'

// ─── Types ────────────────────────────────────────────────────────────────────

type User       = { id: string; firstName: string; lastName: string }
type Department = { id: string; name: string; code: string }

type ModeCreate = {
  mode:        'create'
  projectId:   string
  projectName: string
  cr?:         never
  onCreated:   (cr: CRItem) => void
  onUpdated?:  never
}

type ModeDetail = {
  mode:        'detail'
  projectId:   string
  projectName: string
  cr:          CRItem
  onCreated?:  never
  onUpdated:   (cr: Partial<CRItem> & { id: string }) => void
}

type Props = (ModeCreate | ModeDetail) & {
  users:         User[]
  departments:   Department[]
  currentUserId: string
  canEdit:       boolean
  canManage:     boolean
  onClose:       () => void
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED:    { label: 'Solicitado',  color: '#64748b' },
  UNDER_REVIEW: { label: 'En Revisión', color: '#3b82f6' },
  APPROVED:     { label: 'Aprobado',    color: '#10b981' },
  REJECTED:     { label: 'Rechazado',   color: '#ef4444' },
  IN_PROGRESS:  { label: 'En Progreso', color: '#f59e0b' },
  COMPLETED:    { label: 'Completado',  color: '#059669' },
  CANCELLED:    { label: 'Cancelado',   color: '#475569' },
}

const TYPE_OPTIONS = [
  { value: 'NEW_FEATURE',     label: 'Nueva Función' },
  { value: 'MODIFICATION',    label: 'Modificación' },
  { value: 'BUG_FIX',        label: 'Corrección de error' },
  { value: 'DATA_CORRECTION', label: 'Corrección de datos' },
  { value: 'REPORT',          label: 'Reporte' },
  { value: 'VISUAL_CHANGE',   label: 'Cambio visual' },
  { value: 'OTHER',           label: 'Otro' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'LOW',      label: 'Baja',     color: '#64748b' },
  { value: 'MEDIUM',   label: 'Media',    color: '#3b82f6' },
  { value: 'HIGH',     label: 'Alta',     color: '#f59e0b' },
  { value: 'CRITICAL', label: 'Crítica',  color: '#ef4444' },
] as const

const ACTION_BUTTONS: Record<string, Array<{ toStatus: string; label: string; style: 'primary' | 'danger' | 'muted' }>> = {
  REQUESTED:    [{ toStatus: 'UNDER_REVIEW', label: 'Iniciar revisión', style: 'primary' }, { toStatus: 'CANCELLED', label: 'Cancelar', style: 'danger' }],
  UNDER_REVIEW: [{ toStatus: 'APPROVED', label: 'Aprobar', style: 'primary' }, { toStatus: 'REJECTED', label: 'Rechazar', style: 'danger' }, { toStatus: 'REQUESTED', label: 'Devolver', style: 'muted' }],
  APPROVED:     [{ toStatus: 'IN_PROGRESS', label: 'Iniciar trabajo', style: 'primary' }, { toStatus: 'CANCELLED', label: 'Cancelar', style: 'danger' }],
  REJECTED:     [{ toStatus: 'REQUESTED', label: 'Reabrir', style: 'muted' }],
  IN_PROGRESS:  [{ toStatus: 'COMPLETED', label: 'Completar', style: 'primary' }, { toStatus: 'CANCELLED', label: 'Cancelar', style: 'danger' }],
  COMPLETED:    [],
  CANCELLED:    [{ toStatus: 'REQUESTED', label: 'Reabrir', style: 'muted' }],
}

// ─── Style helpers ─────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputSty: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelSty: React.CSSProperties = { color: 'var(--foreground-muted)' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  < 2)  return 'ahora'
  if (mins  < 60) return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  if (days  < 7)  return `hace ${days}d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function fileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

// ─── Status button ────────────────────────────────────────────────────────────

function ActionBtn({
  label,
  style: s,
  onClick,
  disabled,
}: {
  label:    string
  style:    'primary' | 'danger' | 'muted'
  onClick:  () => void
  disabled: boolean
}) {
  const styles = {
    primary: { background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--accent-cyan)' },
    danger:  { background: 'rgba(239,68,68,0.08)',   border: '1px solid rgba(239,68,68,0.2)', color: 'var(--status-red)' },
    muted:   { background: 'var(--surface-2)',        border: '1px solid var(--border)',       color: 'var(--foreground-muted)' },
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-40"
      style={styles[s]}
    >
      {label}
    </button>
  )
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

function TimelineEntry({ entry }: { entry: CRDetail['timeline'][number] }) {
  const meta = entry.metadata as Record<string, unknown>
  const from = meta.fromStatus as string | undefined
  const to   = meta.toStatus   as string | undefined

  let text = ''
  if (entry.action === 'create') {
    text = 'Solicitud creada'
  } else if (entry.action === 'change_status' && from && to) {
    text = `${STATUS_CONFIG[from]?.label ?? from} → ${STATUS_CONFIG[to]?.label ?? to}`
  } else {
    text = entry.action
  }

  const color = to ? (STATUS_CONFIG[to]?.color ?? '#64748b') : '#64748b'

  return (
    <div className="flex items-start gap-2">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}22`, border: `1px solid ${color}55` }}
      >
        {entry.action === 'create' ? (
          <Plus size={8} style={{ color }} />
        ) : (
          <ChevronRight size={8} style={{ color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--foreground)' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>{entry.actorName}</span>
          {' — '}
          {text}
        </p>
        {typeof meta.rejectionReason === 'string' && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            Motivo: {meta.rejectionReason}
          </p>
        )}
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--foreground-dim)' }}>
          {formatDate(entry.createdAt)}
        </p>
      </div>
    </div>
  )
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({
  projectId,
  users,
  departments,
  onCreated,
  onClose,
}: {
  projectId:   string
  users:       User[]
  departments: Department[]
  onCreated:   (cr: CRItem) => void
  onClose:     () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [form, setForm] = useState({
    title:                 '',
    description:           '',
    requesterName:         '',
    requesterDepartmentId: '',
    type:                  'MODIFICATION' as string,
    priority:              'MEDIUM' as string,
    assignedToId:          '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.requesterName.trim()) {
      setError('Título y nombre del solicitante son requeridos')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createChangeRequest({
        projectId,
        title:                 form.title.trim(),
        description:           form.description.trim() || null,
        requesterName:         form.requesterName.trim(),
        requesterDepartmentId: form.requesterDepartmentId || null,
        type:                  form.type as never,
        priority:              form.priority as never,
        assignedToId:          form.assignedToId || null,
      })
      if (!res.success) { setError(res.error); return }
      onCreated({
        id:                  res.data.id,
        title:               form.title.trim(),
        status:              'REQUESTED',
        priority:            form.priority,
        type:                form.type,
        requesterName:       form.requesterName.trim(),
        requesterDepartment: departments.find((d) => d.id === form.requesterDepartmentId) ?? null,
        assignedTo:          users.find((u) => u.id === form.assignedToId) ?? null,
        commentCount:        0,
        attachmentCount:     0,
        createdAt:           new Date().toISOString(),
        updatedAt:           new Date().toISOString(),
      })
      onClose()
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="px-3 py-2 rounded text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
            Título *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Descripción breve de la solicitud"
            className={inputCls}
            style={inputSty}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
              Tipo
            </label>
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls} style={inputSty}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
              Prioridad
            </label>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCls} style={inputSty}>
              {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
            Descripción
          </label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Detalle de la solicitud..."
            className={`${inputCls} resize-none`}
            style={inputSty}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
              Solicitante *
            </label>
            <input
              type="text"
              value={form.requesterName}
              onChange={(e) => set('requesterName', e.target.value)}
              placeholder="Nombre del solicitante"
              className={inputCls}
              style={inputSty}
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
              Departamento
            </label>
            <select value={form.requesterDepartmentId} onChange={(e) => set('requesterDepartmentId', e.target.value)} className={inputCls} style={inputSty}>
              <option value="">Sin departamento</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={labelSty}>
            Asignar a
          </label>
          <select value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)} className={inputCls} style={inputSty}>
            <option value="">Sin asignar</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded text-xs font-medium" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--accent-cyan)' }}
        >
          {isPending && <Loader2 size={12} className="animate-spin" />}
          Crear solicitud
        </button>
      </div>
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({
  cr,
  projectId,
  users,
  departments,
  currentUserId,
  canEdit,
  canManage,
  onUpdated,
  onClose,
}: {
  cr:            CRItem
  projectId:     string
  users:         User[]
  departments:   Department[]
  currentUserId: string
  canEdit:       boolean
  canManage:     boolean
  onUpdated:     (cr: Partial<CRItem> & { id: string }) => void
  onClose:       () => void
}) {
  const [detail, setDetail]     = useState<CRDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const [comment, setComment]        = useState('')
  const [commentErr, setCommentErr]  = useState<string | null>(null)
  const [, startTransition]          = useTransition()

  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [rejectReason, setRejectReason]   = useState('')
  const [completeNotes, setCompleteNotes] = useState('')
  const [actionErr, setActionErr]         = useState<string | null>(null)
  const [isActing, setIsActing]           = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [activeTab, setActiveTab] = useState<'comments' | 'attachments' | 'timeline'>('comments')

  // Load detail on mount
  useEffect(() => {
    setLoading(true)
    getChangeRequestDetail(cr.id).then((res) => {
      if (res.success) setDetail(res.data)
      else setFetchErr(res.error)
      setLoading(false)
    })
  }, [cr.id])

  async function handleStatusAction(toStatus: string) {
    if (toStatus === 'REJECTED' || toStatus === 'COMPLETED') {
      setPendingStatus(toStatus)
      return
    }
    await doStatusChange(toStatus, undefined, undefined)
  }

  async function doStatusChange(toStatus: string, rejectionReason?: string, completionNotes?: string) {
    setIsActing(true)
    setActionErr(null)
    const res = await changeStatus({
      changeRequestId: cr.id,
      newStatus:       toStatus as never,
      rejectionReason: rejectionReason ?? null,
      completionNotes: completionNotes ?? null,
    })
    setIsActing(false)
    if (!res.success) { setActionErr(res.error); return }

    onUpdated({ id: cr.id, status: toStatus })
    // Reload detail
    const fresh = await getChangeRequestDetail(cr.id)
    if (fresh.success) setDetail(fresh.data)
    setPendingStatus(null)
  }

  async function handleAddComment() {
    if (!comment.trim()) return
    setCommentErr(null)
    const saved = comment
    setComment('')
    startTransition(async () => {
      const res = await addComment(cr.id, saved)
      if (!res.success) { setCommentErr(res.error); setComment(saved); return }
      setDetail((d) => d ? { ...d, comments: [...d.comments, { ...res.data, updatedAt: res.data.createdAt }] } : d)
    })
  }

  async function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      const res = await deleteComment(commentId)
      if (res.success) {
        setDetail((d) => d ? { ...d, comments: d.comments.filter((c) => c.id !== commentId) } : d)
      }
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('changeRequestId', cr.id)
    const res = await addAttachment(fd)
    setIsUploading(false)
    if (res.success) {
      setDetail((d) => d ? { ...d, attachments: [...d.attachments, { ...res.data, uploaderName: null }] } : d)
      onUpdated({ id: cr.id, attachmentCount: (cr.attachmentCount ?? 0) + 1 })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDeleteAttachment(attachmentId: string) {
    startTransition(async () => {
      const res = await deleteAttachment(attachmentId)
      if (res.success) {
        setDetail((d) => d ? { ...d, attachments: d.attachments.filter((a) => a.id !== attachmentId) } : d)
      }
    })
  }

  async function handleDownload(attachmentId: string) {
    const res = await getAttachmentDownloadUrl(attachmentId)
    if (res.success) window.open(res.data.url, '_blank')
  }

  const statusCfg   = STATUS_CONFIG[cr.status]
  const actions     = canManage ? (ACTION_BUTTONS[cr.status] ?? []) : []
  const priorityCfg = PRIORITY_OPTIONS.find((p) => p.value === cr.priority)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
      </div>
    )
  }

  if (fetchErr || !detail) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--status-red)' }}>
        {fetchErr ?? 'Error al cargar la solicitud'}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status actions */}
      {actions.length > 0 && (
        <div
          className="flex items-center gap-2 px-6 py-3 flex-wrap"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--foreground-dim)' }}>
            Acciones:
          </span>
          {actions.map((action) => (
            <ActionBtn
              key={action.toStatus}
              label={action.label}
              style={action.style}
              disabled={isActing}
              onClick={() => handleStatusAction(action.toStatus)}
            />
          ))}
          {isActing && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />}
          {actionErr && (
            <span className="text-xs" style={{ color: 'var(--status-red)' }}>{actionErr}</span>
          )}
        </div>
      )}

      {/* Inline confirm for rejection */}
      {pendingStatus === 'REJECTED' && (
        <div
          className="px-6 py-4 space-y-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(239,68,68,0.05)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--status-red)' }}>Motivo de rechazo (requerido):</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded text-xs resize-none outline-none"
            style={inputSty}
            placeholder="Explica el motivo..."
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPendingStatus(null)} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>Cancelar</button>
            <button type="button" disabled={!rejectReason.trim() || isActing} onClick={() => doStatusChange('REJECTED', rejectReason, undefined)} className="px-3 py-1.5 rounded text-xs disabled:opacity-40" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-red)' }}>Confirmar rechazo</button>
          </div>
        </div>
      )}

      {/* Inline confirm for completion */}
      {pendingStatus === 'COMPLETED' && (
        <div
          className="px-6 py-4 space-y-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(5,150,105,0.05)' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#059669' }}>Notas de completado (opcional):</p>
          <textarea
            value={completeNotes}
            onChange={(e) => setCompleteNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded text-xs resize-none outline-none"
            style={inputSty}
            placeholder="Describe el trabajo realizado..."
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPendingStatus(null)} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>Cancelar</button>
            <button type="button" disabled={isActing} onClick={() => doStatusChange('COMPLETED', undefined, completeNotes)} className="px-3 py-1.5 rounded text-xs disabled:opacity-40" style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', color: '#059669' }}>Marcar completado</button>
          </div>
        </div>
      )}

      {/* Body: 2-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Metadata */}
        <div
          className="w-72 shrink-0 overflow-y-auto p-5 space-y-5"
          style={{ borderRight: '1px solid var(--border)' }}
        >
          {/* Description */}
          {detail.description && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Descripción</p>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{detail.description}</p>
            </div>
          )}

          {/* Fields grid */}
          <div className="space-y-3">
            {/* Type */}
            <div className="flex items-center gap-2">
              <Tag size={12} style={{ color: 'var(--foreground-dim)', flexShrink: 0 }} />
              <div>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Tipo</p>
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                  {TYPE_OPTIONS.find((t) => t.value === detail.type)?.label ?? detail.type}
                </p>
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <Flame size={12} style={{ color: priorityCfg?.color ?? '#64748b' }} />
              <div>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Prioridad</p>
                <p className="text-xs font-semibold" style={{ color: priorityCfg?.color ?? '#64748b' }}>
                  {priorityCfg?.label ?? detail.priority}
                </p>
              </div>
            </div>

            {/* Requester */}
            <div className="flex items-start gap-2">
              <User size={12} style={{ color: 'var(--foreground-dim)', marginTop: 2 }} />
              <div>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Solicitante</p>
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>{detail.requesterName}</p>
                {detail.requesterDepartment && (
                  <p className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{detail.requesterDepartment.name}</p>
                )}
              </div>
            </div>

            {/* Assignee */}
            {detail.assignedTo && (
              <div className="flex items-center gap-2">
                <User size={12} style={{ color: 'var(--accent-cyan)' }} />
                <div>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Asignado a</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                    {detail.assignedTo.firstName} {detail.assignedTo.lastName}
                  </p>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center gap-2">
              <Calendar size={12} style={{ color: 'var(--foreground-dim)' }} />
              <div>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Creado</p>
                <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                  {new Date(detail.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Started */}
            {detail.startedAt && (
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: '#f59e0b' }} />
                <div>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Iniciado</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                    {new Date(detail.startedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            {/* Completed */}
            {detail.completedAt && (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} style={{ color: '#059669' }} />
                <div>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Completado</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                    {new Date(detail.completedAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rejection reason */}
          {detail.rejectionReason && (
            <div
              className="rounded p-3"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--status-red)' }}>
                <XCircle size={9} className="inline mr-1" />
                Motivo de rechazo
              </p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{detail.rejectionReason}</p>
            </div>
          )}

          {/* Completion notes */}
          {detail.completionNotes && (
            <div
              className="rounded p-3"
              style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)' }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#059669' }}>
                <CheckCircle2 size={9} className="inline mr-1" />
                Notas de completado
              </p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{detail.completionNotes}</p>
            </div>
          )}

          {/* Edit assignee if can edit */}
          {canEdit && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Cambiar responsable</p>
              <select
                defaultValue={detail.assignedTo?.id ?? ''}
                onChange={async (e) => {
                  await updateChangeRequest({
                    id:          cr.id,
                    projectId,
                    assignedToId: e.target.value || null,
                  })
                  const usr = users.find((u) => u.id === e.target.value)
                  onUpdated({
                    id:         cr.id,
                    assignedTo: usr ? { id: usr.id, firstName: usr.firstName, lastName: usr.lastName } : null,
                  })
                }}
                className="w-full px-2.5 py-2 rounded text-xs outline-none"
                style={inputSty}
              >
                <option value="">Sin asignar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Right: Comments / Attachments / Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div
            className="flex"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            {([
              { key: 'comments',    label: 'Comentarios',   icon: <MessageSquare size={11} />, count: detail.comments.length },
              { key: 'attachments', label: 'Adjuntos',      icon: <Paperclip     size={11} />, count: detail.attachments.length },
              { key: 'timeline',    label: 'Historial',     icon: <Clock         size={11} />, count: detail.timeline.length },
            ] as const).map(({ key, label, icon, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all"
                style={{
                  color:        activeTab === key ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                  borderBottom: activeTab === key ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  background:   activeTab === key ? 'var(--accent-glow)' : 'transparent',
                }}
              >
                {icon}
                {label}
                {count > 0 && (
                  <span
                    className="font-mono text-[9px] px-1 rounded"
                    style={{
                      background: activeTab === key ? 'rgba(6,182,212,0.2)' : 'var(--surface-2)',
                      color:      activeTab === key ? 'var(--accent-cyan)' : 'var(--foreground-dim)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {detail.comments.length === 0 && (
                  <div className="py-8 text-center">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin comentarios aún</p>
                  </div>
                )}
                {detail.comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div
                      className="w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                    >
                      {c.authorName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{c.authorName}</span>
                        <span className="text-[9px]" style={{ color: 'var(--foreground-dim)' }}>{formatRelative(c.createdAt)}</span>
                        {c.authorId === currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="ml-auto opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} style={{ color: 'var(--status-red)' }} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="p-3 flex gap-2"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                {commentErr && <p className="text-[10px] text-red-400 mb-1">{commentErr}</p>}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                  placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
                  rows={2}
                  className="flex-1 px-3 py-2 rounded text-xs resize-none outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                  style={inputSty}
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  className="px-3 py-2 rounded transition-all disabled:opacity-40 self-end"
                  style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--accent-cyan)' }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Attachments tab */}
          {activeTab === 'attachments' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {canEdit && (
                <div>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-all disabled:opacity-40 w-full justify-center"
                    style={{
                      background:   'var(--surface-2)',
                      border:       '1px dashed var(--border-bright)',
                      color:        'var(--foreground-muted)',
                    }}
                  >
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    {isUploading ? 'Subiendo...' : 'Adjuntar archivo'}
                  </button>
                </div>
              )}

              {detail.attachments.length === 0 && (
                <div className="py-8 text-center">
                  <Paperclip size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin adjuntos</p>
                </div>
              )}

              {detail.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2 rounded"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <FileText size={14} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{a.fileName}</p>
                    <p className="text-[9px]" style={{ color: 'var(--foreground-dim)' }}>
                      {fileSize(a.fileSize)} · {a.uploaderName ?? 'Desconocido'} · {formatRelative(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => handleDownload(a.id)} className="p-1.5 rounded transition-all" style={{ color: 'var(--foreground-muted)' }}>
                      <Download size={12} />
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => handleDeleteAttachment(a.id)} className="p-1.5 rounded transition-all" style={{ color: 'var(--status-red)' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === 'timeline' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detail.timeline.length === 0 && (
                <div className="py-8 text-center">
                  <Clock size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin historial</p>
                </div>
              )}
              {detail.timeline.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

export function ChangeRequestModal(props: Props) {
  const { mode, projectId, projectName, cr, users, departments, currentUserId, canEdit, canManage, onClose } = props

  const status     = cr?.status ?? 'REQUESTED'
  const statusCfg  = STATUS_CONFIG[status]
  const prioConfig = PRIORITY_OPTIONS.find((p) => p.value === (cr?.priority ?? 'MEDIUM'))

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded flex flex-col overflow-hidden"
        style={{
          maxWidth:   900,
          height:     '88vh',
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          boxShadow:  '0 25px 50px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-4 px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <GitPullRequest size={14} style={{ color: 'var(--accent-cyan)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{projectName}</span>
              {mode === 'detail' && statusCfg && (
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}
                >
                  {statusCfg.label}
                </span>
              )}
              {mode === 'detail' && prioConfig && (
                <span className="text-[9px] font-semibold" style={{ color: prioConfig.color }}>
                  {prioConfig.label}
                </span>
              )}
            </div>
            <h2
              className="text-base font-heading font-bold truncate"
              style={{ color: 'var(--foreground)' }}
            >
              {mode === 'create' ? 'Nueva Solicitud de Cambio' : cr.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded transition-all shrink-0"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {mode === 'create' ? (
            <div className="p-6 overflow-y-auto h-full">
              <CreateForm
                projectId={projectId}
                users={users}
                departments={departments}
                onCreated={props.onCreated!}
                onClose={onClose}
              />
            </div>
          ) : (
            <DetailView
              cr={cr!}
              projectId={projectId}
              users={users}
              departments={departments}
              currentUserId={currentUserId}
              canEdit={canEdit}
              canManage={canManage}
              onUpdated={props.onUpdated!}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
