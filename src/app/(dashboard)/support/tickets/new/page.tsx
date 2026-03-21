import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { NewTicketForm } from './_components/new-ticket-form'

export const metadata: Metadata = { title: 'Nuevo Ticket' }

export default async function NewTicketPage() {
  const user = await getCurrentUser()

  const [departments, assets, projects, servers, users] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, status: { notIn: ['DECOMMISSIONED', 'LOST'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, assetTag: true },
    }),
    prisma.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.server.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { hostname: 'asc' },
      select: { id: true, hostname: true, displayName: true, ip: true },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, isActive: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/support/tickets" className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Tickets
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nuevo Ticket</span>
      </div>

      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Nuevo Ticket de Soporte
          </h1>
        </div>
        <div className="p-6">
          <NewTicketForm
            departments={departments}
            assets={assets}
            projects={projects}
            servers={servers}
            users={users}
            organizationId={user.organizationId}
          />
        </div>
      </div>
    </div>
  )
}
