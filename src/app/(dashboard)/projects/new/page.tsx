import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { CreateProjectForm } from './_components/create-project-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Nuevo Proyecto' }

export default async function NewProjectPage() {
  const user = await getCurrentUser()

  const canCreate = await resolvePermission(user.id, 'projects', 'create')
  if (!canCreate) redirect('/projects')

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where:   { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select:  { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.department.findMany({
      where:   { organizationId: user.organizationId, deletedAt: null },
      select:  { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={12} />
          Volver a proyectos
        </Link>

        <h1
          className="text-2xl font-heading font-bold uppercase tracking-wider"
          style={{ color: 'var(--foreground)' }}
        >
          Nuevo Proyecto
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
          Registra un nuevo sistema en el portafolio TI
        </p>
      </div>

      <CreateProjectForm users={users} departments={departments} />
    </div>
  )
}
