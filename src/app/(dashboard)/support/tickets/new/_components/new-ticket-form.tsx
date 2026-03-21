'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupportTicket } from '@/modules/support/actions/tickets'

interface SelectOption {
  id: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  code?: string
  type?: string
  assetTag?: string | null
  hostname?: string
  displayName?: string | null
  ip?: string
}

interface Props {
  departments: SelectOption[]
  assets:      SelectOption[]
  projects:    SelectOption[]
  servers:     SelectOption[]
  users:       SelectOption[]
  organizationId: string
}

const FIELD_STYLE = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-bright)',
  color: 'var(--foreground)',
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.15em',
  color: 'var(--foreground-muted)',
  marginBottom: '6px',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>
        {label}
        {required && <span style={{ color: 'var(--status-red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function NewTicketForm({ departments, assets, projects, servers, users }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createSupportTicket(fd)
      if (result.success) {
        router.push(`/support/tickets/${result.id}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Título" required>
        <input name="title" required placeholder="Describe brevemente el problema..." style={FIELD_STYLE} />
      </Field>

      <Field label="Descripción">
        <textarea name="description" rows={4} placeholder="Detalla el problema, pasos para reproducirlo, etc."
                  style={{ ...FIELD_STYLE, resize: 'vertical' }} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo" required>
          <select name="type" required style={FIELD_STYLE}>
            <option value="GENERAL_SUPPORT">Soporte general</option>
            <option value="HARDWARE_REPAIR">Reparación hardware</option>
            <option value="SOFTWARE_INSTALL">Instalación software</option>
            <option value="ACCESS_REQUEST">Solicitud de acceso</option>
            <option value="NETWORK_ISSUE">Problema de red</option>
            <option value="PRINTER_ISSUE">Problema de impresora</option>
            <option value="OTHER">Otro</option>
          </select>
        </Field>
        <Field label="Prioridad" required>
          <select name="priority" required style={FIELD_STYLE}>
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="CRITICAL">Crítica</option>
          </select>
        </Field>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Solicitante</p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre del solicitante" required>
          <input name="requestedByName" required placeholder="Nombre completo" style={FIELD_STYLE} />
        </Field>
        <Field label="Dependencia">
          <select name="requestedByDepartmentId" style={FIELD_STYLE}>
            <option value="">— Sin dependencia —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>Asociaciones (opcionales)</p>

      <Field label="Asignar técnico">
        <select name="assignedToId" style={FIELD_STYLE}>
          <option value="">— Sin asignar —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Equipo relacionado">
          <select name="assetId" style={FIELD_STYLE}>
            <option value="">— Ninguno —</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.assetTag ? ` (${a.assetTag})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Servidor relacionado">
          <select name="serverId" style={FIELD_STYLE}>
            <option value="">— Ninguno —</option>
            {servers.map(s => <option key={s.id} value={s.id}>{s.displayName ?? s.hostname} ({s.ip})</option>)}
          </select>
        </Field>
      </div>

      <Field label="Proyecto relacionado">
        <select name="projectId" style={FIELD_STYLE}>
          <option value="">— Ninguno —</option>
          {projects.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
        </select>
      </Field>

      {error && (
        <div className="px-4 py-3 rounded text-sm"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
                className="px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
          {pending ? 'Creando...' : 'Crear Ticket'}
        </button>
        <a href="/support/tickets" className="px-5 py-2.5 rounded text-sm font-medium"
           style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
