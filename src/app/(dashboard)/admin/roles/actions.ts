'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import type { ActionResult } from '@/types'

// ─── Save role permissions ────────────────────────────────────────────────────

const saveSchema = z.object({
  roleId: z.string().uuid(),
  // Array of resourceActionIds that should be ALLOWED
  allowedIds: z.array(z.string().uuid()),
})

/**
 * Replaces all permissions for a role.
 * Only `system.config` managers (owner/admin) can do this.
 */
export async function saveRolePermissionsAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = saveSchema.safeParse({
    roleId: formData.get('roleId'),
    allowedIds: formData.getAll('allowedIds'),
  })

  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' }
  }

  const { roleId, allowedIds } = parsed.data

  // Verify role belongs to user's organization
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId: user.organizationId },
  })
  if (!role) return { success: false, error: 'Rol no encontrado' }
  if (role.isSystem && !user.roles.includes('owner')) {
    return { success: false, error: 'Solo el rol owner puede modificar roles del sistema' }
  }

  // Replace all permissions atomically
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } })
    if (allowedIds.length > 0) {
      await tx.rolePermission.createMany({
        data: allowedIds.map((resourceActionId) => ({
          roleId,
          resourceActionId,
          allowed: true,
        })),
      })
    }
  })

  revalidatePath(`/admin/roles/${roleId}`)
  revalidatePath('/admin/roles')

  return { success: true, data: undefined }
}

// ─── Create role ──────────────────────────────────────────────────────────────

const createRoleSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto').max(50),
  description: z.string().max(200).optional(),
})

export async function createRoleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = createRoleSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const existing = await prisma.role.findFirst({
    where: { organizationId: user.organizationId, name: parsed.data.name, deletedAt: null },
  })
  if (existing) return { success: false, error: 'Ya existe un rol con ese nombre' }

  const role = await prisma.role.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    },
  })

  revalidatePath('/admin/roles')
  return { success: true, data: { id: role.id } }
}
