import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { ShieldCheck, ChevronRight, Lock, Plus, Crown } from 'lucide-react'

export const metadata: Metadata = { title: 'Roles y Permisos' }

const ROLE_COLORS: Record<string, { accent: string; bg: string }> = {
  owner:     { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  admin:     { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
  developer: { accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)'   },
  dba:       { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)'  },
  viewer:    { accent: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

function getRoleColor(name: string) {
  return ROLE_COLORS[name.toLowerCase()] ?? { accent: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)' }
}

export default async function RolesPage() {
  const user = await getCurrentUser()

  const roles = await prisma.role.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const systemRoles = roles.filter(r => r.isSystem)
  const customRoles = roles.filter(r => !r.isSystem)

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Roles y Permisos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            Configura qué puede hacer cada rol en el sistema
          </p>
        </div>
        <Link
          href="/admin/roles/new"
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={14} /> Nuevo Rol
        </Link>
      </div>

      {/* System roles */}
      {systemRoles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] flex items-center gap-2"
             style={{ color: 'var(--foreground-dim)' }}>
            <Lock size={10} /> Roles del Sistema
          </p>
          {systemRoles.map(role => {
            const { accent, bg } = getRoleColor(role.name)
            return (
              <Link
                key={role.id}
                href={`/admin/roles/${role.id}`}
                className="flex items-center gap-4 p-4 rounded transition-all group hover:border-[var(--border-bright)]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center"
                     style={{ background: bg, border: `1px solid ${accent}30` }}>
                  <ShieldCheck className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm capitalize"
                          style={{ color: accent }}>
                      {role.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--status-amber)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <Lock className="w-2.5 h-2.5" /> Sistema
                    </span>
                    {role.isDefault && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                            style={{ background: 'var(--surface-2)', color: 'var(--foreground-dim)', border: '1px solid var(--border)' }}>
                        Por defecto
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--foreground-muted)' }}>{role.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-heading font-bold" style={{ color: accent }}>{role._count.userRoles}</p>
                    <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>usuarios</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-heading font-bold" style={{ color: 'var(--foreground-muted)' }}>{role._count.rolePermissions}</p>
                    <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>permisos</p>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                                style={{ color: 'var(--foreground-dim)' }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Custom roles */}
      {customRoles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] flex items-center gap-2"
             style={{ color: 'var(--foreground-dim)' }}>
            <Crown size={10} /> Roles Personalizados
          </p>
          {customRoles.map(role => (
            <Link
              key={role.id}
              href={`/admin/roles/${role.id}`}
              className="flex items-center gap-4 p-4 rounded transition-all group hover:border-[var(--border-bright)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center"
                   style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}>
                <ShieldCheck className="w-5 h-5" style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm capitalize" style={{ color: 'var(--foreground)' }}>{role.name}</p>
                {role.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--foreground-muted)' }}>{role.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-heading font-bold" style={{ color: 'var(--accent-cyan)' }}>{role._count.userRoles}</p>
                  <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>usuarios</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-heading font-bold" style={{ color: 'var(--foreground-muted)' }}>{role._count.rolePermissions}</p>
                  <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>permisos</p>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                              style={{ color: 'var(--foreground-dim)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {roles.length === 0 && (
        <div className="py-16 text-center rounded" style={{ border: '1px dashed var(--border)' }}>
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>
            No hay roles definidos. Ejecuta el seed para crear los roles por defecto.
          </p>
        </div>
      )}
    </div>
  )
}
