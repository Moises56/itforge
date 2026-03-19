import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { PermissionMatrix } from './_components/permission-matrix'
import { ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const role = await prisma.role.findUnique({ where: { id }, select: { name: true } })
  return { title: role ? `Rol: ${role.name}` : 'Rol no encontrado' }
}

export default async function RoleDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()

  // Load role with current permissions
  const role = await prisma.role.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      rolePermissions: { select: { resourceActionId: true } },
    },
  })
  if (!role) notFound()

  // Load all resources + their valid actions for the matrix
  const resources = await prisma.resource.findMany({
    include: {
      resourceActions: {
        include: { action: true },
        orderBy: { action: { code: 'asc' } },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const allowedIds = new Set(role.rolePermissions.map((p) => p.resourceActionId))

  const isOwner = user.roles.includes('owner')
  const canEdit = isOwner || (!role.isSystem && user.roles.includes('admin'))

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Link
          href="/admin/roles"
          className="mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 capitalize">{role.name}</h1>
            {role.isSystem && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" />
                Rol del sistema
              </span>
            )}
          </div>
          {role.description && (
            <p className="text-sm text-slate-500 mt-0.5">{role.description}</p>
          )}
          {!canEdit && (
            <p className="text-xs text-amber-600 mt-1">
              Solo el rol <strong>owner</strong> puede modificar roles del sistema.
            </p>
          )}
        </div>
      </div>

      {/* Matrix */}
      <PermissionMatrix
        roleId={role.id}
        resources={resources}
        allowedIds={allowedIds}
        canEdit={canEdit}
      />
    </div>
  )
}
