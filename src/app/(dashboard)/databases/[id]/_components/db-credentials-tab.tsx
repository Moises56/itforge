'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, Copy, Plus, Trash2, Pencil,
  Check, X, Loader2, ShieldAlert, Clock,
} from 'lucide-react'
import {
  createDatabaseCredential,
  updateDatabaseCredential,
  deleteDatabaseCredential,
  revealDatabaseCredential,
} from '@/modules/development/actions/databases'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DbCredentialItem = {
  id:          string
  label:       string
  username:    string
  accessLevel: string | null
  createdAt:   string
  lastReveal:  { at: string; by: string } | null
}

interface Props {
  databaseId:  string
  credentials: DbCredentialItem[]
  canEdit:     boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REVEAL_SECONDS = 30

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-2 rounded text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border:     '1px solid var(--border)',
  color:      'var(--foreground)',
}
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Reveal modal ─────────────────────────────────────────────────────────────

function RevealModal({
  credential,
  mode,
  onClose,
  onSuccess,
}: {
  credential: DbCredentialItem
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
      const result = await revealDatabaseCredential(credential.id, password)
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
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={15} style={{ color: 'var(--status-amber)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Re-autenticación requerida
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {mode === 'reveal' ? 'Revelar' : 'Copiar'}:{' '}
              <span style={{ color: 'var(--accent-cyan)' }}>{credential.label}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded" style={{ color: 'var(--foreground-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div
          className="rounded p-3 mb-4 text-xs"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border:     '1px solid rgba(245,158,11,0.2)',
            color:      'var(--foreground-muted)',
          }}
        >
          Esta acción queda registrada en el log de auditoría con tu usuario, IP y timestamp.
        </div>

        {error && (
          <div
            className="rounded p-3 mb-4 text-xs"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border:     '1px solid rgba(239,68,68,0.25)',
              color:      'var(--status-red)',
            }}
          >
            {error}
          </div>
        )}

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
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
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
  revealedEntry,
  secondsLeft,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
  canEdit,
}: {
  credential:    DbCredentialItem
  revealedEntry: { value: string; expiresAt: number } | undefined
  secondsLeft:   number
  onReveal:      () => void
  onCopy:        () => void
  onEdit:        () => void
  onDelete:      () => void
  canEdit:       boolean
}) {
  return (
    <div
      className="rounded overflow-hidden"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Access level badge */}
        {credential.accessLevel && (
          <span
            className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: 'rgba(6,182,212,0.1)',
              color:      'var(--accent-cyan)',
              border:     '1px solid rgba(6,182,212,0.2)',
              fontFamily: 'var(--font-jetbrains)',
            }}
          >
            {credential.accessLevel}
          </span>
        )}

        {/* Label + username */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {credential.label}
          </p>
          {credential.username !== '' && (
            <p
              className="text-xs font-mono truncate"
              style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
            >
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
                  border:     '1px solid rgba(16,185,129,0.25)',
                  color:      'var(--status-green)',
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
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all"
            style={{
              color:      'var(--accent-cyan)',
              background: 'var(--accent-cyan-dim)',
              border:     '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <Eye size={11} />
            Revelar
          </button>
          <button
            type="button"
            onClick={onCopy}
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

      {/* Last reveal */}
      {credential.lastReveal && (
        <div
          className="flex items-center justify-end px-4 pb-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>
            Última vez: {credential.lastReveal.by} · {new Date(credential.lastReveal.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Credential form ──────────────────────────────────────────────────────────

function CredentialForm({
  databaseId,
  initial,
  onSuccess,
  onCancel,
}: {
  databaseId: string
  initial?:   Partial<DbCredentialItem>
  onSuccess:  () => void
  onCancel:   () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label:       initial?.label                         ?? '',
    username:    initial?.username !== undefined ? initial.username : '',
    plainValue:  '',
    accessLevel: initial?.accessLevel                   ?? '',
  })

  const handleSubmit = () => {
    if (!form.label.trim()) { setError('La etiqueta es requerida'); return }
    if (!initial?.id && !form.plainValue.trim()) { setError('El valor es requerido'); return }
    setError(null)
    startTransition(async () => {
      let result
      if (initial?.id) {
        result = await updateDatabaseCredential({
          id:          initial.id,
          databaseId,
          label:       form.label || undefined,
          username:    form.username || undefined,
          plainValue:  form.plainValue || undefined,
          accessLevel: form.accessLevel || undefined,
        })
      } else {
        result = await createDatabaseCredential({
          databaseId,
          label:       form.label,
          username:    form.username || undefined,
          plainValue:  form.plainValue,
          accessLevel: form.accessLevel || undefined,
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
        <div
          className="p-2 rounded text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Etiqueta *</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Ej: Admin principal, Solo lectura"
            className={inputCls}
            style={inputStyle}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Usuario</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="Ej: sa, admin, readonly_user"
            className={inputCls}
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Nivel de acceso</label>
          <input
            type="text"
            value={form.accessLevel}
            onChange={(e) => setForm((f) => ({ ...f, accessLevel: e.target.value }))}
            placeholder="Ej: admin, read_only, dba"
            className={inputCls}
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
            {isEditing ? 'Nuevo valor (dejar vacío para no cambiar)' : 'Contraseña / Valor *'}
          </label>
          <input
            type="password"
            value={form.plainValue}
            onChange={(e) => setForm((f) => ({ ...f, plainValue: e.target.value }))}
            placeholder={isEditing ? 'Nuevo valor (opcional)' : 'Valor a cifrar'}
            className={inputCls}
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          {isEditing ? 'Actualizar' : 'Guardar cifrada'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DbCredentialsTab({ databaseId, credentials, canEdit }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [revealed,    setRevealed]    = useState<Record<string, { value: string; expiresAt: number }>>({})
  const [secondsLeft, setSecondsLeft] = useState<Record<string, number>>({})
  const [modal,       setModal]       = useState<{ credential: DbCredentialItem; mode: 'reveal' | 'copy' } | null>(null)
  const [copied,      setCopied]      = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)
  const [editingCred, setEditingCred] = useState<DbCredentialItem | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Auto-hide timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setRevealed((prev) => {
        const next = { ...prev }
        for (const id of Object.keys(next)) {
          if ((next[id]?.expiresAt ?? 0) <= now) delete next[id]
        }
        return next
      })
      setSecondsLeft((prev) => {
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

  const handleRevealSuccess = useCallback(
    (credId: string, value: string, mode: 'reveal' | 'copy') => {
      if (mode === 'reveal') {
        const expiresAt = Date.now() + REVEAL_SECONDS * 1000
        setRevealed((prev) => ({ ...prev, [credId]: { value, expiresAt } }))
        setSecondsLeft((prev) => ({ ...prev, [credId]: REVEAL_SECONDS }))
      } else {
        navigator.clipboard.writeText(value).catch(() => null)
        setCopied(credId)
        setTimeout(() => setCopied((c) => (c === credId ? null : c)), 2500)
      }
      setModal(null)
    },
    [],
  )

  const handleDelete = (credId: string) => {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteDatabaseCredential(credId, databaseId)
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
          border:     '1px solid rgba(6,182,212,0.15)',
          color:      'var(--foreground-muted)',
        }}
      >
        <ShieldAlert size={12} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
        Valores cifrados con AES-256-GCM. Revelar requiere re-autenticación y queda en auditoría.
      </div>

      {deleteError && (
        <div
          className="p-3 rounded text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {deleteError}
        </div>
      )}

      {credentials.length === 0 && !adding && (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            No hay credenciales guardadas para esta base de datos.
          </p>
        </div>
      )}

      {credentials.map((cred) => {
        if (editingCred?.id === cred.id) {
          return (
            <CredentialForm
              key={cred.id}
              databaseId={databaseId}
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
                <button
                  type="button"
                  onClick={() => handleDelete(cred.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--status-red)', color: '#fff' }}
                >
                  {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                >
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
              revealedEntry={revealed[cred.id]}
              secondsLeft={secondsLeft[cred.id] ?? 0}
              onReveal={() => setModal({ credential: cred, mode: 'reveal' })}
              onCopy={() => setModal({ credential: cred, mode: 'copy' })}
              onEdit={() => { setEditingCred(cred); setAdding(false) }}
              onDelete={() => setDeletingId(cred.id)}
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
              databaseId={databaseId}
              onSuccess={() => { setAdding(false); router.refresh() }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                color:      'var(--accent-cyan)',
                background: 'var(--accent-cyan-dim)',
                border:     '1px solid rgba(6,182,212,0.2)',
              }}
            >
              <Plus size={12} />
              Agregar credencial
            </button>
          )}
        </>
      )}

      {/* Modal */}
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
