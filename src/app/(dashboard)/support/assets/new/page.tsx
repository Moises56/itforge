import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Monitor } from 'lucide-react'
import { NewAssetForm } from './_components/new-asset-form'

export const metadata: Metadata = { title: 'Nuevo Activo' }

export default async function NewAssetPage() {
  const user = await getCurrentUser()

  const departments = await prisma.department.findMany({
    where:   { organizationId: user.organizationId, deletedAt: null },
    orderBy: { name: 'asc' },
    select:  { id: true, name: true },
  })

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/support/assets" className="flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Activos
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nuevo activo</span>
      </div>

      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded flex items-center justify-center"
               style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Monitor size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Nuevo Activo TI
          </h1>
        </div>
        <div className="p-6">
          <NewAssetForm departments={departments} />
        </div>
      </div>
    </div>
  )
}
