import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { ShieldCheck, Users, ChevronRight, Lock } from 'lucide-react'

export const metadata: Metadata = { title: 'Roles y Permisos' }

export default async function RolesPage() {
  const user = await getCurrentUser()

  const roles = await prisma.role.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roles y Permisos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configura qué puede hacer cada rol en el sistema
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {roles.map((role) => (
          <Link
            key={role.id}
            href={`/admin/roles/${role.id}`}
            className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 capitalize">{role.name}</span>
                {role.isSystem && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Lock className="w-3 h-3" />
                    Sistema
                  </span>
                )}
                {role.isDefault && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                    Por defecto
                  </span>
                )}
              </div>
              {role.description && (
                <p className="text-sm text-slate-500 mt-0.5 truncate">{role.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-slate-400 flex-shrink-0">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {role._count.userRoles} usuarios
              </span>
              <span>{role._count.rolePermissions} permisos</span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {roles.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay roles definidos. Ejecuta el seed para crear los roles por defecto.</p>
        </div>
      )}
    </div>
  )
}
