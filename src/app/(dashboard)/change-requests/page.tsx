import type { Metadata } from 'next'
import { GitPullRequest } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { GlobalCRView } from './_components/global-cr-view'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Solicitudes de Cambio' }

// ─── Stats badge ─────────────────────────────────────────────────────────────

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      className="flex flex-col items-center px-4 py-2 rounded"
      style={{ background: `${color}11`, border: `1px solid ${color}33` }}
    >
      <span
        className="text-xl font-heading font-bold font-mono"
        style={{ color, fontFamily: 'var(--font-jetbrains)' }}
      >
        {count}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

export default async function ChangeRequestsPage() {
  const user = await getCurrentUser()
  const canView = await resolvePermission(user.id, 'projects.change-requests', 'view')
  if (!canView) notFound()

  const [changeRequests, projects, users] = await Promise.all([
    prisma.changeRequest.findMany({
      where: {
        deletedAt: null,
        project: { organizationId: user.organizationId, deletedAt: null },
      },
      include: {
        assignedTo:          { select: { id: true, firstName: true, lastName: true } },
        requesterDepartment: { select: { id: true, name: true } },
        project:             { select: { id: true, name: true, code: true } },
        _count:              { select: { comments: { where: { deletedAt: null } }, attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ])

  // Stats
  const byStatus = changeRequests.reduce<Record<string, number>>((acc, cr) => {
    acc[cr.status] = (acc[cr.status] ?? 0) + 1
    return acc
  }, {})

  const crItems = changeRequests.map((cr) => ({
    id:                  cr.id,
    title:               cr.title,
    status:              cr.status as string,
    priority:            cr.priority as string,
    type:                cr.type as string,
    requesterName:       cr.requesterName,
    requesterDepartment: cr.requesterDepartment ?? null,
    assignedTo:          cr.assignedTo
      ? { id: cr.assignedTo.id, firstName: cr.assignedTo.firstName, lastName: cr.assignedTo.lastName }
      : null,
    project:             { id: cr.project.id, name: cr.project.name, code: cr.project.code },
    commentCount:        cr._count.comments,
    attachmentCount:     cr._count.attachments,
    createdAt:           cr.createdAt.toISOString(),
    updatedAt:           cr.updatedAt.toISOString(),
  }))

  const projectItems = projects.map((p) => ({ id: p.id, name: p.name, code: p.code }))
  const userItems    = users.map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }))

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <GitPullRequest size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
              Solicitudes de Cambio
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Vista global de todas las solicitudes de cambio — {changeRequests.length} total
            </p>
          </div>
        </div>

        {/* Stats strip */}
        {changeRequests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {(byStatus.REQUESTED    ?? 0) > 0 && <StatBadge label="Solicitado"  count={byStatus.REQUESTED    ?? 0} color="#64748b" />}
            {(byStatus.UNDER_REVIEW ?? 0) > 0 && <StatBadge label="En Revisión" count={byStatus.UNDER_REVIEW ?? 0} color="#3b82f6" />}
            {(byStatus.APPROVED     ?? 0) > 0 && <StatBadge label="Aprobado"    count={byStatus.APPROVED     ?? 0} color="#10b981" />}
            {(byStatus.IN_PROGRESS  ?? 0) > 0 && <StatBadge label="En Progreso" count={byStatus.IN_PROGRESS  ?? 0} color="#f59e0b" />}
            {(byStatus.COMPLETED    ?? 0) > 0 && <StatBadge label="Completado"  count={byStatus.COMPLETED    ?? 0} color="#059669" />}
            {(byStatus.REJECTED     ?? 0) > 0 && <StatBadge label="Rechazado"   count={byStatus.REJECTED     ?? 0} color="#ef4444" />}
            {(byStatus.CANCELLED    ?? 0) > 0 && <StatBadge label="Cancelado"   count={byStatus.CANCELLED    ?? 0} color="#475569" />}
          </div>
        )}
      </div>

      {changeRequests.length === 0 ? (
        <div
          className="rounded p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border-bright)' }}
        >
          <GitPullRequest size={40} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
            Sin solicitudes de cambio
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
            Las solicitudes se crean desde el detalle de cada proyecto.
          </p>
        </div>
      ) : (
        <GlobalCRView
          changeRequests={crItems}
          projects={projectItems}
          users={userItems}
        />
      )}
    </div>
  )
}
