'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, EyeOff, Copy, Plus, Trash2, Pencil,
  Check, X, Loader2, ShieldAlert, Clock,
} from 'lucide-react'
import {
  createCredential,
  revealCredential,
  updateCredential,
  deleteCredential,
} from '@/modules/development/actions/credentials'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CredentialItem = {
  id: string
  label: string
  type: string
  username: string | null
  notes: string | null
  createdAt: string
  lastReveal: { at: string; by: string } | null
}

interface Props {
  projectId: string
  credentials: CredentialItem[]
  environments: { id: string; type: string }[]
  canEdit: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CRED_TYPE_META: Record<string, { label: string; color: string }> = {
  DATABASE:     { label: 'Base de datos', color: '#3b82f6' },
  SSH:          { label: 'SSH',           color: '#10b981' },
  API_KEY:      { label: 'API Key',       color: '#f59e0b' },
  ADMIN_ACCESS: { label: 'Admin',         color: '#ef4444' },
  OTHER:        { label: 'Otro',          color: '#6b7280' },
}

const CRED_TYPES = [
  { value: 'DATABASE',     label: 'Base de datos' },
  { value: 'SSH',          label: 'SSH' },
  { value: 'API_KEY',      label: 'API Key' },
  { value: 'ADMIN_ACCESS', label: 'Acceso admin' },
  { value: 'OTHER',        label: 'Otro' },
]

const ENV_LABELS: Record<string, string> = {
  DEV:        'Desarrollo',
  STAGING:    'Staging',
  PRODUCTION: 'Producción',
}

const REVEAL_SECONDS = 30

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-2 rounded text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Reveal/Copy modal ────────────────────────────────────────────────────────

function RevealModal({
  credential,
  mode,
  onClose,
  onSuccess,
}: {
  credential: CredentialItem
  mode: 'reveal' | 'copy'
  onClose: () => void
  onSuccess: (value: string) => void
}) {
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!password) return
    setError(null)
    startTransition(async () => {
      const result = await revealCredential(credential.id, password)
      if (!result.success) { setError(result.error); return }
      onSuccess(result.data.value)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-lg p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={15} style={{ color: 'var(--status-amber)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Re-autenticación requerida
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {mode === 'reveal' ? 'Revelar' : 'Copiar'}: <span style={{ color: 'var(--accent-cyan)' }}>{credential.label}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div
          className="rounded p-3 mb-4 text-xs"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            color: 'var(--foreground-muted)',
          }}
        >
          Esta acción queda registrada en el log de auditoría con tu usuario, IP y timestamp.
        </div>

        {error && (
          <div
            className="rounded p-3 mb-4 text-xs"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--status-red)',
            }}
          >
            {error}
          </div>
        )}

        {/* Password field */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
            Tu contraseña *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Ingresa tu contraseña"
            autoFocus
            className={inputCls}
            style={inputStyle}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded text-xs font-medium"
            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!password || isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : mode === 'reveal' ? (
              <Eye size={12} />
            ) : (
              <Copy size={12} />
            )}
            {mode === 'reveal' ? 'Revelar valor' : 'Copiar al portapapeles'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Credential row ───────────────────────────────────────────────────────────

function CredentialRow({
  credential,
  projectId,
  revealedEntry,
  secondsLeft,
  onReveal,
  onCopy,
  onDelete,
  onEdit,
  canEdit,
}: {
  credential: CredentialItem
  projectId: string
  revealedEntry: { value: string; expiresAt: number } | undefined
  secondsLeft: number
  onReveal: () => void
  onCopy: () => void
  onDelete: () => void
  onEdit: () => void
  canEdit: boolean
}) {
  const meta = CRED_TYPE_META[credential.type] ?? CRED_TYPE_META.OTHER!

  return (
    <div
      className="rounded overflow-hidden"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type badge */}
        <span
          className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: `${meta.color}18`,
            color: meta.color,
            border: `1px solid ${meta.color}30`,
            fontFamily: 'var(--font-jetbrains)',
          }}
        >
          {meta.label}
        </span>

        {/* Label + username */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {credential.label}
          </p>
          {credential.username && (
            <p className="text-xs font-mono truncate" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
              {credential.username}
            </p>
          )}
        </div>

        {/* Value display */}
        <div className="flex items-center gap-1.5">
          {revealedEntry ? (
            <div className="flex items-center gap-2">
              <code
                className="text-xs font-mono px-2 py-1 rounded max-w-[180px] overflow-hidden text-ellipsis"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: 'var(--status-green)',
                  fontFamily: 'var(--font-jetbrains)',
                  userSelect: 'all',
                }}
              >
                {revealedEntry.value}
              </code>
              <span
                className="flex items-center gap-1 text-[10px] font-mono tabular-nums"
                style={{ color: 'var(--status-amber)', fontFamily: 'var(--font-jetbrains)' }}
              >
                <Clock size={10} />
                {secondsLeft}s
              </span>
            </div>
          ) : (
            <span
              className="text-xs font-mono tracking-[0.3em]"
              style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
            >
              ••••••••
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onReveal}
            title="Revelar valor"
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all"
            style={{
              color: 'var(--accent-cyan)',
              background: 'var(--accent-cyan-dim)',
              border: '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <Eye size={11} />
            Revelar
          </button>
          <button
            type="button"
            onClick={onCopy}
            title="Copiar al portapapeles (sin mostrar)"
            className="p-1.5 rounded transition-all"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground-muted)' }}
          >
            <Copy size={13} />
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onEdit}
                title="Editar"
                className="p-1.5 rounded transition-all"
                style={{ color: 'var(--foreground-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground-muted)' }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Eliminar"
                className="p-1.5 rounded transition-all"
                style={{ color: 'var(--status-red)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notes + last reveal */}
      {(credential.notes || credential.lastReveal) && (
        <div
          className="flex items-center justify-between px-4 pb-2 gap-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {credential.notes && (
            <p className="text-xs italic" style={{ color: 'var(--foreground-dim)' }}>
              {credential.notes}
            </p>
          )}
          {credential.lastReveal && (
            <p className="text-[10px] ml-auto shrink-0" style={{ color: 'var(--foreground-dim)' }}>
              Última vez: {credential.lastReveal.by} · {new Date(credential.lastReveal.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

function CredentialForm({
  projectId,
  environments,
  initial,
  onSuccess,
  onCancel,
}: {
  projectId: string
  environments: { id: string; type: string }[]
  initial?: Partial<CredentialItem & { id: string }>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label:         initial?.label         ?? '',
    type:          initial?.type          ?? 'OTHER',
    username:      initial?.username      ?? '',
    plainValue:    '',
    notes:         initial?.notes         ?? '',
    environmentId: '',
  })

  const handleSubmit = () => {
    if (!form.label.trim()) { setError('La etiqueta es requerida'); return }
    if (!initial && !form.plainValue.trim()) { setError('El valor es requerido'); return }
    setError(null)
    startTransition(async () => {
      let result
      if (initial?.id) {
        result = await updateCredential({
          id: initial.id,
          projectId,
          label:      form.label || undefined,
          type:       form.type as 'DATABASE' | 'SSH' | 'API_KEY' | 'ADMIN_ACCESS' | 'OTHER',
          username:   form.username || undefined,
          plainValue: form.plainValue || undefined,
          notes:      form.notes || undefined,
        })
      } else {
        result = await createCredential({
          projectId,
          label:         form.label,
          type:          form.type as 'DATABASE' | 'SSH' | 'API_KEY' | 'ADMIN_ACCESS' | 'OTHER',
          username:      form.username || undefined,
          plainValue:    form.plainValue,
          notes:         form.notes || undefined,
          environmentId: form.environmentId || undefined,
        })
      }
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  const isEditing = !!initial?.id

  return (
    <div
      className="rounded p-4 space-y-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
        {isEditing ? 'Editar credencial' : 'Nueva credencial'}
      </p>

      {error && (
        <div className="p-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Etiqueta *</label>
          <input type="text" value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ej: DB Producción" className={inputCls} style={inputStyle} autoFocus />
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Tipo *</label>
          <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {CRED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Usuario / Cuenta</label>
          <input type="text" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Ej: admin, sa, root" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        {!isEditing && environments.length > 0 && (
          <div>
            <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Ambiente (opcional)</label>
            <select value={form.environmentId} onChange={(e) => setForm(f => ({ ...f, environmentId: e.target.value }))} className={`${inputCls} cursor-pointer`} style={inputStyle}>
              <option value="">Sin ambiente específico</option>
              {environments.map(e => <option key={e.id} value={e.id}>{ENV_LABELS[e.type] ?? e.type}</option>)}
            </select>
          </div>
        )}
        <div className={isEditing ? 'md:col-span-2' : ''}>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
            {isEditing ? 'Nuevo valor (dejar vacío para no cambiar)' : 'Valor / Contraseña *'}
          </label>
          <input
            type="password"
            value={form.plainValue}
            onChange={(e) => setForm(f => ({ ...f, plainValue: e.target.value }))}
            placeholder={isEditing ? 'Nuevo valor (opcional)' : 'Valor a cifrar'}
            className={inputCls}
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Notas</label>
          <input type="text" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Información adicional..." className={inputCls} style={inputStyle} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSubmit} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {isEditing ? 'Actualizar' : 'Guardar cifrada'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded text-xs font-medium" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CredentialsTab({ projectId, credentials, environments, canEdit }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Revealed values: credentialId → { value, expiresAt }
  const [revealed, setRevealed] = useState<Record<string, { value: string; expiresAt: number }>>({})
  // Countdown seconds per revealed credential
  const [secondsLeft, setSecondsLeft] = useState<Record<string, number>>({})
  // Modal state
  const [modal, setModal] = useState<{ credential: CredentialItem; mode: 'reveal' | 'copy' } | null>(null)
  // Copy confirmation
  const [copied, setCopied] = useState<string | null>(null)
  // Add/edit form
  const [adding, setAdding] = useState(false)
  const [editingCred, setEditingCred] = useState<CredentialItem | null>(null)
  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Auto-hide timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setRevealed(prev => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if ((next[id]?.expiresAt ?? 0) <= now) delete next[id]
        }
        return next
      })
      setSecondsLeft(prev => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if (revealed[id] && (revealed[id]?.expiresAt ?? 0) > now) {
            next[id] = Math.ceil(((revealed[id]?.expiresAt ?? 0) - now) / 1000)
          } else {
            delete next[id]
          }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [revealed])

  const handleRevealSuccess = useCallback((credId: string, value: string, mode: 'reveal' | 'copy') => {
    if (mode === 'reveal') {
      const expiresAt = Date.now() + REVEAL_SECONDS * 1000
      setRevealed(prev => ({ ...prev, [credId]: { value, expiresAt } }))
      setSecondsLeft(prev => ({ ...prev, [credId]: REVEAL_SECONDS }))
    } else {
      // Copy to clipboard without showing
      navigator.clipboard.writeText(value).catch(() => null)
      setCopied(credId)
      setTimeout(() => setCopied(c => c === credId ? null : c), 2500)
    }
    setModal(null)
  }, [])

  const handleDelete = (credId: string) => {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteCredential(credId, projectId)
      if (!result.success) { setDeleteError(result.error); return }
      setDeletingId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {/* Vault notice */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded text-xs"
        style={{
          background: 'rgba(6,182,212,0.06)',
          border: '1px solid rgba(6,182,212,0.15)',
          color: 'var(--foreground-muted)',
        }}
      >
        <ShieldAlert size={12} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
        Valores cifrados con AES-256-GCM. Revelar requiere re-autenticación y queda en auditoría.
      </div>

      {deleteError && (
        <div className="p-3 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          {deleteError}
        </div>
      )}

      {credentials.length === 0 && !adding && (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            No hay credenciales guardadas para este proyecto.
          </p>
        </div>
      )}

      {/* Credential rows */}
      {credentials.map((cred) => {
        if (editingCred?.id === cred.id) {
          return (
            <CredentialForm
              key={cred.id}
              projectId={projectId}
              environments={environments}
              initial={editingCred}
              onSuccess={() => { setEditingCred(null); router.refresh() }}
              onCancel={() => setEditingCred(null)}
            />
          )
        }

        if (deletingId === cred.id) {
          return (
            <div
              key={cred.id}
              className="rounded p-4 flex items-center justify-between gap-4"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                ¿Eliminar <span style={{ color: 'var(--foreground)' }}>{cred.label}</span>?
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDelete(cred.id)} disabled={isPending} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50" style={{ background: 'var(--status-red)', color: '#fff' }}>
                  {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Eliminar
                </button>
                <button type="button" onClick={() => setDeletingId(null)} className="px-3 py-1.5 rounded text-xs font-medium" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )
        }

        return (
          <div key={cred.id} className="relative">
            {copied === cred.id && (
              <div
                className="absolute top-0 right-0 m-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] z-10"
                style={{ background: 'rgba(16,185,129,0.9)', color: '#fff' }}
              >
                <Check size={10} />
                Copiado
              </div>
            )}
            <CredentialRow
              credential={cred}
              projectId={projectId}
              revealedEntry={revealed[cred.id]}
              secondsLeft={secondsLeft[cred.id] ?? 0}
              onReveal={() => setModal({ credential: cred, mode: 'reveal' })}
              onCopy={() => setModal({ credential: cred, mode: 'copy' })}
              onDelete={() => setDeletingId(cred.id)}
              onEdit={() => { setEditingCred(cred); setAdding(false) }}
              canEdit={canEdit}
            />
          </div>
        )
      })}

      {/* Add form */}
      {canEdit && !editingCred && (
        <>
          {adding ? (
            <CredentialForm
              projectId={projectId}
              environments={environments}
              onSuccess={() => { setAdding(false); router.refresh() }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
            >
              <Plus size={12} />
              Agregar credencial
            </button>
          )}
        </>
      )}

      {/* Reveal / Copy modal */}
      {modal && (
        <RevealModal
          credential={modal.credential}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSuccess={(value) => handleRevealSuccess(modal.credential.id, value, modal.mode)}
        />
      )}
    </div>
  )
}
