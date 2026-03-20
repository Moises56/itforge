'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Search, Filter, X, UserCheck, UserX, ChevronRight,
  ShieldCheck, Clock, Building2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRow = {
  id:           string
  email:        string
  firstName:    string
  lastName:     string
  isActive:     boolean
  createdAt:    string
  lastLoginAt:  string | null
  department:   { id: string; name: string } | null
  roles:        Array<{ id: string; name: string }>
}

interface Props {
  users:     UserRow[]
  allRoles:  Array<{ id: string; name: string }>
  canCreate: boolean
}

// ─── Role badge colors ────────────────────────────────────────────────────────

const ROLE_COLORS = [
  { bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)',   text: 'var(--accent-cyan)' },
  { bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)',  text: '#8b5cf6' },
  { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  text: '#f59e0b' },
  { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  text: '#10b981' },
  { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444' },
]

function roleColor(idx: number) {
  return ROLE_COLORS[idx % ROLE_COLORS.length]!
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  < 2)  return 'ahora'
  if (mins  < 60) return `hace ${mins}m`
  if (hours < 24) return `hace ${hours}h`
  if (days  < 7)  return `hace ${days}d`
  if (days  < 30) return `hace ${Math.floor(days / 7)}sem`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// Avatar colors from name hash
function avatarHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UsersTable({ users, allRoles, canCreate }: Props) {
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatus]   = useState<'' | 'active' | 'inactive'>('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter((u) => {
      if (statusFilter === 'active'   && !u.isActive) return false
      if (statusFilter === 'inactive' && u.isActive)  return false
      if (roleFilter && !u.roles.some((r) => r.id === roleFilter)) return false
      if (q && !`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  const activeFilters = [roleFilter, statusFilter].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--foreground-dim)' }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
            style={{
              background: 'var(--surface)',
              border:     '1px solid var(--border)',
              color:      'var(--foreground)',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X size={11} style={{ color: 'var(--foreground-dim)' }} />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={11} style={{ color: 'var(--foreground-dim)' }} />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
            style={{
              background: 'var(--surface)',
              border:     '1px solid var(--border)',
              color:      'var(--foreground)',
            }}
          >
            <option value="">Todos los roles</option>
            {allRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value as '' | 'active' | 'inactive')}
          className="px-2.5 py-2 rounded text-xs outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          style={{
            background: 'var(--surface)',
            border:     '1px solid var(--border)',
            color:      'var(--foreground)',
          }}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => { setRoleFilter(''); setStatus('') }}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[10px] transition-all"
            style={{
              color:      'var(--status-red)',
              background: 'rgba(239,68,68,0.08)',
              border:     '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <X size={10} /> Limpiar ({activeFilters})
          </button>
        )}

        <span className="text-xs ml-auto" style={{ color: 'var(--foreground-dim)' }}>
          {filtered.length} de {users.length}
        </span>

        {canCreate && (
          <Link
            href="/admin/users/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all"
            style={{
              color:      'var(--accent-cyan)',
              background: 'var(--accent-cyan-dim)',
              border:     '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <UserCheck size={12} /> Nuevo usuario
          </Link>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          className="rounded p-10 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {users.length === 0 ? 'Sin usuarios registrados' : 'Sin resultados para los filtros actuales'}
          </p>
        </div>
      ) : (
        <div
          className="rounded overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div
            className="grid text-[9px] font-semibold uppercase tracking-wider px-4 py-2.5"
            style={{
              gridTemplateColumns: '2.5rem 1fr auto auto auto auto',
              background:          'var(--surface-2)',
              borderBottom:        '1px solid var(--border)',
              color:               'var(--foreground-dim)',
            }}
          >
            <span />
            <span>Usuario</span>
            <span className="pr-6">Departamento</span>
            <span className="pr-6">Roles</span>
            <span className="pr-6">Último acceso</span>
            <span />
          </div>

          {/* Rows */}
          <div>
            {filtered.map((user, i) => {
              const hue      = avatarHue(`${user.firstName}${user.lastName}`)
              const initStr  = initials(user.firstName, user.lastName)

              return (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="grid items-center px-4 py-3 transition-colors group"
                  style={{
                    gridTemplateColumns: '2.5rem 1fr auto auto auto auto',
                    borderTop:           i > 0 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: `hsl(${hue}, 60%, 25%)`,
                      color:      `hsl(${hue}, 80%, 70%)`,
                      border:     `1px solid hsl(${hue}, 50%, 35%)`,
                      opacity:    user.isActive ? 1 : 0.45,
                    }}
                  >
                    {initStr}
                  </div>

                  {/* Name + email */}
                  <div className="min-w-0 pl-3">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: user.isActive ? 'var(--foreground)' : 'var(--foreground-dim)' }}
                      >
                        {user.firstName} {user.lastName}
                      </p>
                      {!user.isActive && (
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--status-red)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono truncate" style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}>
                      {user.email}
                    </p>
                  </div>

                  {/* Department */}
                  <div className="pr-8 hidden sm:block">
                    {user.department ? (
                      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        <Building2 size={10} />
                        {user.department.name}
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>—</span>
                    )}
                  </div>

                  {/* Roles */}
                  <div className="pr-8 flex flex-wrap gap-1 max-w-xs">
                    {user.roles.length === 0 ? (
                      <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>Sin rol</span>
                    ) : (
                      user.roles.slice(0, 3).map((role, ri) => {
                        const c = roleColor(ri)
                        return (
                          <span
                            key={role.id}
                            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                          >
                            {role.name}
                          </span>
                        )
                      })
                    )}
                    {user.roles.length > 3 && (
                      <span className="text-[9px]" style={{ color: 'var(--foreground-dim)' }}>
                        +{user.roles.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Last login */}
                  <div className="pr-4 hidden md:block">
                    {user.lastLoginAt ? (
                      <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}>
                        <Clock size={9} />
                        {formatRelative(user.lastLoginAt)}
                      </div>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>Nunca</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <div>
                    <ChevronRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--accent-cyan)' }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
