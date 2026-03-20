'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { hashPassword } from '@/core/crypto/encryption'
import { destroyAllUserSessions } from '@/core/auth/session'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function logAudit(
  userId: string,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  await prisma.auditLog.create({
    data: { userId, action, resource: 'users', resourceId, ipAddress, metadata: metadata as never },
  }).catch(() => null)
}

// ─── Create User ──────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email:        z.string().email('Email inválido'),
  password:     z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName:    z.string().min(1, 'El nombre es requerido').max(100),
  lastName:     z.string().min(1, 'El apellido es requerido').max(100),
  departmentId: z.string().uuid().optional().nullable(),
  roleIds:      z.array(z.string().uuid()).default([]),
})

export async function createUser(
  input: z.infer<typeof createUserSchema>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'create')

  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  // Check email uniqueness within org
  const existing = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, email: parsed.data.email, deletedAt: null },
  })
  if (existing) return { success: false, error: 'Ya existe un usuario con ese email' }

  // Validate roles belong to org
  if (parsed.data.roleIds.length > 0) {
    const rolesCount = await prisma.role.count({
      where: { id: { in: parsed.data.roleIds }, organizationId: actor.organizationId, deletedAt: null },
    })
    if (rolesCount !== parsed.data.roleIds.length) {
      return { success: false, error: 'Uno o más roles son inválidos' }
    }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await prisma.user.create({
    data: {
      organizationId: actor.organizationId,
      email:          parsed.data.email,
      passwordHash,
      firstName:      parsed.data.firstName,
      lastName:       parsed.data.lastName,
      departmentId:   parsed.data.departmentId ?? null,
      isActive:       true,
    },
  })

  // Assign roles
  if (parsed.data.roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: parsed.data.roleIds.map((roleId) => ({ userId: user.id, roleId })),
    })
  }

  await logAudit(actor.id, 'create', user.id, {
    email:     parsed.data.email,
    firstName: parsed.data.firstName,
    lastName:  parsed.data.lastName,
    roleIds:   parsed.data.roleIds,
  })

  revalidatePath('/admin/users')
  return { success: true, data: { id: user.id } }
}

// ─── Update User ──────────────────────────────────────────────────────────────

const updateUserSchema = z.object({
  id:           z.string().uuid(),
  email:        z.string().email('Email inválido').optional(),
  firstName:    z.string().min(1).max(100).optional(),
  lastName:     z.string().min(1).max(100).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  newPassword:  z.string().min(8, 'Mínimo 8 caracteres').optional().nullable(),
})

