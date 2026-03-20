import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, Database } from 'lucide-react'
import { CreateDatabaseForm } from './_components/create-database-form'

export const metadata: Metadata = { title: 'Nueva Base de Datos' }

export default async function NewDatabasePage() {
  const user = await getCurrentUser()

  const canCreate = await resolvePermission(user.id, 'databases', 'create')
  if (!canCreate) redirect('/databases')

  const projects = await prisma.project.findMany({
    where:   { organizationId: user.organizationId, deletedAt: null },
    orderBy: { name: 'asc' },
    select:  { id: true, name: true, code: true },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <Link
          href="/databases"
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={14} />
          Bases de Datos
        </Link>
        <span style={{ color: 'var(--foreground-dim)' }}>/</span>
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>Nueva</span>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <Database size={18} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div>
          <h1
            className="text-xl font-heading font-bold uppercase tracking-wider"
            style={{ color: 'var(--foreground)' }}
          >
            Registrar Base de Datos
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Agrega una nueva base de datos al inventario
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <CreateDatabaseForm projects={projects} />
    </div>
  )
}
