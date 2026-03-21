'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Info, Key, Network, Pencil, Check, Loader2, Trash2, Eye, EyeOff, Copy, Plus, X } from 'lucide-react'
import {
  updateNetworkEquipment, deleteNetworkEquipment,
  createEquipmentCredential, revealEquipmentCredential, deleteEquipmentCredential,
  createEquipmentPort, updateEquipmentPort, deleteEquipmentPort,
} from '@/modules/infrastructure/actions/network'

// ─── Styles ───────────────────────────────────────────────────────────────────

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

type TabKey = 'general' | 'credentials' | 'ports'

export type EquipmentCredentialItem = {
  id: string; label: string; protocol: string; port: number | null
  username: string | null; notes: string | null; createdAt: string
  lastReveal: { at: string; by: string } | null
}

export type EquipmentPortItem = {
  id: string; portNumber: string; label: string | null
  vlan: string | null; connectedTo: string | null; status: string; notes: string | null
}

export type NetworkEquipmentData = {
  id: string; name: string; type: string; brand: string | null; model: string | null
  ip: string | null; location: string | null; managementUrl: string | null
  totalPorts: number | null; firmware: string | null; status: string
  notes: string | null; createdAt: string; updatedAt: string
  credentials: EquipmentCredentialItem[]
  ports:       EquipmentPortItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  SWITCH: 'Switch', ROUTER: 'Router', ACCESS_POINT: 'Access Point',
  FIREWALL: 'Firewall', UPS: 'UPS', OTHER: 'Otro',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo', MAINTENANCE: 'En mantenimiento', INACTIVE: 'Inactivo',
}
const PROTO_META: Record<string, { label: string; color: string }> = {
  SSH:       { label: 'SSH',       color: '#10b981' },
  WEB_PANEL: { label: 'Panel Web', color: '#8b5cf6' },
  SNMP:      { label: 'SNMP',      color: '#f59e0b' },
  OTHER:     { label: 'Otro',      color: '#6b7280' },
}
const PORT_STATUS_COLORS: Record<string, string> = {
  up:      'var(--status-green)',
  down:    'var(--status-red)',
  unknown: 'var(--foreground-dim)',
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ eq, canEdit }: { eq: NetworkEquipmentData; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: eq.name, type: eq.type, brand: eq.brand ?? '', model: eq.model ?? '',
    ip: eq.ip ?? '', location: eq.location ?? '', managementUrl: eq.managementUrl ?? '',
    totalPorts: eq.totalPorts ? String(eq.totalPorts) : '', firmware: eq.firmware ?? '',
    status: eq.status, notes: eq.notes ?? '',
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateNetworkEquipment({
        id: eq.id, name: form.name.trim(), type: form.type as never,
        brand: form.brand.trim() || null, model: form.model.trim() || null,
        ip: form.ip.trim() || null, location: form.location.trim() || null,
        managementUrl: form.managementUrl.trim() || null,
        totalPorts: form.totalPorts ? Number(form.totalPorts) : null,
        firmware: form.firmware.trim() || null,
        status: form.status as never, notes: form.notes.trim() || null,
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
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>Información</p>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <Pencil size={11} /> Editar
            </button>
          )}
        </div>
        <FieldRow label="Tipo"         value={TYPE_LABELS[eq.type] ?? eq.type} />
        <FieldRow label="Marca"        value={eq.brand}      />
        <FieldRow label="Modelo"       value={eq.model}      />
        <FieldRow label="IP Gestión"   value={eq.ip}         mono />
        <FieldRow label="Firmware"     value={eq.firmware}   mono />
        <FieldRow label="Puertos"      value={eq.totalPorts ? `${eq.totalPorts} puertos` : null} />
        <FieldRow label="Ubicación"    value={eq.location}   />
        <FieldRow label="URL Admin"    value={eq.managementUrl ? (
          <a href={eq.managementUrl} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 transition-colors" style={{ color: 'var(--accent-cyan)' }}>
            {eq.managementUrl}
          </a>
        ) : null} />
        <FieldRow label="Estado"       value={STATUS_LABELS[eq.status] ?? eq.status} />
        {eq.notes && (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2" style={labelStyle}>Notas</p>
            <p className="text-sm whitespace-pre-wrap rounded p-3"
               style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
              {eq.notes}
            </p>
          </div>
        )}
        <FieldRow label="Registrado"  value={new Date(eq.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} />
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
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre *</label>
          <input type="text" value={form.name} onChange={set('name')} autoFocus className={inputCls} style={inputStyle} />
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
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Marca</label>
          <input type="text" value={form.brand} onChange={set('brand')} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Modelo</label>
          <input type="text" value={form.model} onChange={set('model')} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP de gestión</label>
          <input type="text" value={form.ip} onChange={set('ip')} placeholder="Ej: 192.168.0.1" className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Total de puertos</label>
          <input type="number" value={form.totalPorts} onChange={set('totalPorts')} placeholder="Ej: 24" min={1} max={9999} className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Firmware</label>
          <input type="text" value={form.firmware} onChange={set('firmware')} className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>URL panel admin</label>
          <input type="text" value={form.managementUrl} onChange={set('managementUrl')} placeholder="https://..." className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Ubicación</label>
          <input type="text" value={form.location} onChange={set('location')} className={inputCls} style={inputStyle} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Notas</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar
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

function CredentialsTab({ eq, canEdit }: { eq: NetworkEquipmentData; canEdit: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({})
  const [password, setPassword] = useState('')
  const [copying, setCopying] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', protocol: 'SSH', port: '', username: '', plainValue: '', notes: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    if (!form.label.trim() || !form.plainValue.trim()) { setError('Etiqueta y valor son requeridos'); return }
    setError(null)
    startTransition(async () => {
      const result = await createEquipmentCredential({
        equipmentId: eq.id, label: form.label.trim(), protocol: form.protocol as never,
        port: form.port ? Number(form.port) : null,
        username: form.username.trim() || undefined, plainValue: form.plainValue,
        notes: form.notes.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setForm({ label: '', protocol: 'SSH', port: '', username: '', plainValue: '', notes: '' })
      router.refresh()
    })
  }

  const handleReveal = (credId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await revealEquipmentCredential(credId, password)
      if (!result.success) { setError(result.error); return }
      setRevealedValues((prev) => ({ ...prev, [credId]: result.data.value }))
      setRevealingId(null)
      setPassword('')
      setTimeout(() => setRevealedValues((prev) => { const { [credId]: _, ...rest } = prev; return rest }), 30000)
    })
  }

  const handleDelete = (credId: string) => {
    startTransition(async () => {
      await deleteEquipmentCredential(credId, eq.id)
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
            <Plus size={11} /> Agregar
          </button>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}

      {adding && (
        <div className="rounded p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Etiqueta *</label>
              <input type="text" value={form.label} onChange={set('label')} autoFocus className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Protocolo</label>
              <select value={form.protocol} onChange={set('protocol')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
                {Object.entries(PROTO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Usuario</label>
              <input type="text" value={form.username} onChange={set('username')} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Puerto</label>
              <input type="number" value={form.port} onChange={set('port')} min={1} max={65535} className={inputCls} style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Contraseña / Clave *</label>
              <input type="password" value={form.plainValue} onChange={set('plainValue')} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {eq.credentials.length === 0 && !adding ? (
        <div className="rounded p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}>
          <Key size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No hay credenciales registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eq.credentials.map((cred) => {
            const proto = PROTO_META[cred.protocol] ?? PROTO_META.OTHER!
            const revealed = revealedValues[cred.id]
            return (
              <div key={cred.id} className="p-4 rounded space-y-2"
                   style={{ background: 'var(--surface-2)', border: `1px solid ${proto.color}20` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                        style={{ background: `${proto.color}18`, color: proto.color, border: `1px solid ${proto.color}30`, fontFamily: 'var(--font-jetbrains)' }}>
                    {proto.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{cred.label}</p>
                    {cred.username && <p className="text-[10px] font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>{cred.username}{cred.port ? `:${cred.port}` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!revealed && revealingId !== cred.id && (
                      <button type="button" onClick={() => { setRevealingId(cred.id); setError(null) }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium"
                        style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)', background: 'var(--accent-cyan-dim)' }}>
                        <Eye size={10} /> Revelar
                      </button>
                    )}
                    {revealed && (
                      <button type="button" onClick={() => setRevealedValues((p) => { const { [cred.id]: _, ...r } = p; return r })}
                        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px]"
                        style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                        <EyeOff size={10} /> Ocultar
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" onClick={() => handleDelete(cred.id)}
                        className="p-1.5 rounded" style={{ color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {revealingId === cred.id && !revealed && (
                  <div className="flex gap-2">
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña..." className={inputCls} style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => e.key === 'Enter' && handleReveal(cred.id)} autoFocus />
                    <button type="button" onClick={() => handleReveal(cred.id)} disabled={isPending || !password}
                      className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {isPending ? <Loader2 size={12} className="animate-spin" /> : 'Ver'}
                    </button>
                    <button type="button" onClick={() => { setRevealingId(null); setPassword(''); setError(null) }}
                      className="p-1.5 rounded" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                      <X size={13} />
                    </button>
                  </div>
                )}

                {revealed && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs px-3 py-2 rounded font-mono select-all"
                          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}>
                      {revealed}
                    </code>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(revealed); setCopying(true); setTimeout(() => setCopying(false), 2000) }}
                      className="p-1.5 rounded" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
                      {copying ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Ports Tab ────────────────────────────────────────────────────────────────

function PortsTab({ eq, canEdit }: { eq: NetworkEquipmentData; canEdit: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ portNumber: '', label: '', vlan: '', connectedTo: '', status: 'unknown', notes: '' })
  const [editForm, setEditForm] = useState<EquipmentPortItem | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleAdd = () => {
    if (!form.portNumber.trim()) { setError('El número de puerto es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await createEquipmentPort({
        equipmentId: eq.id, portNumber: form.portNumber.trim(),
        label: form.label.trim() || undefined, vlan: form.vlan.trim() || undefined,
        connectedTo: form.connectedTo.trim() || undefined, status: form.status,
        notes: form.notes.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setForm({ portNumber: '', label: '', vlan: '', connectedTo: '', status: 'unknown', notes: '' })
      router.refresh()
    })
  }

  const handleUpdate = (port: EquipmentPortItem) => {
    if (!editForm) return
    startTransition(async () => {
      await updateEquipmentPort({
        id: port.id, equipmentId: eq.id,
        portNumber: editForm.portNumber, label: editForm.label, vlan: editForm.vlan,
        connectedTo: editForm.connectedTo, status: editForm.status, notes: editForm.notes,
      })
      setEditingId(null)
      setEditForm(null)
      router.refresh()
    })
  }

  const handleDelete = (portId: string) => {
    startTransition(async () => {
      await deleteEquipmentPort(portId, eq.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Puertos {eq.totalPorts ? `(${eq.ports.length}/${eq.totalPorts} documentados)` : `(${eq.ports.length} documentados)`}
        </p>
        {canEdit && (
          <button type="button" onClick={() => { setAdding(!adding); setError(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ color: 'var(--accent-cyan)', border: '1px solid rgba(6,182,212,0.2)', background: 'var(--accent-cyan-dim)' }}>
            <Plus size={11} /> Agregar puerto
          </button>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}

      {adding && (
        <div className="rounded p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Puerto *</label>
              <input type="text" value={form.portNumber} onChange={set('portNumber')} placeholder="Ej: Gi1/0/1" autoFocus className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Etiqueta</label>
              <input type="text" value={form.label} onChange={set('label')} placeholder="Ej: SRV-DB01" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>VLAN</label>
              <input type="text" value={form.vlan} onChange={set('vlan')} placeholder="Ej: 10" className={inputCls} style={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Conectado a</label>
              <input type="text" value={form.connectedTo} onChange={set('connectedTo')} placeholder="Ej: SRV-APP01 NIC principal" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Estado</label>
              <select value={form.status} onChange={set('status')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="unknown">Desconocido</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd} disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Agregar
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {eq.ports.length === 0 && !adding ? (
        <div className="rounded p-8 text-center" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}>
          <Network size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No hay puertos documentados</p>
        </div>
      ) : (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Puerto', 'Etiqueta', 'VLAN', 'Conectado a', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eq.ports.map((port, idx) => {
                const statusColor = PORT_STATUS_COLORS[port.status] ?? PORT_STATUS_COLORS.unknown!
                const isEditing = editingId === port.id
                return (
                  <tr key={port.id} className="hover:bg-white/[0.02]"
                      style={{ borderBottom: idx < eq.ports.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}>
                      {isEditing ? (
                        <input value={editForm?.portNumber ?? ''} onChange={(e) => setEditForm((f) => f && ({ ...f, portNumber: e.target.value }))}
                          className="px-2 py-1 rounded text-xs outline-none w-24" style={inputStyle} />
                      ) : port.portNumber}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {isEditing ? (
                        <input value={editForm?.label ?? ''} onChange={(e) => setEditForm((f) => f && ({ ...f, label: e.target.value }))}
                          className="px-2 py-1 rounded text-xs outline-none w-28" style={inputStyle} />
                      ) : (port.label ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                      {isEditing ? (
                        <input value={editForm?.vlan ?? ''} onChange={(e) => setEditForm((f) => f && ({ ...f, vlan: e.target.value }))}
                          className="px-2 py-1 rounded text-xs outline-none w-16" style={inputStyle} />
                      ) : (port.vlan ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>)}
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-[200px] truncate" style={{ color: 'var(--foreground-muted)' }}>
                      {isEditing ? (
                        <input value={editForm?.connectedTo ?? ''} onChange={(e) => setEditForm((f) => f && ({ ...f, connectedTo: e.target.value }))}
                          className="px-2 py-1 rounded text-xs outline-none w-40" style={inputStyle} />
                      ) : (port.connectedTo ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>)}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <select value={editForm?.status ?? 'unknown'} onChange={(e) => setEditForm((f) => f && ({ ...f, status: e.target.value }))}
                          className="text-[10px] px-2 py-0.5 rounded cursor-pointer outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                          <option value="up">Up</option>
                          <option value="down">Down</option>
                          <option value="unknown">Desconocido</option>
                        </select>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                              style={{ color: statusColor, background: `${statusColor}10`, border: `1px solid ${statusColor}30` }}>
                          {port.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit && !isEditing && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => { setEditingId(port.id); setEditForm({ ...port }) }}
                            className="p-1 rounded" style={{ color: 'var(--foreground-muted)' }}>
                            <Pencil size={11} />
                          </button>
                          <button type="button" onClick={() => handleDelete(port.id)}
                            className="p-1 rounded" style={{ color: 'var(--status-red)' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                      {canEdit && isEditing && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleUpdate(port)} disabled={isPending}
                            className="p-1 rounded" style={{ color: 'var(--status-green)' }}>
                            {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button type="button" onClick={() => { setEditingId(null); setEditForm(null) }}
                            className="p-1 rounded" style={{ color: 'var(--foreground-muted)' }}>
                            <X size={11} />
                          </button>
                        </div>
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

// ─── Delete Button ────────────────────────────────────────────────────────────

function DeleteEquipmentButton({ equipmentId }: { equipmentId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteNetworkEquipment(equipmentId)
      router.push('/infrastructure/network')
    })
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
        style={{ color: 'var(--status-red)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Trash2 size={12} /> Eliminar equipo
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>¿Confirmar?</span>
      <button type="button" onClick={handleDelete} disabled={isPending}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
        style={{ background: 'var(--status-red)', color: '#fff' }}>
        {isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Eliminar
      </button>
      <button type="button" onClick={() => setConfirming(false)}
        className="px-3 py-1.5 rounded text-xs" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
        Cancelar
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS_CONFIG: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general',     label: 'Info General',  icon: <Info size={13} />    },
  { key: 'credentials', label: 'Credenciales',  icon: <Key size={13} />     },
  { key: 'ports',       label: 'Puertos',       icon: <Network size={13} /> },
]

export function NetworkDetailTabs({
  equipment, canEdit, canManageCreds, isSwitch,
}: {
  equipment:      NetworkEquipmentData
  canEdit:        boolean
  canManageCreds: boolean
  isSwitch:       boolean
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const tabs = isSwitch ? TABS_CONFIG : TABS_CONFIG.filter((t) => t.key !== 'ports')

  return (
    <div>
      <div
        className="flex items-center gap-1 mb-6 p-1 rounded flex-wrap"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--surface)'    : 'transparent',
              color:      activeTab === tab.key ? 'var(--foreground)' : 'var(--foreground-muted)',
              border:     activeTab === tab.key ? '1px solid var(--border)' : '1px solid transparent',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
        {canEdit && <div className="ml-auto"><DeleteEquipmentButton equipmentId={equipment.id} /></div>}
      </div>
      {activeTab === 'general'     && <GeneralTab eq={equipment} canEdit={canEdit} />}
      {activeTab === 'credentials' && <CredentialsTab eq={equipment} canEdit={canManageCreds} />}
      {activeTab === 'ports'       && isSwitch && <PortsTab eq={equipment} canEdit={canEdit} />}
    </div>
  )
}
