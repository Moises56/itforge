'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { createRole } from '@/modules/system/actions/roles'

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}

export default function NewRolePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createRole(fd)
      if (result.success) {
        router.push(`/admin/roles/${result.id}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="max-w-lg">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/roles"
          className="flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={14} /> Roles
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nuevo rol</span>
      </div>

      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Nuevo Rol
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Nombre del rol <span style={{ color: 'var(--status-red)' }}>*</span>
            </label>
            <input
              name="name"
              required
              placeholder="Ej: soporte_tecnico"
              className={inputCls}
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
              Usa letras minúsculas, números y guiones bajos.
            </p>
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Descripción
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Describe qué puede hacer este rol..."
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded text-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--status-red)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {isPending ? 'Creando...' : 'Crear rol'}
            </button>
            <Link
              href="/admin/roles"
              className="px-5 py-2.5 rounded text-sm font-medium"
              style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
