import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import {
  ArrowLeft,
  Globe,
  Monitor,
  Server,
  Smartphone,
  FolderKanban,
  ExternalLink,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { DeleteProjectButton } from './_components/delete-project-button'
import { ProjectDetailTabs } from './_components/project-detail-tabs'

type PageParams = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, code: true },
  })
  if (!project) return { title: 'Proyecto no encontrado' }
  return { title: `${project.code} — ${project.name}` }
}

// ─── Labels / Maps ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PRODUCTION: 'Producción',
  QA: 'QA',
  DEVELOPMENT: 'Desarrollo',
  PLANNING: 'Planificación',
  IDEA: 'Idea',
  SUSPENDED: 'Suspendido',
  DISCONTINUED: 'Descontinuado',
}

const STATUS_COLORS: Record<string, string> = {
  PRODUCTION: 'var(--status-green)',
  QA: 'var(--status-blue)',
  DEVELOPMENT: 'var(--status-blue)',
  PLANNING: 'var(--status-purple)',
  IDEA: 'var(--status-slate)',
  SUSPENDED: 'var(--status-amber)',
  DISCONTINUED: 'var(--status-red)',
}

const CONTROL_LABELS: Record<string, string> = {
  LEVEL_0: 'Nivel 0',
  LEVEL_1: 'Nivel 1',
  LEVEL_2: 'Nivel 2',
  LEVEL_3: 'Nivel 3',
}

