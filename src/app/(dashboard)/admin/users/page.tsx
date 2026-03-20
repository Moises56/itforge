import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { UsersTable } from './_components/users-table'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsersPage() {
  const actor = await getCurrentUser()
  const canView = await resolvePermission(actor.id, 'users', 'view')
  if (!canView) notFound()

  const [users, roles, lastSessions] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt:      null,
      },
      include: {
        department: { select: { id: true, name: true } },
        userRoles:  { include: { role: { select: { id: true, name: true } } } },
      },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.role.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Most recent session per user (as "last login")
    prisma.session.findMany({
      where: { organizationId: actor.organizationId },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    }),
  ])

  const canCreate = await resolvePermission(actor.id, 'users', 'create')

  const lastLoginMap = new Map(lastSessions.map((s) => [s.userId, s.createdAt.toISOString()]))

  const userRows = users.map((u) => ({
    id:          u.id,
    email:       u.email,
    firstName:   u.firstName,
    lastName:    u.lastName,
    isActive:    u.isActive,
    createdAt:   u.createdAt.toISOString(),
    lastLoginAt: lastLoginMap.get(u.id) ?? null,
    department:  u.department ?? null,
    roles:       u.userRoles.map((ur) => ({ id: ur.role.id, name: ur.role.name })),
  }))

  const roleItems = roles.map((r) => ({ id: r.id, name: r.name }))

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <Users size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <h1
              className="text-2xl font-heading font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              Usuarios
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''} ·{' '}
              {users.filter((u) => u.isActive).length} activo{users.filter((u) => u.isActive).length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Table (client for search/filter) */}
      <UsersTable
        users={userRows}
        allRoles={roleItems}
        canCreate={canCreate}
      />
    </div>
  )
}
