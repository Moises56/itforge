'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Create ───────────────────────────────────────────────────────────────────

const createGroupSchema = z.object({
  name:        z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
  parentId:    z.string().uuid().optional().nullable(),
  sortOrder:   z.number().int().default(0),
})

export async function createServerGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'create')

  const parsed = createGroupSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const group = await prisma.serverGroup.create({
    data: {
      organizationId: user.organizationId,
      name:           parsed.data.name,
      description:    parsed.data.description || null,
      parentId:       parsed.data.parentId ?? null,
      sortOrder:      parsed.data.sortOrder,
    },
  })

  revalidatePath('/infrastructure/servers')
  return { success: true, data: { id: group.id } }
}

// ─── Update ───────────────────────────────────────────────────────────────────

const updateGroupSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId:    z.string().uuid().optional().nullable(),
  sortOrder:   z.number().int().optional(),
})

export async function updateServerGroup(
  input: z.infer<typeof updateGroupSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'edit')

  const parsed = updateGroupSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const existing = await prisma.serverGroup.findFirst({
    where: { id: parsed.data.id, organizationId: user.organizationId },
  })
  if (!existing) return { success: false, error: 'Grupo no encontrado' }

  const { id, ...rest } = parsed.data
  await prisma.serverGroup.update({ where: { id }, data: rest })

  revalidatePath('/infrastructure/servers')
  return { success: true, data: undefined }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteServerGroup(groupId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'delete')

  const existing = await prisma.serverGroup.findFirst({
    where:   { id: groupId, organizationId: user.organizationId },
    include: { _count: { select: { servers: true, children: true } } },
  })
  if (!existing) return { success: false, error: 'Grupo no encontrado' }

  if (existing._count.servers > 0) {
    return { success: false, error: 'El grupo tiene servidores asignados. Reasígnalos antes de eliminar.' }
  }
  if (existing._count.children > 0) {
    return { success: false, error: 'El grupo tiene subgrupos. Elimínalos antes.' }
  }

  await prisma.serverGroup.delete({ where: { id: groupId } })

  revalidatePath('/infrastructure/servers')
  return { success: true, data: undefined }
}
