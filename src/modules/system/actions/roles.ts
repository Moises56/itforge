'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { revalidatePath } from 'next/cache'

const CreateRoleSchema = z.object({
  name:        z.string().min(2).max(60),
  description: z.string().max(300).optional(),
})

export async function createRole(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser()
    await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

    const parsed = CreateRoleSchema.safeParse({
      name:        formData.get('name'),
      description: (formData.get('description') as string) || undefined,
    })
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos.' }
    }

    // Check uniqueness
    const existing = await prisma.role.findFirst({
      where: { organizationId: user.organizationId, name: parsed.data.name, deletedAt: null },
    })
    if (existing) return { success: false, error: 'Ya existe un rol con ese nombre.' }

    const role = await prisma.role.create({
      data: {
        name:           parsed.data.name,
        description:    parsed.data.description,
        organizationId: user.organizationId,
        isSystem:       false,
        isDefault:      false,
      },
    })

    revalidatePath('/admin/roles')
    return { success: true, id: role.id }
  } catch (e) {
    console.error('createRole', e)
    return { success: false, error: 'Error al crear el rol.' }
  }
}
