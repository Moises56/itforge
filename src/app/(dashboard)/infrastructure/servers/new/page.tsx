import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CreateServerForm } from './_components/create-server-form'

export const metadata: Metadata = { title: 'Nuevo Servidor' }

export default async function NewServerPage() {
  const user = await getCurrentUser()

  const canCreate = await resolvePermission(user.id, 'infrastructure.servers', 'create')
  if (!canCreate) redirect('/infrastructure/servers')

  const groups = await prisma.serverGroup.findMany({
    where:   { organizationId: user.organizationId },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/infrastructure/servers"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={14} /> Servidores
        </Link>
        <span style={{ color: 'var(--foreground-dim)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nuevo Servidor</span>
      </div>

      <div
        className="rounded overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-1 w-full" style={{ background: 'var(--accent)' }} />
        <div className="px-6 py-5">
          <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
            Registrar Servidor
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Agrega un nuevo servidor al inventario de infraestructura
          </p>
        </div>
      </div>

      <CreateServerForm groups={groups} />
    </div>
  )
}
