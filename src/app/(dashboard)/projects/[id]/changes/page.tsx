import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GitPullRequest } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { ChangesKanban } from './_components/changes-kanban'

type PageParams = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, code: true },
  })
  if (!project) return { title: 'Proyecto no encontrado' }
  return { title: `Cambios — ${project.code} ${project.name}` }
}

export default async function ProjectChangesPage({ params }: { params: PageParams }) {
  const { id } = await params
  const user = await getCurrentUser()

  const [project, changeRequests, users, departments, canManage, canView] = await Promise.all([
    prisma.project.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true, code: true },
    }),
    prisma.changeRequest.findMany({
      where: { projectId: id, deletedAt: null, project: { organizationId: user.organizationId } },
      include: {
        assignedTo:          { select: { id: true, firstName: true, lastName: true } },
        requesterDepartment: { select: { id: true, name: true } },
        _count:              { select: { comments: { where: { deletedAt: null } }, attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.department.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    resolvePermission(user.id, 'projects.change-requests', 'change_status'),
    resolvePermission(user.id, 'projects.change-requests', 'view'),
  ])

  if (!project || !canView) notFound()

  const canCreate = await resolvePermission(user.id, 'projects.change-requests', 'create')
  const canEdit   = await resolvePermission(user.id, 'projects.change-requests', 'edit')

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
    commentCount:     cr._count.comments,
    attachmentCount:  cr._count.attachments,
    createdAt:        cr.createdAt.toISOString(),
    updatedAt:        cr.updatedAt.toISOString(),
  }))

  const userItems = users.map((u) => ({
    id:        u.id,
    firstName: u.firstName,
    lastName:  u.lastName,
  }))

  const deptItems = departments.map((d) => ({
    id:   d.id,
    name: d.name,
    code: d.code,
  }))

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={12} />
          Volver al proyecto
        </Link>
      </div>

      {/* Header */}
      <div
        className="rounded p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <GitPullRequest size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
              >
                {project.code}
              </span>
            </div>
            <h1
              className="text-lg font-heading font-bold leading-tight"
              style={{ color: 'var(--foreground)' }}
            >
              Solicitudes de Cambio
            </h1>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
              {crItems.length} solicitud{crItems.length !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <ChangesKanban
        projectId={id}
        projectName={project.name}
        changeRequests={crItems}
        users={userItems}
        departments={deptItems}
        currentUserId={user.id}
        canCreate={canCreate}
        canManage={canManage}
        canEdit={canEdit}
      />
    </div>
  )
}
