'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createNetworkEquipment } from '@/modules/infrastructure/actions/network'

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

const TYPE_OPTIONS = [
  { value: 'SWITCH',       label: 'Switch'        },
  { value: 'ROUTER',       label: 'Router'        },
  { value: 'ACCESS_POINT', label: 'Access Point'  },
  { value: 'FIREWALL',     label: 'Firewall'      },
  { value: 'UPS',          label: 'UPS'           },
  { value: 'OTHER',        label: 'Otro'          },
]

const STATUS_OPTIONS = [
  { value: 'ACTIVE',      label: 'Activo'          },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'INACTIVE',    label: 'Inactivo'        },
]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={labelStyle}>
        {label}
        {required && <span style={{ color: 'var(--status-red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export function CreateNetworkForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const input = {
      name:          fd.get('name')          as string,
      type:          fd.get('type')          as 'SWITCH' | 'ROUTER' | 'ACCESS_POINT' | 'FIREWALL' | 'UPS' | 'OTHER',
      brand:         (fd.get('brand')        as string) || undefined,
      model:         (fd.get('model')        as string) || undefined,
      ip:            (fd.get('ip')           as string) || undefined,
      location:      (fd.get('location')     as string) || undefined,
      managementUrl: (fd.get('managementUrl') as string) || undefined,
      totalPorts:    fd.get('totalPorts') ? parseInt(fd.get('totalPorts') as string, 10) : undefined,
      firmware:      (fd.get('firmware')     as string) || undefined,
      status:        (fd.get('status')       as 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE') || 'ACTIVE',
      notes:         (fd.get('notes')        as string) || undefined,
    }
    startTransition(async () => {
      const result = await createNetworkEquipment(input)
      if (result.success) {
        router.push(`/infrastructure/network/${result.data.id}`)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" required>
          <input name="name" required placeholder="Ej: SW-CORE-01" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Tipo" required>
          <select name="type" required className={inputCls} style={inputStyle}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Marca">
          <input name="brand" placeholder="Cisco, HP, Mikrotik..." className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Modelo">
          <input name="model" placeholder="Catalyst 2960, RB450..." className={inputCls} style={inputStyle} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dirección IP">
          <input name="ip" placeholder="192.168.1.1" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Total de puertos">
          <input name="totalPorts" type="number" min={1} max={9999} placeholder="24" className={inputCls} style={inputStyle} />
        </Field>
      </div>

      <Field label="URL de gestión">
        <input name="managementUrl" type="url" placeholder="https://192.168.1.1" className={inputCls} style={inputStyle} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ubicación">
          <input name="location" placeholder="Rack 2 - Piso 3" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Firmware">
          <input name="firmware" placeholder="15.2(4)E7" className={inputCls} style={inputStyle} />
        </Field>
      </div>

      <Field label="Estado" required>
        <select name="status" className={inputCls} style={inputStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <Field label="Notas">
        <textarea name="notes" rows={3} placeholder="Información adicional..."
                  className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      {error && (
        <div className="px-4 py-3 rounded text-sm"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? 'Guardando...' : 'Crear equipo'}
        </button>
        <a
          href="/infrastructure/network"
          className="px-5 py-2.5 rounded text-sm font-medium"
          style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
