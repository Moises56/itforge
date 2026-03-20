'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Info, Key, FolderKanban, FileText,
  Pencil, Check, X, Loader2, Trash2,
  ExternalLink,
} from 'lucide-react'
import { updateDatabase, deleteDatabase } from '@/modules/development/actions/databases'
import { DbCredentialsTab, type DbCredentialItem } from './db-credentials-tab'

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

const ENGINE_OPTIONS = ['POSTGRESQL','MYSQL','SQL_SERVER','MONGODB','SQLITE','OTHER'] as const
const MANAGED_BY_OPTIONS = ['DBA_TEAM','DEV_TEAM','EXTERNAL'] as const

type TabKey = 'general' | 'credentials' | 'projects' | 'notes'

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkedProject = { id: string; name: string; code: string } | null

export type DatabaseDetailData = {
  id:           string
  name:         string
  engine:       string
  version:      string | null
  serverIp:     string | null
  port:         number | null
  databaseName: string | null
  managedBy:    string
  notes:        string | null
  createdAt:    string
  updatedAt:    string
  project:      LinkedProject
  credentials: DbCredentialItem[]
}

type AvailableProject = { id: string; name: string; code: string }

interface Props {
  db:               DatabaseDetailData
  availableProjects: AvailableProject[]
  canEdit:          boolean
  canManageCreds:   boolean
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border:     '1px solid var(--border)',
  color:      'var(--foreground)',
}
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

function FieldRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-36 shrink-0 pt-0.5" style={labelStyle}>{label}</span>
      <span
        className={`text-sm flex-1 ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--foreground)', fontFamily: mono ? 'var(--font-jetbrains)' : undefined }}
      >
        {value ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
      </span>
    </div>
  )
}

// ─── General tab ─────────────────────────────────────────────────────────────

function GeneralTab({
  db,
  availableProjects,
  canEdit,
}: {
  db:                DatabaseDetailData
  availableProjects: AvailableProject[]
  canEdit:           boolean
}) {
  const router = useRouter()
  const [editing, setEditing]     = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]         = useState<string | null>(null)
  const [form, setForm]           = useState({
    name:         db.name,
    engine:       db.engine,
    version:      db.version    ?? '',
    serverIp:     db.serverIp   ?? '',
    port:         db.port       ? String(db.port) : '',
    databaseName: db.databaseName ?? '',
    managedBy:    db.managedBy,
    projectId:    db.project?.id ?? '',
  })

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateDatabase({
        id:           db.id,
        name:         form.name.trim(),
        engine:       form.engine as typeof ENGINE_OPTIONS[number],
        version:      form.version.trim() || undefined,
        serverIp:     form.serverIp.trim() || undefined,
        port:         form.port ? Number(form.port) : null,
        databaseName: form.databaseName.trim() || undefined,
        managedBy:    form.managedBy as typeof MANAGED_BY_OPTIONS[number],
        projectId:    form.projectId || null,
      })
      if (!result.success) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  const handleCancel = () => {
    setEditing(false)
    setError(null)
    setForm({
      name:         db.name,
      engine:       db.engine,
      version:      db.version    ?? '',
      serverIp:     db.serverIp   ?? '',
      port:         db.port       ? String(db.port) : '',
      databaseName: db.databaseName ?? '',
      managedBy:    db.managedBy,
      projectId:    db.project?.id ?? '',
    })
  }

  const engColor = ENGINE_COLORS[db.engine] ?? '#6b7280'

  if (!editing) {
    return (
      <div className="space-y-4">
        {/* Header with engine badge + managed by */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-mono font-bold px-2.5 py-1 rounded"
              style={{
                background: `${engColor}18`,
                color:      engColor,
                border:     `1px solid ${engColor}30`,
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              {ENGINE_LABELS[db.engine] ?? db.engine}
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
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{
                color:      'var(--foreground-muted)',
                border:     '1px solid var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <Pencil size={11} />
              Editar
            </button>
          )}
        </div>

        <div>
          <FieldRow label="Servidor"       value={db.serverIp && `${db.serverIp}${db.port ? `:${db.port}` : ''}`} mono />
          <FieldRow label="Base de datos"  value={db.databaseName} mono />
          <FieldRow label="Versión"        value={db.version} mono />
          <FieldRow label="Proyecto"       value={
            db.project ? (
              <a
                href={`/projects/${db.project.id}`}
                className="flex items-center gap-1 transition-colors"
                style={{ color: 'var(--accent-cyan)' }}
              >
                <span style={{ fontFamily: 'var(--font-jetbrains)' }}>{db.project.code}</span>
                <span>— {db.project.name}</span>
                <ExternalLink size={10} />
              </a>
            ) : null
          } />
          <FieldRow label="Registrado"    value={new Date(db.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} />
          <FieldRow label="Actualizado"   value={new Date(db.updatedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} />
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {error && (
        <div
          className="p-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre *</label>
          <input type="text" value={form.name} onChange={set('name')} className={inputCls} style={inputStyle} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Motor *</label>
          <select value={form.engine} onChange={set('engine')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {ENGINE_OPTIONS.map((e) => (
              <option key={e} value={e}>{ENGINE_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Versión</label>
          <input type="text" value={form.version} onChange={set('version')} placeholder="Ej: 16.2" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP / Host</label>
          <input type="text" value={form.serverIp} onChange={set('serverIp')} placeholder="Ej: 192.168.1.10" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Puerto</label>
          <input type="number" value={form.port} onChange={set('port')} placeholder="Ej: 5432" min={1} max={65535} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre BD</label>
          <input type="text" value={form.databaseName} onChange={set('databaseName')} placeholder="Ej: erp_prod" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Gestionada por *</label>
          <select value={form.managedBy} onChange={set('managedBy')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {MANAGED_BY_OPTIONS.map((m) => (
              <option key={m} value={m}>{MANAGED_BY_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Proyecto asociado</label>
          <select value={form.projectId} onChange={set('projectId')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="">Sin proyecto</option>
            {availableProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ db, canEdit }: { db: DatabaseDetailData; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing]         = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)

  // Parse backup info from notes: notes may have a ---BACKUP--- section
  const parseNotes = (raw: string | null) => {
    const marker = '\n---BACKUP---\n'
    const idx = raw?.indexOf(marker) ?? -1
    if (idx !== -1 && raw) {
      const general = raw.slice(0, idx)
      const backupRaw = raw.slice(idx + marker.length)
      const lines = backupRaw.split('\n')
      const get = (prefix: string) =>
        lines.find((l) => l.startsWith(prefix))?.slice(prefix.length) ?? ''
      return {
        general,
        frequency:   get('Frecuencia: '),
        destination: get('Destino: '),
        retention:   get('Retención: '),
      }
    }
    return { general: raw ?? '', frequency: '', destination: '', retention: '' }
  }

  const buildNotes = (g: string, f: string, d: string, r: string) => {
    const backup = [
      f && `Frecuencia: ${f}`,
      d && `Destino: ${d}`,
      r && `Retención: ${r}`,
    ].filter(Boolean).join('\n')

    if (!backup) return g
    return `${g}\n---BACKUP---\n${backup}`
  }

  const parsed = parseNotes(db.notes)
  const [form, setForm] = useState({
    general:     parsed.general,
    frequency:   parsed.frequency,
    destination: parsed.destination,
    retention:   parsed.retention,
  })

  const handleSave = () => {
    setError(null)
    const notes = buildNotes(form.general, form.frequency, form.destination, form.retention)
    startTransition(async () => {
      const result = await updateDatabase({ id: db.id, notes: notes || undefined })
      if (!result.success) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p
            className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Documentación
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}
            >
              <Pencil size={11} />
              Editar
            </button>
          )}
        </div>

        {/* General notes */}
        <div>
          <p className="text-xs font-medium mb-2" style={labelStyle}>Notas generales</p>
          {parsed.general ? (
            <p
              className="text-sm whitespace-pre-wrap rounded p-3"
              style={{
                background: 'var(--surface-2)',
                border:     '1px solid var(--border)',
                color:      'var(--foreground-muted)',
              }}
            >
              {parsed.general}
            </p>
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--foreground-dim)' }}>Sin notas.</p>
          )}
        </div>

        {/* Backup */}
        <div>
          <p
            className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] mb-3"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Información de Backup
          </p>
          <div className="space-y-1">
            <FieldRow label="Frecuencia"  value={parsed.frequency}   />
            <FieldRow label="Destino"     value={parsed.destination} mono />
            <FieldRow label="Retención"   value={parsed.retention}   />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="p-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Notas generales</label>
        <textarea
          value={form.general}
          onChange={(e) => setForm((f) => ({ ...f, general: e.target.value }))}
          rows={5}
          placeholder="Información adicional sobre esta base de datos..."
          className={inputCls}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <p
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] mb-3"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Información de Backup
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Frecuencia</label>
            <input
              type="text"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              placeholder="Ej: Diario 2am"
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Destino</label>
            <input
              type="text"
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              placeholder="Ej: /backups/db_prod"
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Retención</label>
            <input
              type="text"
              value={form.retention}
              onChange={(e) => setForm((f) => ({ ...f, retention: e.target.value }))}
              placeholder="Ej: 30 días"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError(null) }}
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Delete button ────────────────────────────────────────────────────────────

function DeleteDatabaseButton({ databaseId }: { databaseId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteDatabase(databaseId)
      if (!result.success) { setError(result.error); return }
      router.push('/databases')
    })
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
        style={{
          color:      'var(--status-red)',
          background: 'rgba(239,68,68,0.06)',
          border:     '1px solid rgba(239,68,68,0.2)',
        }}
      >
        <Trash2 size={12} />
        Eliminar BD
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>¿Confirmar eliminación?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
          style={{ background: 'var(--status-red)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Eliminar
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded text-xs font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general',     label: 'Info General',  icon: <Info size={13} />         },
  { key: 'credentials', label: 'Credenciales',  icon: <Key size={13} />          },
  { key: 'projects',    label: 'Proyecto',      icon: <FolderKanban size={13} /> },
  { key: 'notes',       label: 'Notas',         icon: <FileText size={13} />     },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function DatabaseDetailTabs({ db, availableProjects, canEdit, canManageCreds }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 mb-6 p-1 rounded"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--surface)'  : 'transparent',
              color:      activeTab === tab.key ? 'var(--foreground)' : 'var(--foreground-muted)',
              border:     activeTab === tab.key ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        {/* Delete button — far right */}
        {canEdit && (
          <div className="ml-auto">
            <DeleteDatabaseButton databaseId={db.id} />
          </div>
        )}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'general' && (
          <GeneralTab db={db} availableProjects={availableProjects} canEdit={canEdit} />
        )}

        {activeTab === 'credentials' && (
          <DbCredentialsTab
            databaseId={db.id}
            credentials={db.credentials}
            canEdit={canManageCreds}
          />
        )}

        {activeTab === 'projects' && (
          <div className="space-y-3">
            <p
              className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Proyecto asociado
            </p>
            {db.project ? (
              <div
                className="rounded p-4 flex items-center justify-between gap-4"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div>
                  <p
                    className="text-xs font-mono mb-0.5"
                    style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
                  >
                    {db.project.code}
                  </p>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {db.project.name}
                  </p>
                </div>
                <a
                  href={`/projects/${db.project.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                  style={{
                    color:      'var(--accent-cyan)',
                    background: 'var(--accent-cyan-dim)',
                    border:     '1px solid rgba(6,182,212,0.2)',
                  }}
                >
                  <ExternalLink size={11} />
                  Abrir proyecto
                </a>
              </div>
            ) : (
              <div
                className="rounded p-8 text-center"
                style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
              >
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Esta base de datos no está asociada a ningún proyecto.
                </p>
                {canEdit && (
                  <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
                    Puedes asociarla desde la pestaña Info General → Editar.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <NotesTab db={db} canEdit={canEdit} />
        )}
      </div>
    </div>
  )
}
