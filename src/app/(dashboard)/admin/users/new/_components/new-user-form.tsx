'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { createUser } from '@/modules/system/actions/users'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role       = { id: string; name: string; description: string | null; isSystem: boolean }
type Department = { id: string; name: string; code: string }

interface Props {
  roles:       Role[]
  departments: Department[]
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputSty: React.CSSProperties = {
  background: 'var(--surface-2)',
  border:     '1px solid var(--border)',
  color:      'var(--foreground)',
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--foreground-muted)' }}>
      {children} {required && <span style={{ color: 'var(--status-red)' }}>*</span>}
    </label>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewUserForm({ roles, departments }: Props) {
  const router               = useRouter()
  const [isPending, startTx] = useTransition()
  const [error, setError]    = useState<string | null>(null)
  const [showPw, setShowPw]  = useState(false)

  const [form, setForm] = useState({
    firstName:    '',
    lastName:     '',
    email:        '',
    password:     '',
    confirmPw:    '',
    departmentId: '',
    roleIds:      [] as string[],
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleRole(id: string) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id)
        ? f.roleIds.filter((r) => r !== id)
        : [...f.roleIds, id],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.firstName.trim()) return setError('El nombre es requerido')
    if (!form.lastName.trim())  return setError('El apellido es requerido')
    if (!form.email.trim())     return setError('El email es requerido')
    if (!form.password)         return setError('La contraseña es requerida')
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    if (form.password !== form.confirmPw) return setError('Las contraseñas no coinciden')

    startTx(async () => {
      const res = await createUser({
        email:        form.email.trim(),
        password:     form.password,
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        departmentId: form.departmentId || null,
        roleIds:      form.roleIds,
      })

      if (!res.success) { setError(res.error); return }
      router.push(`/admin/users/${res.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border:     '1px solid rgba(239,68,68,0.25)',
            color:      'var(--status-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Identity */}
      <section
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Información del usuario
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Nombre</FieldLabel>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              placeholder="Ej. Juan"
              className={inputCls}
              style={inputSty}
            />
          </div>
          <div>
            <FieldLabel required>Apellido</FieldLabel>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              placeholder="Ej. García"
              className={inputCls}
              style={inputSty}
            />
          </div>
        </div>

        <div>
          <FieldLabel required>Email</FieldLabel>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="usuario@organizacion.com"
            autoComplete="off"
            className={inputCls}
            style={inputSty}
          />
        </div>

        <div>
          <FieldLabel>Departamento</FieldLabel>
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
            className={inputCls}
            style={inputSty}
          >
            <option value="">Sin departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Password */}
      <section
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Contraseña
        </h2>

        <div>
          <FieldLabel required>Contraseña inicial</FieldLabel>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className={`${inputCls} pr-10`}
              style={inputSty}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              {showPw
                ? <EyeOff size={14} style={{ color: 'var(--foreground-dim)' }} />
                : <Eye    size={14} style={{ color: 'var(--foreground-dim)' }} />
              }
            </button>
          </div>
        </div>

        <div>
          <FieldLabel required>Confirmar contraseña</FieldLabel>
          <input
            type={showPw ? 'text' : 'password'}
            value={form.confirmPw}
            onChange={(e) => set('confirmPw', e.target.value)}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            className={inputCls}
            style={{
              ...inputSty,
              borderColor: form.confirmPw && form.password !== form.confirmPw
                ? 'rgba(239,68,68,0.6)'
                : 'var(--border)',
            }}
          />
          {form.confirmPw && form.password !== form.confirmPw && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--status-red)' }}>
              Las contraseñas no coinciden
            </p>
          )}
        </div>

        <div
          className="rounded px-3 py-2 text-[10px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground-dim)' }}
        >
          El usuario deberá cambiar su contraseña tras el primer inicio de sesión.
          Mínimo 8 caracteres — se recomienda usar mayúsculas, números y símbolos.
        </div>
      </section>

      {/* Roles */}
      <section
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: 'var(--accent-cyan)' }} />
          <h2
            className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Asignar roles
          </h2>
        </div>

        {roles.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>No hay roles disponibles.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {roles.map((role) => {
              const checked = form.roleIds.includes(role.id)
              return (
                <label
                  key={role.id}
                  className="flex items-start gap-3 px-3 py-3 rounded cursor-pointer transition-all"
                  style={{
                    background: checked ? 'var(--accent-cyan-dim)' : 'var(--surface-2)',
                    border:     `1px solid ${checked ? 'rgba(6,182,212,0.25)' : 'var(--border)'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(role.id)}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        className="text-sm font-semibold capitalize"
                        style={{ color: checked ? 'var(--accent-cyan)' : 'var(--foreground)' }}
                      >
                        {role.name}
                      </p>
                      {role.isSystem && (
                        <span
                          className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                        >
                          Sistema
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--foreground-dim)' }}>
                        {role.description}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded text-sm font-medium transition-all"
          style={{
            background: 'var(--surface-2)',
            border:     '1px solid var(--border)',
            color:      'var(--foreground-muted)',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-40"
          style={{
            background: 'var(--accent-cyan-dim)',
            border:     '1px solid rgba(6,182,212,0.3)',
            color:      'var(--accent-cyan)',
          }}
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Crear usuario
        </button>
      </div>
    </form>
  )
}
