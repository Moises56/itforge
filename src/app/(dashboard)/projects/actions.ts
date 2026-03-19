'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import type { ControlLevel, DeploymentType, ProjectStatus, Priority, EnvironmentType, TechStackCategory } from '@/generated/prisma/client'

// ─── Validation Schemas ──────────────────────────────────────────────────────

const techStackEntrySchema = z.object({
  category: z.enum(['LANGUAGE', 'FRAMEWORK', 'DATABASE_ENGINE', 'TOOL', 'OTHER']),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  version: z.string().max(50).optional(),
})

const environmentEntrySchema = z.object({
  type: z.enum(['DEV', 'STAGING', 'PRODUCTION']),
  serverIp: z.string().max(100).optional(),
  serverPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  url: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url('URL no válida').optional(),
  ),
  uncPath: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

const departmentUsageEntrySchema = z.object({
  departmentId: z.string().uuid(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  contactPerson: z.string().max(200).optional(),
})

const baseProjectSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  code: z
    .string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Solo mayúsculas, números, guiones y guiones bajos'),
  description: z.string().max(1000).optional(),
  controlLevel: z.enum(['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3']),
  deploymentType: z.enum(['WEB', 'DESKTOP', 'SERVICE', 'MOBILE']),
  status: z
    .enum(['IDEA', 'PLANNING', 'DEVELOPMENT', 'QA', 'PRODUCTION', 'SUSPENDED', 'DISCONTINUED'])
    .default('PLANNING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  hasSourceCode: z.boolean().default(false),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  sourceCodePath: z.string().optional(),
  responsibleUserId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
})

const createProjectSchema = baseProjectSchema.extend({
  techStack: z.array(techStackEntrySchema).default([]),
  environments: z.array(environmentEntrySchema).default([]),
  departmentUsages: z.array(departmentUsageEntrySchema).default([]),
})

const updateProjectSchema = baseProjectSchema.partial().extend({
  id: z.string().uuid(),
})

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'create')

  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data

  // Check code uniqueness
  const existing = await prisma.project.findFirst({
    where: { organizationId: user.organizationId, code: data.code, deletedAt: null },
  })
  if (existing) {
    return { success: false, error: `Ya existe un proyecto con el código ${data.code}` }
  }

  // Full transaction: project + techStack + environments + departmentUsages
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        code: data.code,
        description: data.description || null,
        controlLevel: data.controlLevel as ControlLevel,
        deploymentType: data.deploymentType as DeploymentType,
        status: data.status as ProjectStatus,
        priority: data.priority as Priority,
        hasSourceCode: data.hasSourceCode,
        repositoryUrl: data.repositoryUrl || null,
        sourceCodePath: data.sourceCodePath || null,
        responsibleUserId: data.responsibleUserId || null,
        notes: data.notes || null,
      },
    })

    // Tech stack
    if (data.techStack.length > 0) {
      await tx.techStack.createMany({
        data: data.techStack.map((t) => ({
          projectId: created.id,
          category: t.category as TechStackCategory,
          name: t.name,
          version: t.version ?? null,
        })),
      })
    }

    // Environments
    for (const env of data.environments) {
      await tx.projectEnvironment.create({
        data: {
          projectId: created.id,
          type: env.type as EnvironmentType,
          serverIp: env.serverIp ?? null,
          serverPort: env.serverPort ?? null,
          url: env.url ?? null,
          uncPath: env.uncPath ?? null,
          notes: env.notes ?? null,
        },
      })
    }

    // Department usages
    if (data.departmentUsages.length > 0) {
      await tx.departmentUsage.createMany({
        data: data.departmentUsages.map((d) => ({
          projectId: created.id,
          departmentId: d.departmentId,
          estimatedUsers: d.estimatedUsers ?? null,
          contactPerson: d.contactPerson ?? null,
        })),
      })
    }

    return created
  })

  revalidatePath('/projects')
  revalidatePath('/')
  return { success: true, data: { id: project.id } }
}

export async function updateProject(input: UpdateProjectInput): Promise<ActionResult> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = updateProjectSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { id, ...data } = parsed.data

  // Verify project belongs to organization
  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) {
    return { success: false, error: 'Proyecto no encontrado' }
  }

  // Check code uniqueness if changing
  if (data.code && data.code !== project.code) {
    const codeConflict = await prisma.project.findFirst({
      where: {
        organizationId: user.organizationId,
        code: data.code,
        deletedAt: null,
        id: { not: id },
      },
    })
    if (codeConflict) {
      return { success: false, error: `Ya existe un proyecto con el código ${data.code}` }
    }
  }

  await prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.controlLevel !== undefined && { controlLevel: data.controlLevel as ControlLevel }),
      ...(data.deploymentType !== undefined && { deploymentType: data.deploymentType as DeploymentType }),
      ...(data.status !== undefined && { status: data.status as ProjectStatus }),
      ...(data.priority !== undefined && { priority: data.priority as Priority }),
      ...(data.hasSourceCode !== undefined && { hasSourceCode: data.hasSourceCode }),
      ...(data.repositoryUrl !== undefined && { repositoryUrl: data.repositoryUrl || null }),
      ...(data.sourceCodePath !== undefined && { sourceCodePath: data.sourceCodePath || null }),
      ...(data.responsibleUserId !== undefined && { responsibleUserId: data.responsibleUserId || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  revalidatePath('/')
  return { success: true, data: undefined }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'delete')

  const project = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) {
    return { success: false, error: 'Proyecto no encontrado' }
  }

  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  revalidatePath('/projects')
  revalidatePath('/')
  redirect('/projects')
}
