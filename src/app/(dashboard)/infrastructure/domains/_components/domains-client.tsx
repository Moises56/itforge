'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Globe, Plus, AlertTriangle, Shield, ShieldOff,
  ExternalLink, Trash2, Pencil, Loader2, Check, X,
} from 'lucide-react'
import { createDomain, updateDomain, deleteDomain } from '@/modules/infrastructure/actions/domains'

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Types ────────────────────────────────────────────────────────────────────

type DomainItem = {
  id: string; name: string; type: string; pointsTo: string | null
  sslEnabled: boolean; sslExpiresAt: string | null; registrar: string | null
  expiresAt: string | null; notes: string | null; createdAt: string; updatedAt: string
  server:  { id: string; hostname: string } | null
  project: { id: string; name: string; code: string } | null
  sslAlert:    boolean
  domainAlert: boolean
}

interface Props {
  domains:  DomainItem[]
  servers:  { id: string; hostname: string; displayName: string | null; ip: string }[]
  projects: { id: string; name: string; code: string }[]
  canCreate: boolean
  canEdit:   boolean
}

// ─── Domain Form ──────────────────────────────────────────────────────────────

function DomainForm({
  initialData, servers, projects, onSuccess, onCancel,
}: {
  initialData?: DomainItem
  servers:  Props['servers']
  projects: Props['projects']
  onSuccess: () => void
  onCancel:  () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name:         initialData?.name        ?? '',
    type:         initialData?.type        ?? 'PUBLIC',
    pointsTo:     initialData?.pointsTo    ?? '',
    serverId:     initialData?.server?.id  ?? '',
    projectId:    initialData?.project?.id ?? '',
    sslEnabled:   initialData?.sslEnabled  ?? false,
    sslExpiresAt: initialData?.sslExpiresAt ? initialData.sslExpiresAt.slice(0, 10) : '',
    registrar:    initialData?.registrar   ?? '',
    expiresAt:    initialData?.expiresAt   ? initialData.expiresAt.slice(0, 10) : '',
    notes:        initialData?.notes       ?? '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre del dominio es requerido'); return }
    setError(null)

    const payload = {
      name:         form.name.trim(),
      type:         form.type as 'INTERNAL' | 'PUBLIC',
      pointsTo:     form.pointsTo.trim() || undefined,
      serverId:     form.serverId  || null,
      projectId:    form.projectId || null,
      sslEnabled:   form.sslEnabled,
      sslExpiresAt: form.sslExpiresAt ? new Date(form.sslExpiresAt).toISOString() : null,
      registrar:    form.registrar.trim() || undefined,
      expiresAt:    form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      notes:        form.notes.trim() || undefined,
    }

    startTransition(async () => {
      const result = initialData
        ? await updateDomain({ id: initialData.id, ...payload })
        : await createDomain(payload)
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded text-sm"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre / Dominio *</label>
          <input type="text" value={form.name} onChange={set('name')} placeholder="Ej: portal.amdc.hn" autoFocus
            className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Tipo</label>
          <select value={form.type} onChange={set('type')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="PUBLIC">Público</option>
            <option value="INTERNAL">Interno (AD/DNS)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Apunta a (IP)</label>
          <input type="text" value={form.pointsTo} onChange={set('pointsTo')} placeholder="Ej: 192.168.1.5"
            className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Servidor asociado</label>
          <select value={form.serverId} onChange={set('serverId')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="">Sin servidor</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName ?? s.hostname} ({s.ip})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Proyecto asociado</label>
          <select value={form.projectId} onChange={set('projectId')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>

        {/* SSL section */}
        <div className="md:col-span-2 flex items-center gap-3 pt-1">
          <input type="checkbox" id="sslEnabled" checked={form.sslEnabled}
            onChange={(e) => setForm((f) => ({ ...f, sslEnabled: e.target.checked }))} />
          <label htmlFor="sslEnabled" className="text-sm font-medium" style={labelStyle}>
            SSL habilitado
          </label>
        </div>

        {form.sslEnabled && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Expiración del SSL</label>
            <input type="date" value={form.sslExpiresAt} onChange={set('sslExpiresAt')}
              className={inputCls} style={inputStyle} />
          </div>
        )}

        {form.type === 'PUBLIC' && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Registrar</label>
              <input type="text" value={form.registrar} onChange={set('registrar')} placeholder="Ej: NIC Honduras"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Expiración del dominio</label>
              <input type="date" value={form.expiresAt} onChange={set('expiresAt')}
                className={inputCls} style={inputStyle} />
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Notas</label>
          <textarea value={form.notes} onChange={set('notes')} rows={2}
            className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {initialData ? 'Guardar cambios' : 'Registrar dominio'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function DomainsClient({ domains, servers, projects, canCreate, canEdit }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (domainId: string) => {
    if (!confirm('¿Eliminar este dominio?')) return
    startTransition(async () => {
      await deleteDomain(domainId)
      router.refresh()
    })
  }

  const alerts = domains.filter((d) => d.sslAlert || d.domainAlert)

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Dominios
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {domains.length} dominio{domains.length !== 1 ? 's' : ''} registrado{domains.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => { setAdding(!adding); setEditingId(null) }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus size={15} /> Nuevo Dominio
          </button>
        )}
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="rounded p-4 flex items-center gap-3"
             style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--status-amber)' }}>
            {alerts.length} dominio{alerts.length !== 1 ? 's' : ''} con expiración próxima (30 días).
          </p>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: 'var(--foreground-muted)' }}>
            Registrar nuevo dominio
          </p>
          <DomainForm
            servers={servers} projects={projects}
            onSuccess={() => { setAdding(false); router.refresh() }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Table */}
      {domains.length === 0 ? (
        <div className="rounded p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Globe size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>No hay dominios registrados aún</p>
          {canCreate && (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={14} /> Registrar primer dominio
            </button>
          )}
        </div>
      ) : (
        <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Dominio', 'Tipo', 'Apunta a', 'SSL', 'Exp. dominio', 'Proyecto', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map((domain, idx) => {
                const isEditing = editingId === domain.id
                const rowStyle = (domain.sslAlert || domain.domainAlert)
                  ? { borderLeft: '3px solid var(--status-amber)' }
                  : {}

                if (isEditing) {
                  return (
                    <tr key={domain.id}>
                      <td colSpan={7} className="px-5 py-4">
                        <DomainForm
                          initialData={domain}
                          servers={servers}
                          projects={projects}
                          onSuccess={() => { setEditingId(null); router.refresh() }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={domain.id} className="hover:bg-white/[0.02] transition-colors group"
                      style={{ ...rowStyle, borderBottom: idx < domains.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(domain.sslAlert || domain.domainAlert) && (
                          <AlertTriangle size={12} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
                        )}
                        <span className="font-mono font-medium text-sm" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains)' }}>
                          {domain.name}
                        </span>
                      </div>
                      {domain.server && (
                        <a href={`/infrastructure/servers/${domain.server.id}`}
                           className="text-[10px] flex items-center gap-1 mt-0.5 transition-colors"
                           style={{ color: 'var(--foreground-dim)' }}>
                          → {domain.server.hostname}
                        </a>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                            style={{
                              background: domain.type === 'PUBLIC' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                              color:      domain.type === 'PUBLIC' ? 'var(--status-green)'    : '#3b82f6',
                              border:     `1px solid ${domain.type === 'PUBLIC' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                            }}>
                        {domain.type === 'PUBLIC' ? 'Público' : 'Interno'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-xs font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                        {domain.pointsTo ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {domain.sslEnabled
                          ? <Shield size={12} style={{ color: domain.sslAlert ? 'var(--status-amber)' : 'var(--status-green)' }} />
                          : <ShieldOff size={12} style={{ color: 'var(--foreground-dim)' }} />
                        }
                        {domain.sslEnabled && domain.sslExpiresAt ? (
                          <span className="text-xs" style={{ color: domain.sslAlert ? 'var(--status-amber)' : 'var(--foreground-muted)' }}>
                            {new Date(domain.sslExpiresAt).toLocaleDateString('es')}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
                            {domain.sslEnabled ? 'Sin fecha' : 'No'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {domain.expiresAt ? (
                        <span className="text-xs" style={{ color: domain.domainAlert ? 'var(--status-amber)' : 'var(--foreground-muted)' }}>
                          {new Date(domain.expiresAt).toLocaleDateString('es')}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--foreground-dim)' }} className="text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {domain.project ? (
                        <a href={`/projects/${domain.project.id}`}
                           className="flex items-center gap-1 text-xs transition-colors"
                           style={{ color: 'var(--accent-cyan)' }}>
                          <span className="font-mono" style={{ fontFamily: 'var(--font-jetbrains)' }}>{domain.project.code}</span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--foreground-dim)' }} className="text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <>
                            <button type="button" onClick={() => { setEditingId(domain.id); setAdding(false) }}
                              className="p-1.5 rounded" style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                              <Pencil size={11} />
                            </button>
                            <button type="button" onClick={() => handleDelete(domain.id)} disabled={isPending}
                              className="p-1.5 rounded" style={{ color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
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
