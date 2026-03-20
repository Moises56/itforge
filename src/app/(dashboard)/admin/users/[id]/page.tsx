import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { UserDetailTabs } from './_components/user-detail-tabs'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  })
  if (!user) return { title: 'Usuario no encontrado' }
  return { title: `${user.firstName} ${user.lastName}` }
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const actor = await getCurrentUser()
  const canView = await resolvePermission(actor.id, 'users', 'view')
  if (!canView) notFound()

  const [user, roles, resources, sessions, canEdit] = await Promise.all([
    // Full user data
    prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true, code: true } },
        userRoles: {
          include: { role: { select: { id: true, name: true, description: true, isSystem: true } } },
        },
        userPermissionOverrides: {
          include: {
            resourceAction: {
              include: { resource: true, action: true },
            },
          },
        },
      },
    }),
    // All org roles for role management
    prisma.role.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: 'asc' },
    }),
    // All resources + actions for the permission override matrix
    prisma.resource.findMany({
      include: {
        resourceActions: {
          include: { action: true },
          orderBy: { action: { code: 'asc' } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    // Active sessions for this user
    prisma.session.findMany({
      where: { userId: id, organizationId: actor.organizationId },
      select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    resolvePermission(actor.id, 'users', 'edit'),
  ])

  if (!user) notFound()

  // Compute role-effective permissions (union across all assigned roles)
  const roleEffectiveSet = new Set<string>() // resourceActionIds granted by roles
  if (user.userRoles.length > 0) {
    const roleIds = user.userRoles.map((ur) => ur.role.id)
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds }, allowed: true },
      select: { resourceActionId: true },
    })
    rolePermissions.forEach((rp) => roleEffectiveSet.add(rp.resourceActionId))
  }

  // Departments for editing
  const departments = await prisma.department.findMany({
    where: { organizationId: actor.organizationId, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })

  const now = new Date()

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: 'var(--foreground-muted)' }}
      >
        <ArrowLeft size={12} />
        Volver a usuarios
      </Link>

      {/* Tabs */}
      <UserDetailTabs
        user={{
          id:           user.id,
          firstName:    user.firstName,
          lastName:     user.lastName,
          email:        user.email,
          isActive:     user.isActive,
          createdAt:    user.createdAt.toISOString(),
          departmentId: user.department?.id ?? null,
          department:   user.department ?? null,
          roles:        user.userRoles.map((ur) => ur.role),
        }}
        allRoles={roles}
        departments={departments}
        resources={resources.map((r) => ({
          id:   r.id,
          code: r.code,
          name: r.name,
          module: r.module,
          resourceActions: r.resourceActions.map((ra) => ({
            id:     ra.id,
            action: { code: ra.action.code, name: ra.action.name },
          })),
        }))}
        roleEffectiveIds={Array.from(roleEffectiveSet)}
        overrides={user.userPermissionOverrides.map((o) => ({
          resourceActionId: o.resourceActionId,
          allowed:          o.allowed,
        }))}
        sessions={sessions.map((s) => ({
          id:        s.id,
          ipAddress: s.ipAddress ?? null,
          userAgent: s.userAgent ?? null,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
          isExpired: s.expiresAt < now,
        }))}
        canEdit={canEdit}
        isSelf={actor.id === user.id}
      />
    </div>
  )
}
