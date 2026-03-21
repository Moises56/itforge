'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Info, Key, Package, FolderKanban,
  Pencil, Check, X, Loader2, Trash2,
  Eye, EyeOff, Copy, ExternalLink, Plus,
} from 'lucide-react'
import {
  updateServer, deleteServer,
  createServerCredential, revealServerCredential, deleteServerCredential,
  createServerService, deleteServerService, updateServerService,
} from '@/modules/infrastructure/actions/servers'

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

function FieldRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs w-36 shrink-0 pt-0.5" style={labelStyle}>{label}</span>
      <span className={`text-sm flex-1 ${mono ? 'font-mono' : ''}`}
            style={{ color: 'var(--foreground)', fontFamily: mono ? 'var(--font-jetbrains)' : undefined }}>
        {value ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
      </span>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'general' | 'credentials' | 'services' | 'projects'

export type ServerCredentialItem = {
  id: string; label: string; protocol: string; port: number | null
  username: string | null; domain: string | null; isDefault: boolean
  notes: string | null; createdAt: string
  lastReveal: { at: string; by: string } | null
}

export type ServerServiceItem = {
  id: string; name: string; port: number | null
  protocol: string | null; status: string; notes: string | null
}

export type ServerDocumentItem = {
  id: string; title: string; type: string; filePath: string
  fileSize: number | null; mimeType: string | null
  createdAt: string; uploadedBy: string | null
}

export type ServerDetailData = {
  id: string; hostname: string; displayName: string | null
  description: string | null; ip: string; secondaryIp: string | null
  os: string; type: string; groupId: string | null
  specs: Record<string, string> | null
  location: string | null; domain: string | null; status: string
  notes: string | null; createdAt: string; updatedAt: string
  group: { id: string; name: string } | null
  credentials: ServerCredentialItem[]
  services:    ServerServiceItem[]
  documents:   ServerDocumentItem[]
}

type HostedProject = {
  id: string; name: string; code: string; status: string; deploymentType: string
  environments: { type: string; serverPort: number | null; url: string | null }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_META: Record<string, { label: string; defaultPort: number; color: string }> = {
  RDP:       { label: 'RDP',         defaultPort: 3389, color: '#3b82f6' },
  SSH:       { label: 'SSH',         defaultPort: 22,   color: '#10b981' },
  WEB_PANEL: { label: 'Panel Web',   defaultPort: 443,  color: '#8b5cf6' },
  IPMI:      { label: 'IPMI',        defaultPort: 623,  color: '#f59e0b' },
  VNC:       { label: 'VNC',         defaultPort: 5900, color: '#ec4899' },
  OTHER:     { label: 'Otro',        defaultPort: 0,    color: '#6b7280' },
}

const SERVICE_STATUS_META: Record<string, { label: string; color: string }> = {
  RUNNING: { label: 'Corriendo', color: 'var(--status-green)' },
  STOPPED: { label: 'Detenido', color: 'var(--status-red)'    },
  UNKNOWN: { label: 'Desconocido', color: 'var(--foreground-dim)' },
}

const OS_LABELS: Record<string, string> = {
  WINDOWS_SERVER: 'Windows Server', UBUNTU: 'Ubuntu', CENTOS: 'CentOS',
  DEBIAN: 'Debian', RHEL: 'Red Hat Enterprise Linux', OTHER: 'Otro',
}
const TYPE_LABELS: Record<string, string> = {
  PHYSICAL: 'Físico', VIRTUAL: 'Virtual', CONTAINER: 'Contenedor',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo', MAINTENANCE: 'En mantenimiento', INACTIVE: 'Inactivo', DECOMMISSIONED: 'Decomisionado',
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({
  server, groups, canEdit,
}: {
  server: ServerDetailData
  groups: { id: string; name: string }[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    hostname:    server.hostname,
    displayName: server.displayName ?? '',
    description: server.description ?? '',
    ip:          server.ip,
    secondaryIp: server.secondaryIp ?? '',
    os:          server.os,
    type:        server.type,
    groupId:     server.groupId ?? '',
    location:    server.location ?? '',
    domain:      server.domain ?? '',
    status:      server.status,
    notes:       server.notes ?? '',
    cpu:         server.specs?.cpu  ?? '',
    ram:         server.specs?.ram  ?? '',
    disk:        server.specs?.disk ?? '',
  })
  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    if (!form.hostname.trim()) { setError('El hostname es requerido'); return }
    if (!form.ip.trim())       { setError('La IP es requerida'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateServer({
        id:          server.id,
        hostname:    form.hostname.trim(),
        displayName: form.displayName.trim() || null,
        description: form.description.trim() || null,
        ip:          form.ip.trim(),
        secondaryIp: form.secondaryIp.trim() || null,
        os:          form.os as never,
        type:        form.type as never,
        groupId:     form.groupId || null,
        location:    form.location.trim() || null,
        domain:      form.domain.trim() || null,
        status:      form.status as never,
        notes:       form.notes.trim() || null,
        specs:       (form.cpu || form.ram || form.disk) ? { cpu: form.cpu, ram: form.ram, disk: form.disk } : undefined,
      })
      if (!result.success) { setError(result.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
             style={{ color: 'var(--foreground-muted)' }}>
            Información del servidor
          </p>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <Pencil size={11} /> Editar
            </button>
          )}
        </div>
        <FieldRow label="Hostname"   value={server.hostname}    mono />
        <FieldRow label="IP"         value={server.ip}          mono />
        {server.secondaryIp && <FieldRow label="IP Secundaria" value={server.secondaryIp} mono />}
        <FieldRow label="OS"         value={OS_LABELS[server.os]  ?? server.os} />
        <FieldRow label="Tipo"       value={TYPE_LABELS[server.type] ?? server.type} />
        <FieldRow label="Estado"     value={STATUS_LABELS[server.status] ?? server.status} />
        {server.domain   && <FieldRow label="Dominio (AD)"   value={server.domain}   mono />}
        {server.location && <FieldRow label="Ubicación"      value={server.location} />}
        {server.group    && <FieldRow label="Grupo"          value={server.group.name} />}
        {server.specs?.cpu  && <FieldRow label="CPU"   value={server.specs.cpu} />}
        {server.specs?.ram  && <FieldRow label="RAM"   value={server.specs.ram} />}
        {server.specs?.disk && <FieldRow label="Disco" value={server.specs.disk} />}
        {server.notes && (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2" style={labelStyle}>Notas</p>
            <p className="text-sm whitespace-pre-wrap rounded p-3"
               style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
              {server.notes}
            </p>
          </div>
        )}
        <FieldRow label="Registrado"  value={new Date(server.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} />
        <FieldRow label="Actualizado" value={new Date(server.updatedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded text-sm"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Hostname *</label>
          <input type="text" value={form.hostname} onChange={set('hostname')} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre de pantalla</label>
          <input type="text" value={form.displayName} onChange={set('displayName')} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP *</label>
          <input type="text" value={form.ip} onChange={set('ip')} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP Secundaria</label>
          <input type="text" value={form.secondaryIp} onChange={set('secondaryIp')} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>OS</label>
          <select value={form.os} onChange={set('os')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {Object.entries(OS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Tipo</label>
          <select value={form.type} onChange={set('type')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Estado</label>
          <select value={form.status} onChange={set('status')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Grupo</label>
          <select value={form.groupId} onChange={set('groupId')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="">Sin grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Dominio (AD)</label>
          <input type="text" value={form.domain} onChange={set('domain')} placeholder="Ej: EJECUTIVO.AMDC" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Ubicación</label>
          <input type="text" value={form.location} onChange={set('location')} className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Descripción</label>
          <input type="text" value={form.description} onChange={set('description')} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>CPU</label>
          <input type="text" value={form.cpu} onChange={set('cpu')} placeholder="Ej: Intel Xeon 8 cores" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>RAM</label>
          <input type="text" value={form.ram} onChange={set('ram')} placeholder="Ej: 32 GB DDR4" className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Disco</label>
          <input type="text" value={form.disk} onChange={set('disk')} placeholder="Ej: 2 TB RAID-1" className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Notas</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar cambios
        </button>
        <button type="button" onClick={() => { setEditing(false); setError(null) }}
          className="px-4 py-2 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Credentials Tab ──────────────────────────────────────────────────────────

function CredentialRow({ cred, serverId, canEdit }: {
  cred: ServerCredentialItem; serverId: string; canEdit: boolean
}) {
  const router = useRouter()
  const [revealing, setRevealing]   = useState(false)
  const [value, setValue]           = useState<string | null>(null)
  const [password, setPassword]     = useState('')
  const [visible, setVisible]       = useState(false)
  const [copying, setCopying]       = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const proto = PROTOCOL_META[cred.protocol] ?? PROTOCOL_META.OTHER!

  const handleReveal = () => {
    setError(null)
    startTransition(async () => {
      const result = await revealServerCredential(cred.id, password)
      if (!result.success) { setError(result.error); return }
      setValue(result.data.value)
      setRevealing(false)
      setPassword('')
      // Auto-hide after 30s
      setTimeout(() => setValue(null), 30000)
    })
  }

  const handleCopyConnection = () => {
    const conn = `${cred.domain ? `${cred.domain}\\${cred.username ?? ''}` : (cred.username ?? '')}@${serverId}:${cred.port ?? proto.defaultPort}`
    navigator.clipboard.writeText(conn).then(() => {
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteServerCredential(cred.id, serverId)
      router.refresh()
    })
  }

  return (
    <div
      className="p-4 rounded space-y-3"
      style={{ background: 'var(--surface-2)', border: `1px solid ${proto.color}20` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
          style={{ background: `${proto.color}18`, color: proto.color, border: `1px solid ${proto.color}30`, fontFamily: 'var(--font-jetbrains)' }}
        >
          {proto.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{cred.label}</p>
            {cred.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-glow)', color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)' }}>
                Principal
              </span>
            )}
          </div>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
            {cred.domain ? `${cred.domain}\\${cred.username ?? ''}` : (cred.username ?? '')}
            {cred.port ? ` · Puerto ${cred.port}` : (proto.defaultPort ? ` · Puerto ${proto.defaultPort}` : '')}
          </p>
          {cred.lastReveal && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--foreground-dim)' }}>
              Último acceso: {new Date(cred.lastReveal.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} por {cred.lastReveal.by}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy connection string */}
          <button type="button" onClick={handleCopyConnection}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all"
            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)', background: 'var(--surface)' }}
            title="Copiar IP:Puerto">
            {copying ? <Check size={10} /> : <Copy size={10} />}
          </button>

          {/* Reveal */}
          {!value && (
            <button type="button" onClick={() => { setRevealing(!revealing); setError(null) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all"
              style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)', background: 'var(--accent-cyan-dim)' }}>
              <Eye size={10} /> Revelar
            </button>
          )}
          {value && (
            <button type="button" onClick={() => setValue(null)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
              <EyeOff size={10} /> Ocultar
            </button>
          )}

          {/* Delete */}
          {canEdit && !confirming && (
            <button type="button" onClick={() => setConfirming(true)}
              className="p-1.5 rounded transition-all"
              style={{ color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
              <Trash2 size={11} />
            </button>
          )}
          {canEdit && confirming && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleDelete} disabled={isPending}
                className="px-2 py-1 rounded text-[10px] font-medium disabled:opacity-50"
                style={{ background: 'var(--status-red)', color: '#fff' }}>
                {isPending ? <Loader2 size={10} className="animate-spin" /> : 'Eliminar'}
              </button>
              <button type="button" onClick={() => setConfirming(false)}
                className="px-2 py-1 rounded text-[10px]"
                style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reveal form */}
      {revealing && !value && (
        <div className="flex gap-2">
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña para confirmar identidad..."
            className={inputCls} style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleReveal()}
            autoFocus
          />
          <button type="button" onClick={handleReveal} disabled={isPending || !password}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Ver
          </button>
          <button type="button" onClick={() => { setRevealing(false); setPassword(''); setError(null) }}
            className="p-1.5 rounded" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}

      {value && (
        <div className="flex items-center gap-2">
          <code
            className="flex-1 text-xs px-3 py-2 rounded font-mono select-all"
            style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {value}
          </code>
          <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopying(true); setTimeout(() => setCopying(false), 2000) }}
            className="p-1.5 rounded" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
            {copying ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
    </div>
  )
}

function CredentialsTab({ server, canEdit }: { server: ServerDetailData; canEdit: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '', protocol: 'RDP' as const, port: '', username: '',
    plainValue: '', domain: '', isDefault: false, notes: '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    if (!form.label.trim()) { setError('La etiqueta es requerida'); return }
    if (!form.plainValue.trim()) { setError('El valor es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await createServerCredential({
        serverId:   server.id,
        label:      form.label.trim(),
        protocol:   form.protocol,
        port:       form.port ? Number(form.port) : null,
        username:   form.username.trim() || undefined,
        plainValue: form.plainValue,
        domain:     form.domain.trim() || undefined,
        isDefault:  form.isDefault,
        notes:      form.notes.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setForm({ label: '', protocol: 'RDP', port: '', username: '', plainValue: '', domain: '', isDefault: false, notes: '' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Credenciales de acceso
        </p>
        {canEdit && (
          <button type="button" onClick={() => { setAdding(!adding); setError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)', background: 'var(--accent-cyan-dim)' }}>
            <Plus size={11} /> Agregar credencial
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Etiqueta *</label>
              <input type="text" value={form.label} onChange={set('label')} placeholder="Ej: Administrador RDP" autoFocus className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Protocolo *</label>
              <select value={form.protocol} onChange={set('protocol')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
                {Object.entries(PROTOCOL_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Usuario</label>
              <input type="text" value={form.username} onChange={set('username')} placeholder="Ej: Administrator" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Dominio (AD)</label>
              <input type="text" value={form.domain} onChange={set('domain')} placeholder="Ej: EJECUTIVO.AMDC" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Puerto</label>
              <input type="number" value={form.port} onChange={set('port')} placeholder="Dejar vacío = puerto por defecto" min={1} max={65535} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="isDefault" checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded" />
              <label htmlFor="isDefault" className="text-xs" style={labelStyle}>Credencial principal</label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Contraseña / Clave *</label>
              <textarea value={form.plainValue} onChange={(e) => setForm((f) => ({ ...f, plainValue: e.target.value }))}
                rows={3} placeholder="Contraseña, clave SSH, token..." className={inputCls} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-jetbrains)' }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleAdd} disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Guardar
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {server.credentials.length === 0 && !adding ? (
        <div className="rounded p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}>
          <Key size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No hay credenciales registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {server.credentials.map((cred) => (
            <CredentialRow key={cred.id} cred={cred} serverId={server.id} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ server, canEdit }: { server: ServerDetailData; canEdit: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', port: '', protocol: '', status: 'RUNNING', notes: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await createServerService({
        serverId: server.id,
        name:     form.name.trim(),
        port:     form.port ? Number(form.port) : null,
        protocol: form.protocol.trim() || undefined,
        status:   form.status as never,
        notes:    form.notes.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setForm({ name: '', port: '', protocol: '', status: 'RUNNING', notes: '' })
      router.refresh()
    })
  }

  const handleStatusChange = (svc: ServerServiceItem, newStatus: string) => {
    startTransition(async () => {
      await updateServerService({ id: svc.id, serverId: server.id, status: newStatus as never })
      router.refresh()
    })
  }

  const handleDelete = (svc: ServerServiceItem) => {
    startTransition(async () => {
      await deleteServerService(svc.id, server.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Servicios en ejecución
        </p>
        {canEdit && (
          <button type="button" onClick={() => { setAdding(!adding); setError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)', background: 'var(--accent-cyan-dim)' }}>
            <Plus size={11} /> Agregar servicio
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre *</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Ej: Nginx" autoFocus className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Puerto</label>
              <input type="number" value={form.port} onChange={set('port')} placeholder="80" min={1} max={65535} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Protocolo</label>
              <input type="text" value={form.protocol} onChange={set('protocol')} placeholder="HTTP" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Estado</label>
              <select value={form.status} onChange={set('status')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
                <option value="RUNNING">Corriendo</option>
                <option value="STOPPED">Detenido</option>
                <option value="UNKNOWN">Desconocido</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Agregar
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {server.services.length === 0 && !adding ? (
        <div className="rounded p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}>
          <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No hay servicios registrados</p>
        </div>
      ) : (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Servicio', 'Puerto', 'Protocolo', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {server.services.map((svc, idx) => {
                const st = SERVICE_STATUS_META[svc.status] ?? SERVICE_STATUS_META.UNKNOWN!
                return (
                  <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderBottom: idx < server.services.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>{svc.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                      {svc.port ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                      {svc.protocol ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit ? (
                        <select
                          value={svc.status}
                          onChange={(e) => handleStatusChange(svc, e.target.value)}
                          className="text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer outline-none"
                          style={{ background: `${st.color}10`, color: st.color, border: `1px solid ${st.color}30` }}
                        >
                          <option value="RUNNING">Corriendo</option>
                          <option value="STOPPED">Detenido</option>
                          <option value="UNKNOWN">Desconocido</option>
                        </select>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                              style={{ background: `${st.color}10`, color: st.color, border: `1px solid ${st.color}30` }}>
                          {st.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit && (
                        <button type="button" onClick={() => handleDelete(svc)}
                          className="p-1 rounded transition-all"
                          style={{ color: 'var(--status-red)' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
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

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ hostedProjects }: { hostedProjects: HostedProject[] }) {
  if (hostedProjects.length === 0) {
    return (
      <div className="rounded p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}>
        <FolderKanban size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Ningún proyecto tiene un ambiente con la IP de este servidor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
        Proyectos alojados en este servidor
      </p>
      {hostedProjects.map((proj) => (
        <div
          key={proj.id}
          className="rounded p-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div>
            <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}>
              {proj.code}
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{proj.name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              {proj.environments.map((e) => `${e.type}${e.serverPort ? `:${e.serverPort}` : ''}`).join(' · ')}
            </p>
          </div>
          <a
            href={`/projects/${proj.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium shrink-0"
            style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <ExternalLink size={11} /> Abrir proyecto
          </a>
        </div>
      ))}
    </div>
  )
}

// ─── Delete Button ────────────────────────────────────────────────────────────

function DeleteServerButton({ serverId }: { serverId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteServer(serverId)
      router.push('/infrastructure/servers')
    })
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
        style={{ color: 'var(--status-red)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Trash2 size={12} /> Eliminar servidor
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>¿Confirmar?</span>
      <button type="button" onClick={handleDelete} disabled={isPending}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
        style={{ background: 'var(--status-red)', color: '#fff' }}>
        {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
        Eliminar
      </button>
      <button type="button" onClick={() => setConfirming(false)}
        className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
        Cancelar
      </button>
    </div>
  )
}

// ─── Main Tabs Component ──────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general',     label: 'Info General', icon: <Info size={13} />         },
  { key: 'credentials', label: 'Credenciales', icon: <Key size={13} />          },
  { key: 'services',    label: 'Servicios',    icon: <Package size={13} />      },
  { key: 'projects',    label: 'Proyectos',    icon: <FolderKanban size={13} /> },
]

export function ServerDetailTabs({
  server, hostedProjects, groups, canEdit, canManageCreds,
}: {
  server:         ServerDetailData
  hostedProjects: HostedProject[]
  groups:         { id: string; name: string }[]
  canEdit:        boolean
  canManageCreds: boolean
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  return (
    <div>
      <div
        className="flex items-center gap-1 mb-6 p-1 rounded flex-wrap"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--surface)'    : 'transparent',
              color:      activeTab === tab.key ? 'var(--foreground)' : 'var(--foreground-muted)',
              border:     activeTab === tab.key ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        {canEdit && (
          <div className="ml-auto">
            <DeleteServerButton serverId={server.id} />
          </div>
        )}
      </div>

      <div>
        {activeTab === 'general'     && <GeneralTab server={server} groups={groups} canEdit={canEdit} />}
        {activeTab === 'credentials' && <CredentialsTab server={server} canEdit={canManageCreds} />}
        {activeTab === 'services'    && <ServicesTab server={server} canEdit={canEdit} />}
        {activeTab === 'projects'    && <ProjectsTab hostedProjects={hostedProjects} />}
      </div>
    </div>
  )
}
