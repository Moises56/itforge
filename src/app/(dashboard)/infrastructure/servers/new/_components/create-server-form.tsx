'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Server } from 'lucide-react'
import { createServer } from '@/modules/infrastructure/actions/servers'

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

const OS_OPTIONS = [
  { value: 'WINDOWS_SERVER', label: 'Windows Server' },
  { value: 'UBUNTU',         label: 'Ubuntu'          },
  { value: 'CENTOS',         label: 'CentOS'           },
  { value: 'DEBIAN',         label: 'Debian'           },
  { value: 'RHEL',           label: 'Red Hat Enterprise Linux' },
  { value: 'OTHER',          label: 'Otro'             },
]

const TYPE_OPTIONS = [
  { value: 'PHYSICAL',  label: 'Físico'     },
  { value: 'VIRTUAL',   label: 'Virtual'    },
  { value: 'CONTAINER', label: 'Contenedor' },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE',         label: 'Activo'        },
  { value: 'MAINTENANCE',    label: 'En mantenimiento' },
  { value: 'INACTIVE',       label: 'Inactivo'      },
  { value: 'DECOMMISSIONED', label: 'Decomisionado' },
]

interface Props {
  groups: { id: string; name: string }[]
}

export function CreateServerForm({ groups }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    hostname:    '',
    displayName: '',
    description: '',
    ip:          '',
    secondaryIp: '',
    os:          'UBUNTU' as const,
    type:        'PHYSICAL' as const,
    groupId:     '',
    location:    '',
    domain:      '',
    status:      'ACTIVE' as const,
    notes:       '',
    cpu:         '',
    ram:         '',
    disk:        '',
  })

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.hostname.trim()) { setError('El hostname es requerido'); return }
    if (!form.ip.trim())       { setError('La IP es requerida');       return }
    setError(null)

    startTransition(async () => {
      const result = await createServer({
        hostname:    form.hostname.trim(),
        displayName: form.displayName.trim() || undefined,
        description: form.description.trim() || undefined,
        ip:          form.ip.trim(),
        secondaryIp: form.secondaryIp.trim() || undefined,
        os:          form.os,
        type:        form.type,
        groupId:     form.groupId || null,
        location:    form.location.trim() || undefined,
        domain:      form.domain.trim() || undefined,
        status:      form.status,
        notes:       form.notes.trim() || undefined,
        specs: (form.cpu || form.ram || form.disk) ? {
          cpu:  form.cpu  || undefined,
          ram:  form.ram  || undefined,
          disk: form.disk || undefined,
        } : undefined,
      })

      if (!result.success) { setError(result.error); return }
      router.push(`/infrastructure/servers/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="p-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}

      {/* Basic info */}
      <div
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Información Básica
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Hostname *</label>
            <input type="text" value={form.hostname} onChange={set('hostname')} placeholder="Ej: SRV-DB01" autoFocus
              className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Nombre de pantalla</label>
            <input type="text" value={form.displayName} onChange={set('displayName')} placeholder="Ej: Servidor Base de Datos"
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP Principal *</label>
            <input type="text" value={form.ip} onChange={set('ip')} placeholder="Ej: 192.168.1.10"
              className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>IP Secundaria</label>
            <input type="text" value={form.secondaryIp} onChange={set('secondaryIp')} placeholder="Ej: 10.0.0.10"
              className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Sistema Operativo *</label>
            <select value={form.os} onChange={set('os')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
              {OS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Tipo *</label>
            <select value={form.type} onChange={set('type')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Estado</label>
            <select value={form.status} onChange={set('status')} className={`${inputCls} cursor-pointer`} style={inputStyle}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Dominio (AD)</label>
            <input type="text" value={form.domain} onChange={set('domain')} placeholder="Ej: EJECUTIVO.AMDC"
              className={inputCls} style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Ubicación física</label>
            <input type="text" value={form.location} onChange={set('location')} placeholder="Ej: Sala de servidores, Rack A"
              className={inputCls} style={inputStyle} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Descripción</label>
            <input type="text" value={form.description} onChange={set('description')} placeholder="Descripción breve del servidor"
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Specs */}
      <div
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Especificaciones de Hardware
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>CPU</label>
            <input type="text" value={form.cpu} onChange={set('cpu')} placeholder="Ej: Intel Xeon E5 8 cores"
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>RAM</label>
            <input type="text" value={form.ram} onChange={set('ram')} placeholder="Ej: 32 GB DDR4"
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Almacenamiento</label>
            <input type="text" value={form.disk} onChange={set('disk')} placeholder="Ej: 2 TB RAID-1 SAS"
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div
        className="rounded p-5 space-y-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
          Notas
        </p>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={4}
          placeholder="Información adicional sobre este servidor..."
          className={inputCls}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium disabled:opacity-50 transition-all"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Server size={14} />}
          Registrar Servidor
        </button>
        <a
          href="/infrastructure/servers"
          className="px-5 py-2.5 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
