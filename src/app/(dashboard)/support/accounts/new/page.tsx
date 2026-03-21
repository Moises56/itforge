'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { createUserAccount } from '@/modules/support/actions/accounts'

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  color: 'var(--foreground-muted)',
  marginBottom: '6px',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle as React.CSSProperties}>
        {label}
        {required && <span style={{ color: 'var(--status-red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function NewAccountPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createUserAccount(fd)
      if (result.success) {
        router.push('/support/accounts')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/support/accounts" className="flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Cuentas
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nueva cuenta</span>
      </div>

      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded flex items-center justify-center"
               style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <User size={16} style={{ color: 'var(--status-purple)' }} />
          </div>
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Nueva Cuenta de Usuario
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre completo" required>
              <input name="fullName" required placeholder="Juan Pérez García" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Nombre de usuario" required>
              <input name="username" required placeholder="jperez" className={inputCls} style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dominio">
              <input name="domain" placeholder="MUNICIPALIDAD" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Correo electrónico">
              <input name="email" type="email" placeholder="jperez@muni.gob" className={inputCls} style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de cuenta" required>
              <select name="accountType" required className={inputCls} style={inputStyle}>
                <option value="DOMAIN_AD">Dominio AD</option>
                <option value="EMAIL">Correo electrónico</option>
                <option value="VPN">VPN</option>
                <option value="SYSTEM_ACCESS">Acceso a sistema</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
            <Field label="Estado">
              <select name="status" className={inputCls} style={inputStyle}>
                <option value="ACTIVE">Activa</option>
                <option value="DISABLED">Deshabilitada</option>
                <option value="EXPIRED">Expirada</option>
              </select>
            </Field>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha de creación">
              <input name="createdDate" type="date" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Fecha de expiración">
              <input name="expirationDate" type="date" className={inputCls} style={inputStyle} />
            </Field>
          </div>

          <Field label="Notas">
            <textarea name="notes" rows={3} placeholder="Permisos especiales, restricciones, etc."
                      className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          {error && (
            <div className="px-4 py-3 rounded text-sm"
                 style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--status-red)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isPending}
                    className="px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
              {isPending ? 'Guardando...' : 'Crear cuenta'}
            </button>
            <Link href="/support/accounts"
                  className="px-5 py-2.5 rounded text-sm font-medium"
                  style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}>
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
