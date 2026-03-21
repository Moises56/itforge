'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createAsset } from '@/modules/support/actions/assets'

interface Props {
  departments: { id: string; name: string }[]
}

const S: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
                      letterSpacing: '0.15em', color: 'var(--foreground-muted)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--status-red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--foreground-dim)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
                     letterSpacing: '0.18em', color: 'var(--foreground-dim)' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export function NewAssetForm({ departments }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createAsset(fd)
      if (result.success) {
        router.push(`/support/assets`)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Identity */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" required>
          <input name="name" required placeholder="PC-SECRETARÍA-01" style={S} />
        </Field>
        <Field label="Tipo" required>
          <select name="type" required style={S}>
            <option value="DESKTOP">Computadora de escritorio</option>
            <option value="LAPTOP">Laptop</option>
            <option value="PRINTER">Impresora</option>
            <option value="SCANNER">Escáner</option>
            <option value="MONITOR">Monitor</option>
            <option value="UPS">UPS</option>
            <option value="PHONE">Teléfono</option>
            <option value="TABLET">Tablet</option>
            <option value="OTHER">Otro</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Marca">
          <input name="brand" placeholder="HP, Dell, Lenovo..." style={S} />
        </Field>
        <Field label="Modelo">
          <input name="model" placeholder="EliteBook 840, OptiPlex..." style={S} />
        </Field>
      </div>

      <Divider label="Identificación" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Número de serie">
          <input name="serialNumber" placeholder="SN12345678" style={S} />
        </Field>
        <Field label="Código patrimonial" hint="Código único de inventario institucional">
          <input name="assetTag" placeholder="MUN-2024-0042" style={S} />
        </Field>
      </div>

      <Divider label="Asignación" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Asignado a (empleado)">
          <input name="assignedToUser" placeholder="Nombre del empleado" style={S} />
        </Field>
        <Field label="Dependencia">
          <select name="assignedToDepartmentId" style={S}>
            <option value="">— Sin dependencia —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Ubicación física">
        <input name="location" placeholder="Piso 2, Oficina 204" style={S} />
      </Field>

      <Divider label="Estado y garantía" />

      <div className="grid grid-cols-3 gap-4">
        <Field label="Estado">
          <select name="status" style={S}>
            <option value="ACTIVE">Activo</option>
            <option value="IN_REPAIR">En reparación</option>
            <option value="STORAGE">En almacén</option>
            <option value="DECOMMISSIONED">Dado de baja</option>
            <option value="LOST">Perdido</option>
          </select>
        </Field>
        <Field label="Fecha de compra">
          <input name="purchaseDate" type="date" style={S} />
        </Field>
        <Field label="Garantía hasta">
          <input name="warrantyExpires" type="date" style={S} />
        </Field>
      </div>

      <Field label="Notas">
        <textarea name="notes" rows={3} placeholder="Observaciones, historial previo, etc."
                  style={{ ...S, resize: 'vertical' }} />
      </Field>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      color: 'var(--status-red)', padding: '10px 14px', borderRadius: 4, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={pending}
                className="px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}>
          {pending ? 'Guardando...' : 'Crear activo'}
        </button>
        <Link href="/support/assets"
              className="px-5 py-2.5 rounded text-sm font-medium"
              style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
