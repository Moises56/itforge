'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, ShieldCheck, Lock, Monitor,
  Loader2, Eye, EyeOff, CheckSquare, Square, Minus,
  AlertTriangle, LogOut, Trash2, Building2, Calendar,
  Clock, Globe, Save,
} from 'lucide-react'
import {
  updateUser,
  toggleUserActive,
  assignRoles,
  saveUserOverrides,
  destroyUserSessions,
} from '@/modules/system/actions/users'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = { id: string; name: string; description: string | null; isSystem: boolean }
type Department = { id: string; name: string; code: string }
type ResourceAction = { id: string; action: { code: string; name: string } }
type Resource = {
  id: string; code: string; name: string; module: string
  resourceActions: ResourceAction[]
}
type Session = {
  id: string; ipAddress: string | null; userAgent: string | null
  createdAt: string; expiresAt: string; isExpired: boolean
}

interface Props {
  user: {
    id:           string
    firstName:    string
    lastName:     string
    email:        string
    isActive:     boolean
    createdAt:    string
    departmentId: string | null
    department:   { id: string; name: string } | null
    roles:        Role[]
  }
  allRoles:        Role[]
  departments:     Department[]
  resources:       Resource[]
  roleEffectiveIds: string[]   // resourceActionIds granted by assigned roles
  overrides:       Array<{ resourceActionId: string; allowed: boolean }>
  sessions:        Session[]
  canEdit:         boolean
  isSelf:          boolean
}

type TabKey = 'info' | 'roles' | 'permisos' | 'sesiones'

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

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded p-5 space-y-4 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
      style={{ color: 'var(--foreground-muted)' }}
    >
      {children}
    </h2>
  )
}

// ─── Permission matrix action columns ─────────────────────────────────────────

const ACTION_COLUMNS = [
  { code: 'view',          label: 'Ver'    },
  { code: 'create',        label: 'Crear'  },
  { code: 'edit',          label: 'Editar' },
  { code: 'delete',        label: 'Eliminar' },
  { code: 'reveal',        label: 'Revelar' },
  { code: 'change_status', label: 'Estado' },
  { code: 'export',        label: 'Export' },
]