const DEPLOYMENT_ICONS: Record<string, React.ReactNode> = {
  WEB: <Globe size={20} />,
  DESKTOP: <Monitor size={20} />,
  SERVICE: <Server size={20} />,
  MOBILE: <Smartphone size={20} />,
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'var(--status-slate)',
  MEDIUM: 'var(--status-blue)',
  HIGH: 'var(--status-amber)',
  CRITICAL: 'var(--status-red)',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getProject(id: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      responsibleUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      environments: {
        orderBy: { type: 'asc' },
      },
      techStack: {
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      },
      departmentUsages: {
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      projectRoles: {
        orderBy: { createdAt: 'asc' },
      },
      sourceRelations: {
        include: {
          targetProject: { select: { id: true, name: true, code: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      targetRelations: {
        include: {
          sourceProject: { select: { id: true, name: true, code: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      changeRequests: {
        where: { deletedAt: null },
        select: { id: true },
      },
      _count: {
        select: {
          credentials: { where: { deletedAt: null } },
          documents: { where: { deletedAt: null } },
        },
      },
    },
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({ params }: { params: PageParams }) {
  const { id } = await params
  const user = await getCurrentUser()

  const [project, departments, allProjects, credentials, documents, canEdit, canDelete] = await Promise.all([
    getProject(id, user.organizationId),
    prisma.department.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, id: { not: id } },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.projectCredential.findMany({
      where: { projectId: id, deletedAt: null, project: { organizationId: user.organizationId } },
      select: {
        id: true, label: true, type: true, username: true, notes: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.projectDocument.findMany({
      where: { projectId: id, deletedAt: null, project: { organizationId: user.organizationId } },
      select: {
        id: true, title: true, type: true, fileSize: true, mimeType: true, createdAt: true,
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    resolvePermission(user.id, 'projects', 'edit'),
    resolvePermission(user.id, 'projects', 'delete'),
  ])

  if (!project) notFound()

  // Fetch last reveal event per credential
  const credentialIds = credentials.map((c) => c.id)
  const revealLogs = credentialIds.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          action: 'reveal',
          resource: 'projects.credentials',
          resourceId: { in: credentialIds },
        },
        select: {
          resourceId: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['resourceId'],
      })
    : []

  const lastRevealByCredId = Object.fromEntries(
    revealLogs.map((l) => [
      l.resourceId,
      { at: l.createdAt.toISOString(), by: `${l.user.firstName} ${l.user.lastName}` },
    ]),
  )

  const productionUrl =
    project.environments.find((e) => e.type === 'PRODUCTION' && e.url)?.url ?? null

  const hasRisks =
    project.controlLevel === 'LEVEL_0' ||
    project._count.documents === 0 ||
    !project.responsibleUser

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: 'var(--foreground-muted)' }}
      >
        <ArrowLeft size={12} />
        Volver a proyectos
      </Link>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Type icon */}
            <div
              className="w-12 h-12 rounded flex items-center justify-center shrink-0"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--foreground-muted)',
              }}
            >
              {DEPLOYMENT_ICONS[project.deploymentType] ?? <FolderKanban size={20} />}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-sm font-mono"
                  style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
                >
                  {project.code}
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--foreground-muted)',
                    fontFamily: 'var(--font-jetbrains)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {CONTROL_LABELS[project.controlLevel]}
                </span>
              </div>

              <h1
                className="text-2xl font-heading font-bold"
                style={{ color: 'var(--foreground)' }}
              >
                {project.name}
              </h1>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[project.status] }}
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: STATUS_COLORS[project.status] }}
                  >
                    {STATUS_LABELS[project.status]}
                  </span>
                </span>
                <span
                  className="text-xs uppercase tracking-wider font-medium"
                  style={{ color: PRIORITY_COLORS[project.priority] }}
                >
                  · Prioridad {PRIORITY_LABELS[project.priority]}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {productionUrl && (
              <a
                href={productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  color: 'var(--status-green)',
                }}
              >
                <ExternalLink size={14} />
                Ir al sitio
              </a>
            )}
            {canEdit && (
              <Link
                href={`/projects/${project.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <Pencil size={14} />
                Editar
              </Link>
            )}
            {canDelete && (
              <DeleteProjectButton projectId={project.id} projectName={project.name} />
            )}
          </div>
        </div>
      </div>

      {/* ── Risk alerts ───────────────────────────────────────────────────── */}
      {hasRisks && (
        <div
          className="rounded p-4 space-y-2"
          style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: 'var(--status-amber)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--status-amber)' }}>
              Alertas de riesgo
            </span>
          </div>
          <ul className="text-xs space-y-0.5 pl-5" style={{ color: 'var(--foreground-muted)' }}>
            {project.controlLevel === 'LEVEL_0' && (
              <li>Sin código fuente ni documentación — caja negra</li>
            )}
            {project._count.documents === 0 && <li>Sin documentación registrada</li>}
            {!project.responsibleUser && <li>Sin responsable asignado</li>}
          </ul>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <ProjectDetailTabs
        project={{
          id: project.id,
          name: project.name,
          code: project.code,
          description: project.description,
          status: project.status,
          controlLevel: project.controlLevel,
          deploymentType: project.deploymentType,
          priority: project.priority,
          hasSourceCode: project.hasSourceCode,
          repositoryUrl: project.repositoryUrl,
          sourceCodePath: project.sourceCodePath,
          notes: project.notes,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          responsibleUser: project.responsibleUser,
          changeRequestCount: project.changeRequests.length,
          credentialCount: project._count.credentials,
          documentCount: project._count.documents,
        }}
        environments={project.environments.map((e) => ({
          id: e.id,
          type: e.type,
          serverIp: e.serverIp,
          serverPort: e.serverPort,
          url: e.url,
          uncPath: e.uncPath,
          notes: e.notes,
        }))}
        techStack={project.techStack.map((t) => ({
          id: t.id,
          category: t.category,
          name: t.name,
          version: t.version,
        }))}
        departmentUsages={project.departmentUsages.map((d) => ({
          id: d.id,
          estimatedUsers: d.estimatedUsers,
          contactPerson: d.contactPerson,
          department: d.department,
        }))}
        projectRoles={project.projectRoles.map((r) => ({
          id: r.id,
          roleName: r.roleName,
          description: r.description,
        }))}
        sourceRelations={project.sourceRelations.map((r) => ({
          id: r.id,
          type: r.type,
          notes: r.notes,
          targetProject: r.targetProject,
        }))}
        targetRelations={project.targetRelations.map((r) => ({
          id: r.id,
          type: r.type,
          notes: r.notes,
          sourceProject: r.sourceProject,
        }))}
        departments={departments}
        allProjects={allProjects}
        credentials={credentials.map((c) => ({
          id: c.id,
          label: c.label,
          type: c.type,
          username: c.username,
          notes: c.notes,
          createdAt: c.createdAt.toISOString(),
          lastReveal: lastRevealByCredId[c.id] ?? null,
        }))}
        documents={documents.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          createdAt: d.createdAt.toISOString(),
          uploadedBy: d.uploadedBy,
        }))}
        canEdit={canEdit}
      />
    </div>
  )
}
