import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { ProjectForm } from '../../_components/project-form'
import { ArrowLeft } from 'lucide-react'

type PageParams = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, code: true },
  })
  if (!project) return { title: 'Proyecto no encontrado' }
  return { title: `Editar ${project.code}` }
}

export default async function EditProjectPage({ params }: { params: PageParams }) {
  const { id } = await params
  const user = await getCurrentUser()

  const [project, users] = await Promise.all([
    prisma.project.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        controlLevel: true,
        deploymentType: true,
        status: true,
        priority: true,
        hasSourceCode: true,
        repositoryUrl: true,
        sourceCodePath: true,
        responsibleUserId: true,
        notes: true,
      },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
  ])

  if (!project) {
    notFound()
  }

  const initialData = {
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description ?? '',
    controlLevel: project.controlLevel,
    deploymentType: project.deploymentType,
    status: project.status,
    priority: project.priority,
    hasSourceCode: project.hasSourceCode,
    repositoryUrl: project.repositoryUrl ?? '',
    sourceCodePath: project.sourceCodePath ?? '',
    responsibleUserId: project.responsibleUserId ?? '',
    notes: project.notes ?? '',
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <ArrowLeft size={12} />
          Volver al proyecto
        </Link>

        <h1
          className="text-2xl font-heading font-bold uppercase tracking-wider"
          style={{ color: 'var(--foreground)' }}
        >
          Editar Proyecto
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
          <span
            className="font-mono"
            style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {project.code}
          </span>
          {' — '}
          {project.name}
        </p>
      </div>

      {/* Form */}
      <ProjectForm mode="edit" initialData={initialData} users={users} />
    </div>
  )
}