const MODULE_LABELS: Record<string, string> = {
  DEVELOPMENT:    'Módulo: Desarrollo',
  INFRASTRUCTURE: 'Módulo: Infraestructura',
  SUPPORT:        'Módulo: Soporte',
  SYSTEM:         'Módulo: Sistema',
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────

function InfoTab({
  user, departments, canEdit, isSelf,
}: Pick<Props, 'user' | 'departments' | 'canEdit' | 'isSelf'>) {
  const router = useRouter()
  const [isPending, startTx] = useTransition()
  const [error, setError]    = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPw, setShowPw]  = useState(false)

  const [form, setForm] = useState({
    firstName:    user.firstName,
    lastName:     user.lastName,
    email:        user.email,
    departmentId: user.departmentId ?? '',
    newPassword:  '',
    confirmPw:    '',
  })

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
    setError(null)
    setSuccess(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.firstName.trim()) return setError('El nombre es requerido')
    if (!form.lastName.trim())  return setError('El apellido es requerido')
    if (!form.email.trim())     return setError('El email es requerido')
    if (form.newPassword && form.newPassword.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    if (form.newPassword && form.newPassword !== form.confirmPw) return setError('Las contraseñas no coinciden')

    startTx(async () => {
      const res = await updateUser({
        id:           user.id,
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        email:        form.email.trim(),
        departmentId: form.departmentId || null,
        newPassword:  form.newPassword || null,
      })
      if (!res.success) { setError(res.error); return }
      setSuccess('Cambios guardados correctamente')
      setForm((f) => ({ ...f, newPassword: '', confirmPw: '' }))
    })
  }

  function handleToggleActive() {
    startTx(async () => {
      const res = await toggleUserActive(user.id, !user.isActive)
      if (!res.success) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Feedback */}
      {error && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--status-green)' }}
        >
          {success}
        </div>
      )}

      {/* Status chip */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Estado de la cuenta</SectionTitle>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full"
                style={
                  user.isActive
                    ? { background: 'rgba(16,185,129,0.1)', color: 'var(--status-green)', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: 'rgba(239,68,68,0.1)', color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)' }
                }
              >
                {user.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
                Creado {new Date(user.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
          {canEdit && !isSelf && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40"
              style={
                user.isActive
                  ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }
                  : { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--status-green)' }
              }
            >
              {user.isActive ? <><AlertTriangle size={12} /> Desactivar</> : <><User size={12} /> Activar</>}
            </button>
          )}
        </div>
        {!user.isActive && (
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
            El usuario no puede iniciar sesión mientras esté inactivo.
          </p>
        )}
      </SectionCard>

      {/* Identity */}
      <SectionCard>
        <SectionTitle>Información personal</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel required>Nombre</FieldLabel>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              disabled={!canEdit}
              className={inputCls}
              style={{ ...inputSty, opacity: canEdit ? 1 : 0.6 }}
            />
          </div>
          <div>
            <FieldLabel required>Apellido</FieldLabel>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              disabled={!canEdit}
              className={inputCls}
              style={{ ...inputSty, opacity: canEdit ? 1 : 0.6 }}
            />
          </div>
        </div>

        <div>
          <FieldLabel required>Email</FieldLabel>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            disabled={!canEdit}
            className={inputCls}
            style={{ ...inputSty, opacity: canEdit ? 1 : 0.6, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>

        <div>
          <FieldLabel>Departamento</FieldLabel>
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
            disabled={!canEdit}
            className={inputCls}
            style={{ ...inputSty, opacity: canEdit ? 1 : 0.6 }}
          >
            <option value="">Sin departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      {/* Password */}
      {canEdit && (
        <SectionCard>
          <SectionTitle>Cambiar contraseña</SectionTitle>
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
            Deja en blanco para conservar la contraseña actual.
          </p>

          <div>
            <FieldLabel>Nueva contraseña</FieldLabel>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => set('newPassword', e.target.value)}
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

          {form.newPassword && (
            <div>
              <FieldLabel>Confirmar nueva contraseña</FieldLabel>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.confirmPw}
                onChange={(e) => set('confirmPw', e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className={inputCls}
                style={{
                  ...inputSty,
                  borderColor: form.confirmPw && form.newPassword !== form.confirmPw
                    ? 'rgba(239,68,68,0.6)' : 'var(--border)',
                }}
              />
              {form.confirmPw && form.newPassword !== form.confirmPw && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--status-red)' }}>Las contraseñas no coinciden</p>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex justify-end pb-6">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--accent-cyan)' }}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            <Save size={14} />
            Guardar cambios
          </button>
        </div>
      )}
    </form>
  )
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab({
  userId, userRoles, allRoles, canEdit,
}: { userId: string; userRoles: Role[]; allRoles: Role[]; canEdit: boolean }) {
  const router = useRouter()
  const [isPending, startTx] = useTransition()
  const [error, setError]    = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set(userRoles.map((r) => r.id)))
  const [saved, setSaved] = useState(false)

  function toggle(id: string) {
    if (!canEdit) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    startTx(async () => {
      const res = await assignRoles({ userId, roleIds: Array.from(selected) })
      if (!res.success) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}
      {saved && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--status-green)' }}
        >
          Roles actualizados correctamente
        </div>
      )}

      <SectionCard>
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: 'var(--accent-cyan)' }} />
          <SectionTitle>Roles asignados</SectionTitle>
        </div>
        <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
          Los permisos efectivos son la unión de todos los roles asignados. Los overrides directos toman precedencia.
        </p>

        {allRoles.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>No hay roles disponibles.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {allRoles.map((role) => {
              const checked = selected.has(role.id)
              return (
                <label
                  key={role.id}
                  className="flex items-start gap-3 px-3 py-3 rounded cursor-pointer transition-all"
                  style={{
                    background: checked ? 'var(--accent-cyan-dim)' : 'var(--surface-2)',
                    border:     `1px solid ${checked ? 'rgba(6,182,212,0.25)' : 'var(--border)'}`,
                    cursor:     canEdit ? 'pointer' : 'default',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(role.id)}
                    disabled={!canEdit}
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

        {canEdit && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--accent-cyan)' }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              <Save size={14} />
              Guardar roles
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Permissions Override Tab ─────────────────────────────────────────────────

type OverrideValue = 'allow' | 'deny' | 'inherit'

function PermissionsTab({
  userId, resources, roleEffectiveIds, overrides, canEdit,
}: {
  userId:          string
  resources:       Resource[]
  roleEffectiveIds: string[]
  overrides:       Array<{ resourceActionId: string; allowed: boolean }>
  canEdit:         boolean
}) {
  const router = useRouter()
  const [isPending, startTx] = useTransition()
  const [error, setError]    = useState<string | null>(null)
  const [saved, setSaved]    = useState(false)

  // Map: resourceActionId → override value
  const [localOverrides, setLocalOverrides] = useState<Map<string, OverrideValue>>(() => {
    const m = new Map<string, OverrideValue>()
    overrides.forEach((o) => m.set(o.resourceActionId, o.allowed ? 'allow' : 'deny'))
    return m
  })

  const roleSet = new Set(roleEffectiveIds)

  function cycleOverride(raId: string) {
    if (!canEdit) return
    setLocalOverrides((prev) => {
      const next = new Map(prev)
      const current = next.get(raId) ?? 'inherit'
      // cycle: inherit → allow → deny → inherit
      if (current === 'inherit') next.set(raId, 'allow')
      else if (current === 'allow') next.set(raId, 'deny')
      else next.delete(raId)
      return next
    })
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    startTx(async () => {
      const overrideArr: Array<{ resourceActionId: string; allowed: boolean }> = []
      localOverrides.forEach((val, raId) => {
        if (val === 'allow') overrideArr.push({ resourceActionId: raId, allowed: true })
        else if (val === 'deny') overrideArr.push({ resourceActionId: raId, allowed: false })
      })
      const res = await saveUserOverrides({ userId, overrides: overrideArr })
      if (!res.success) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  // Group resources by module
  const byModule = new Map<string, Resource[]>()
  for (const r of resources) {
    const list = byModule.get(r.module) ?? []
    list.push(r)
    byModule.set(r.module, list)
  }

  // Build resource → action lookup
  const raLookup = new Map<string, Map<string, string>>()
  for (const r of resources) {
    const m = new Map<string, string>()
    r.resourceActions.forEach((ra) => m.set(ra.action.code, ra.id))
    raLookup.set(r.id, m)
  }

  function renderCell(raId: string | undefined) {
    if (!raId) return <td className="py-3 px-2 text-center" key="empty"><span style={{ color: 'var(--border)' }}>—</span></td>

    const overrideVal = localOverrides.get(raId) ?? 'inherit'
    const fromRole    = roleSet.has(raId)

    // Effective = override takes precedence, else role
    const effective = overrideVal === 'allow' ? true
                    : overrideVal === 'deny'  ? false
                    : fromRole

    let icon: React.ReactNode
    let title: string
    let cellColor: string

    if (overrideVal !== 'inherit') {
      // Has explicit override
      if (overrideVal === 'allow') {
        icon = <CheckSquare size={16} />
        title = 'Override: Permitir — click para denegar'
        cellColor = 'var(--accent-cyan)'
      } else {
        icon = <Trash2 size={16} />
        title = 'Override: Denegar — click para heredar'
        cellColor = 'var(--status-red)'
      }
    } else if (fromRole) {
      // Granted by role (read-only indicator)
      icon = <CheckSquare size={16} />
      title = 'Heredado del rol'
      cellColor = 'rgba(100,116,139,0.5)'
    } else {
      icon = <Square size={16} />
      title = canEdit ? 'Sin permiso — click para añadir override' : 'Sin permiso'
      cellColor = 'var(--border)'
    }

    return (
      <td key={raId} className="py-3 px-2 text-center">
        <button
          type="button"
          title={title}
          disabled={!canEdit}
          onClick={() => cycleOverride(raId)}
          className="inline-flex items-center justify-center w-7 h-7 rounded transition-all"
          style={{
            color:  cellColor,
            cursor: canEdit ? 'pointer' : 'default',
            background: overrideVal !== 'inherit' ? `${cellColor}15` : 'transparent',
            border: overrideVal !== 'inherit' ? `1px solid ${cellColor}40` : '1px solid transparent',
          }}
        >
          {icon}
        </button>
      </td>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}
      {saved && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--status-green)' }}
        >
          Overrides guardados correctamente
        </div>
      )}

      {/* Legend */}
      <div
        className="rounded p-3 flex flex-wrap gap-4 text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
          <CheckSquare size={12} style={{ color: 'rgba(100,116,139,0.5)' }} />
          Heredado del rol (solo lectura)
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
          <CheckSquare size={12} style={{ color: 'var(--accent-cyan)' }} />
          Override: Permitir
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
          <Trash2 size={12} style={{ color: 'var(--status-red)' }} />
          Override: Denegar
        </span>
        {canEdit && (
          <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground-dim)' }}>
            Click en celda para ciclar: sin override → permitir → denegar → sin override
          </span>
        )}
      </div>

      {/* Matrix table */}
      <div
        className="rounded overflow-hidden overflow-x-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left py-3 px-4 text-[9px] font-semibold uppercase tracking-wider w-56"
                style={{ color: 'var(--foreground-dim)' }}
              >
                Recurso
              </th>
              {ACTION_COLUMNS.map((col) => (
                <th
                  key={col.code}
                  className="py-3 px-2 text-[9px] font-semibold uppercase tracking-wider text-center min-w-[72px]"
                  style={{ color: 'var(--foreground-dim)' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(byModule.entries()).map(([module, moduleResources]) => (
              <>
                <tr
                  key={`module-${module}`}
                  style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}
                >
                  <td
                    colSpan={1 + ACTION_COLUMNS.length}
                    className="py-2 px-4 text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--foreground-dim)' }}
                  >
                    {MODULE_LABELS[module] ?? module}
                  </td>
                </tr>
                {moduleResources.map((resource) => (
                  <tr
                    key={resource.id}
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                        {resource.name}
                      </p>
                      <p
                        className="text-[10px] font-mono"
                        style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
                      >
                        {resource.code}
                      </p>
                    </td>
                    {ACTION_COLUMNS.map((col) => {
                      const actionMap = raLookup.get(resource.id)
                      const raId = actionMap?.get(col.code)
                      return renderCell(raId)
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>

        {canEdit && (
          <div
            className="flex items-center justify-end px-4 py-3"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--accent-cyan)' }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              <Save size={14} />
              Guardar overrides
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab({
  userId, sessions, canEdit,
}: { userId: string; sessions: Session[]; canEdit: boolean }) {
  const router = useRouter()
  const [isPending, startTx] = useTransition()
  const [error, setError]    = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleDestroyAll() {
    startTx(async () => {
      const res = await destroyUserSessions(userId)
      if (!res.success) { setError(res.error); return }
      setSuccess('Todas las sesiones han sido cerradas')
      router.refresh()
    })
  }

  function parseUA(ua: string | null): string {
    if (!ua) return 'Agente desconocido'
    const chromeVer  = ua.match(/Chrome\/([\d.]+)/)
    const firefoxVer = ua.match(/Firefox\/([\d.]+)/)
    if (ua.includes('Chrome'))  return `Chrome${chromeVer?.[1]  ? ` ${chromeVer[1].split('.')[0]}`  : ''}`
    if (ua.includes('Firefox')) return `Firefox${firefoxVer?.[1] ? ` ${firefoxVer[1].split('.')[0]}` : ''}`
    if (ua.includes('Safari'))  return 'Safari'
    return ua.slice(0, 40)
  }

  const activeSessions = sessions.filter((s) => !s.isExpired)

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="px-4 py-3 rounded text-sm"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--status-green)' }}
        >
          {success}
        </div>
      )}

      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Sesiones activas</SectionTitle>
            <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
              {activeSessions.length} sesión{activeSessions.length !== 1 ? 'es' : ''} activa{activeSessions.length !== 1 ? 's' : ''}
              {' '}· {sessions.length} en total
            </p>
          </div>
          {canEdit && sessions.length > 0 && (
            <button
              type="button"
              onClick={handleDestroyAll}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all disabled:opacity-40"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border:     '1px solid rgba(239,68,68,0.25)',
                color:      'var(--status-red)',
              }}
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              <LogOut size={12} />
              Cerrar todas
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div
            className="rounded p-6 text-center"
            style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
          >
            <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin sesiones registradas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 px-3 py-3 rounded"
                style={{
                  background: 'var(--surface-2)',
                  border: `1px solid ${session.isExpired ? 'var(--border)' : 'rgba(6,182,212,0.15)'}`,
                  opacity: session.isExpired ? 0.6 : 1,
                }}
              >
                <Monitor
                  size={16}
                  style={{ color: session.isExpired ? 'var(--foreground-dim)' : 'var(--accent-cyan)', flexShrink: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                      {parseUA(session.userAgent)}
                    </p>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={
                        session.isExpired
                          ? { background: 'rgba(100,116,139,0.1)', color: 'var(--foreground-dim)', border: '1px solid var(--border)' }
                          : { background: 'rgba(16,185,129,0.1)', color: 'var(--status-green)', border: '1px solid rgba(16,185,129,0.2)' }
                      }
                    >
                      {session.isExpired ? 'Expirada' : 'Activa'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {session.ipAddress && (
                      <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}>
                        <Globe size={9} />
                        {session.ipAddress}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--foreground-dim)' }}>
                      <Calendar size={9} />
                      {new Date(session.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--foreground-dim)' }}>
                      <Clock size={9} />
                      Expira {new Date(session.expiresAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function UserDetailTabs({
  user, allRoles, departments, resources,
  roleEffectiveIds, overrides, sessions,
  canEdit, isSelf,
}: Props) {
  const [tab, setTab] = useState<TabKey>('info')

  // Build initials + avatar hue
  function avatarHue(name: string): number {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return h % 360
  }

  const hue   = avatarHue(`${user.firstName}${user.lastName}`)
  const inits = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'info',     label: 'Información', icon: <User size={13} /> },
    { key: 'roles',    label: 'Roles',       icon: <ShieldCheck size={13} /> },
    { key: 'permisos', label: 'Permisos directos', icon: <Lock size={13} /> },
    { key: 'sesiones', label: 'Sesiones',    icon: <Monitor size={13} /> },
  ]

  return (
    <div className="space-y-4">
      {/* User header card */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
            style={{
              background: `hsl(${hue}, 60%, 25%)`,
              color:      `hsl(${hue}, 80%, 70%)`,
              border:     `2px solid hsl(${hue}, 50%, 35%)`,
              opacity:    user.isActive ? 1 : 0.5,
            }}
          >
            {inits}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
                {user.firstName} {user.lastName}
              </h1>
              {!user.isActive && (
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  Inactivo
                </span>
              )}
            </div>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
            >
              {user.email}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {user.department && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <Building2 size={10} />
                  {user.department.name}
                </span>
              )}
              {user.roles.length > 0 && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  <ShieldCheck size={10} />
                  {user.roles.map((r) => r.name).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="rounded overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all"
              style={{
                color:        tab === t.key ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                borderBottom: tab === t.key ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                background:   'transparent',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'info' && (
            <InfoTab user={user} departments={departments} canEdit={canEdit} isSelf={isSelf} />
          )}
          {tab === 'roles' && (
            <RolesTab userId={user.id} userRoles={user.roles} allRoles={allRoles} canEdit={canEdit} />
          )}
          {tab === 'permisos' && (
            <PermissionsTab
              userId={user.id}
              resources={resources}
              roleEffectiveIds={roleEffectiveIds}
              overrides={overrides}
              canEdit={canEdit}
            />
          )}
          {tab === 'sesiones' && (
            <SessionsTab userId={user.id} sessions={sessions} canEdit={canEdit} />
          )}
        </div>
      </div>
    </div>
  )
}
