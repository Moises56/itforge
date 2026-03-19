'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import type { EnvironmentType, TechStackCategory, ProjectRelationType } from '@/generated/prisma/client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Helper: verify project belongs to org ───────────────────────────────────

async function verifyProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
  })
}

// ─── Environments ─────────────────────────────────────────────────────────────

const createEnvSchema = z.object({
  projectId: z.string().uuid(),
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

export async function createEnvironment(
  input: z.infer<typeof createEnvSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = createEnvSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const existing = await prisma.projectEnvironment.findFirst({
    where: { projectId: parsed.data.projectId, type: parsed.data.type as EnvironmentType },
  })
  if (existing) {
    return { success: false, error: `Ya existe un ambiente ${parsed.data.type} en este proyecto` }
  }

  const env = await prisma.projectEnvironment.create({
    data: {
      projectId: parsed.data.projectId,
      type: parsed.data.type as EnvironmentType,
      serverIp: parsed.data.serverIp || null,
      serverPort: parsed.data.serverPort ?? null,
      url: parsed.data.url ?? null,
      uncPath: parsed.data.uncPath || null,
      notes: parsed.data.notes || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: { id: env.id } }
}

const updateEnvSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  serverIp: z.string().max(100).optional(),
  serverPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  url: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url('URL no válida').optional(),
  ),
  uncPath: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export async function updateEnvironment(
  input: z.infer<typeof updateEnvSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = updateEnvSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectEnvironment.update({
    where: { id: parsed.data.id },
    data: {
      serverIp: parsed.data.serverIp || null,
      serverPort: parsed.data.serverPort ?? null,
      url: parsed.data.url ?? null,
      uncPath: parsed.data.uncPath || null,
      notes: parsed.data.notes || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: undefined }
}

export async function deleteEnvironment(
  environmentId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const project = await verifyProject(projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectEnvironment.delete({ where: { id: environmentId } })
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

// ─── Tech Stack ───────────────────────────────────────────────────────────────

const addTechSchema = z.object({
  projectId: z.string().uuid(),
  category: z.enum(['LANGUAGE', 'FRAMEWORK', 'DATABASE_ENGINE', 'TOOL', 'OTHER']),
  name: z.string().min(1, 'Nombre requerido').max(100),
  version: z.string().max(50).optional(),
})

export async function addTechStack(
  input: z.infer<typeof addTechSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = addTechSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const tech = await prisma.techStack.create({
    data: {
      projectId: parsed.data.projectId,
      category: parsed.data.category as TechStackCategory,
      name: parsed.data.name,
      version: parsed.data.version || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: { id: tech.id } }
}

export async function removeTechStack(
  techId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const project = await verifyProject(projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.techStack.delete({ where: { id: techId } })
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

// ─── Department Usages ────────────────────────────────────────────────────────

const addDeptSchema = z.object({
  projectId: z.string().uuid(),
  departmentId: z.string().uuid(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  contactPerson: z.string().max(200).optional(),
})

export async function addDepartmentUsage(
  input: z.infer<typeof addDeptSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = addDeptSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const existing = await prisma.departmentUsage.findFirst({
    where: { projectId: parsed.data.projectId, departmentId: parsed.data.departmentId },
  })
  if (existing) return { success: false, error: 'Este departamento ya está asociado al proyecto' }

  const usage = await prisma.departmentUsage.create({
    data: {
      projectId: parsed.data.projectId,
      departmentId: parsed.data.departmentId,
      estimatedUsers: parsed.data.estimatedUsers ?? null,
      contactPerson: parsed.data.contactPerson || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: { id: usage.id } }
}

const updateDeptSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  contactPerson: z.string().max(200).optional(),
})

export async function updateDepartmentUsage(
  input: z.infer<typeof updateDeptSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = updateDeptSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.departmentUsage.update({
    where: { id: parsed.data.id },
    data: {
      estimatedUsers: parsed.data.estimatedUsers ?? null,
      contactPerson: parsed.data.contactPerson || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: undefined }
}

export async function removeDepartmentUsage(
  usageId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const project = await verifyProject(projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.departmentUsage.delete({ where: { id: usageId } })
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

// ─── Project Roles ────────────────────────────────────────────────────────────

const createRoleSchema = z.object({
  projectId: z.string().uuid(),
  roleName: z.string().min(1, 'El nombre del rol es requerido').max(100),
  description: z.string().max(500).optional(),
})

export async function createProjectRole(
  input: z.infer<typeof createRoleSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = createRoleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const role = await prisma.projectRole.create({
    data: {
      projectId: parsed.data.projectId,
      roleName: parsed.data.roleName,
      description: parsed.data.description || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: { id: role.id } }
}

const updateRoleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  roleName: z.string().min(1, 'El nombre del rol es requerido').max(100),
  description: z.string().max(500).optional(),
})

export async function updateProjectRole(
  input: z.infer<typeof updateRoleSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = updateRoleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await verifyProject(parsed.data.projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectRole.update({
    where: { id: parsed.data.id },
    data: {
      roleName: parsed.data.roleName,
      description: parsed.data.description || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: undefined }
}

export async function deleteProjectRole(
  roleId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const project = await verifyProject(projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectRole.delete({ where: { id: roleId } })
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}

// ─── Project Relations ────────────────────────────────────────────────────────

const createRelationSchema = z.object({
  sourceProjectId: z.string().uuid(),
  targetProjectId: z.string().uuid(),
  type: z.enum(['DEPENDS_ON', 'EXTENDS', 'REPLACES', 'SHARES_DATABASE']),
  notes: z.string().max(500).optional(),
})

export async function createProjectRelation(
  input: z.infer<typeof createRelationSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const parsed = createRelationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  if (parsed.data.sourceProjectId === parsed.data.targetProjectId) {
    return { success: false, error: 'Un proyecto no puede relacionarse consigo mismo' }
  }

  const source = await verifyProject(parsed.data.sourceProjectId, user.organizationId)
  if (!source) return { success: false, error: 'Proyecto no encontrado' }

  const target = await verifyProject(parsed.data.targetProjectId, user.organizationId)
  if (!target) return { success: false, error: 'Proyecto destino no encontrado' }

  const existing = await prisma.projectRelation.findFirst({
    where: {
      sourceProjectId: parsed.data.sourceProjectId,
      targetProjectId: parsed.data.targetProjectId,
      type: parsed.data.type as ProjectRelationType,
    },
  })
  if (existing) return { success: false, error: 'Esta relación ya existe' }

  const relation = await prisma.projectRelation.create({
    data: {
      sourceProjectId: parsed.data.sourceProjectId,
      targetProjectId: parsed.data.targetProjectId,
      type: parsed.data.type as ProjectRelationType,
      notes: parsed.data.notes || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.sourceProjectId}`)
  return { success: true, data: { id: relation.id } }
}

export async function deleteProjectRelation(
  relationId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const project = await verifyProject(projectId, user.organizationId)
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectRelation.delete({ where: { id: relationId } })
  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}
