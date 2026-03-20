import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { NewUserForm } from './_components/new-user-form'

export const metadata: Metadata = { title: 'Nuevo usuario' }

export default async function NewUserPage() {
  const actor = await getCurrentUser()
  const canCreate = await resolvePermission(actor.id, 'users', 'create')
  if (!canCreate) notFound()

  const [roles, departments] = await Promise.all([
    prisma.role.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { organizationId: actor.organizationId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: 'var(--foreground-muted)' }}
      >
        <ArrowLeft size={12} />
        Volver a usuarios
      </Link>

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
            <UserPlus size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <h1
              className="text-xl font-heading font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              Nuevo usuario
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Crear una cuenta de acceso al sistema
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <NewUserForm roles={roles} departments={departments} />
    </div>
  )
}