export async function updateUser(
  input: z.infer<typeof updateUserSchema>,
): Promise<ActionResult<undefined>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'edit')

  const parsed = updateUserSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  // Verify user belongs to org
  const target = await prisma.user.findFirst({
    where: { id: parsed.data.id, organizationId: actor.organizationId, deletedAt: null },
  })
  if (!target) return { success: false, error: 'Usuario no encontrado' }

  // Check email uniqueness if changing
  if (parsed.data.email && parsed.data.email !== target.email) {
    const dup = await prisma.user.findFirst({
      where: { organizationId: actor.organizationId, email: parsed.data.email, deletedAt: null, id: { not: parsed.data.id } },
    })
    if (dup) return { success: false, error: 'Ya existe un usuario con ese email' }
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.email        !== undefined) updateData.email        = parsed.data.email
  if (parsed.data.firstName    !== undefined) updateData.firstName    = parsed.data.firstName
  if (parsed.data.lastName     !== undefined) updateData.lastName     = parsed.data.lastName
  if (parsed.data.departmentId !== undefined) updateData.departmentId = parsed.data.departmentId

  if (parsed.data.newPassword) {
    updateData.passwordHash = await hashPassword(parsed.data.newPassword)
    // Destroy all sessions when password changes (force re-login)
    await destroyAllUserSessions(parsed.data.id)
  }

  await prisma.user.update({ where: { id: parsed.data.id }, data: updateData })

  await logAudit(actor.id, 'update', parsed.data.id, {
    changedFields: Object.keys(updateData).filter((k) => k !== 'passwordHash'),
    passwordChanged: !!parsed.data.newPassword,
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${parsed.data.id}`)
  return { success: true, data: undefined }
}

// ─── Toggle Active ────────────────────────────────────────────────────────────

export async function toggleUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult<undefined>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'edit')

  if (actor.id === userId) return { success: false, error: 'No puedes desactivarte a ti mismo' }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
  })
  if (!target) return { success: false, error: 'Usuario no encontrado' }

  await prisma.user.update({ where: { id: userId }, data: { isActive } })

  // Destroy sessions when deactivating
  if (!isActive) {
    await destroyAllUserSessions(userId)
  }

  await logAudit(actor.id, isActive ? 'activate' : 'deactivate', userId, {
    previousState: target.isActive,
    sessionsDestroyed: !isActive,
  })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true, data: undefined }
}

// ─── Assign Roles ─────────────────────────────────────────────────────────────

const assignRolesSchema = z.object({
  userId:  z.string().uuid(),
  roleIds: z.array(z.string().uuid()),
})

export async function assignRoles(
  input: z.infer<typeof assignRolesSchema>,
): Promise<ActionResult<undefined>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'edit')

  const parsed = assignRolesSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, organizationId: actor.organizationId, deletedAt: null },
  })
  if (!target) return { success: false, error: 'Usuario no encontrado' }

  // Validate roles belong to org
  if (parsed.data.roleIds.length > 0) {
    const count = await prisma.role.count({
      where: { id: { in: parsed.data.roleIds }, organizationId: actor.organizationId, deletedAt: null },
    })
    if (count !== parsed.data.roleIds.length) return { success: false, error: 'Roles inválidos' }
  }

  // Atomic replace: delete all + create new
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: parsed.data.userId } }),
    ...(parsed.data.roleIds.length > 0
      ? [prisma.userRole.createMany({
          data: parsed.data.roleIds.map((roleId) => ({ userId: parsed.data.userId, roleId })),
        })]
      : []),
  ])

  await logAudit(actor.id, 'assign_roles', parsed.data.userId, { roleIds: parsed.data.roleIds })

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${parsed.data.userId}`)
  return { success: true, data: undefined }
}

// ─── Save Permission Overrides ────────────────────────────────────────────────

const saveOverridesSchema = z.object({
  userId:    z.string().uuid(),
  overrides: z.array(z.object({
    resourceActionId: z.string().uuid(),
    allowed:          z.boolean(),
  })),
})

export async function saveUserOverrides(
  input: z.infer<typeof saveOverridesSchema>,
): Promise<ActionResult<undefined>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'edit')

  const parsed = saveOverridesSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, organizationId: actor.organizationId, deletedAt: null },
  })
  if (!target) return { success: false, error: 'Usuario no encontrado' }

  // Atomic replace: delete all user overrides then insert new ones
  await prisma.$transaction([
    prisma.userPermissionOverride.deleteMany({ where: { userId: parsed.data.userId } }),
    ...(parsed.data.overrides.length > 0
      ? [prisma.userPermissionOverride.createMany({
          data: parsed.data.overrides.map((o) => ({
            userId:           parsed.data.userId,
            resourceActionId: o.resourceActionId,
            allowed:          o.allowed,
          })),
        })]
      : []),
  ])

  await logAudit(actor.id, 'save_overrides', parsed.data.userId, {
    overrideCount: parsed.data.overrides.length,
    allowCount:    parsed.data.overrides.filter((o) => o.allowed).length,
    denyCount:     parsed.data.overrides.filter((o) => !o.allowed).length,
  })

  revalidatePath(`/admin/users/${parsed.data.userId}`)
  return { success: true, data: undefined }
}

// ─── Destroy User Sessions ────────────────────────────────────────────────────

export async function destroyUserSessions(userId: string): Promise<ActionResult<undefined>> {
  const actor = await getCurrentUser()
  await requirePermission(actor.id, actor.organizationId, 'users', 'edit')

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
  })
  if (!target) return { success: false, error: 'Usuario no encontrado' }

  await destroyAllUserSessions(userId)

  await logAudit(actor.id, 'destroy_sessions', userId, {})

  revalidatePath(`/admin/users/${userId}`)
  return { success: true, data: undefined }
}
