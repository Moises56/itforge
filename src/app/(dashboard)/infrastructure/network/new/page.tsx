import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { ArrowLeft, Network } from 'lucide-react'
import { CreateNetworkForm } from './_components/create-network-form'

export const metadata: Metadata = { title: 'Nuevo Equipo de Red' }

export default async function NewNetworkPage() {
  const user = await getCurrentUser()

  const canCreate = await resolvePermission(user.id, 'infrastructure.network', 'create')
  if (!canCreate) redirect('/infrastructure/network')

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/infrastructure/network"
          className="flex items-center gap-1.5 text-sm transition-colors hover:text-[var(--foreground)]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={14} /> Equipos de Red
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nuevo equipo</span>
      </div>

      {/* Card */}
      <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <Network size={16} style={{ color: 'var(--status-purple)' }} />
          </div>
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Nuevo Equipo de Red
          </h1>
        </div>
        <div className="p-6">
          <CreateNetworkForm />
        </div>
      </div>
    </div>
  )
}
