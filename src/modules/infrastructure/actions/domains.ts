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

const createDomainSchema = z.object({
  name:        z.string().min(1, 'El nombre del dominio es requerido').max(253),
  type:        z.enum(['INTERNAL', 'PUBLIC']),
  pointsTo:    z.string().max(200).optional(),
  serverId:    z.string().uuid().optional().nullable(),
  projectId:   z.string().uuid().optional().nullable(),
  sslEnabled:  z.boolean().default(false),
  sslExpiresAt:z.string().datetime().optional().nullable(),
  registrar:   z.string().max(200).optional(),
  expiresAt:   z.string().datetime().optional().nullable(),
  notes:       z.string().max(2000).optional(),
})

export async function createDomain(
  input: z.infer<typeof createDomainSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.domains', 'create')

  const parsed = createDomainSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  // Validate server belongs to org if provided
  if (parsed.data.serverId) {
    const srv = await prisma.server.findFirst({
      where: { id: parsed.data.serverId, organizationId: user.organizationId, deletedAt: null },
    })
    if (!srv) return { success: false, error: 'Servidor no encontrado' }
  }

  // Validate project belongs to org if provided
  if (parsed.data.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId: user.organizationId, deletedAt: null },
    })
    if (!proj) return { success: false, error: 'Proyecto no encontrado' }
  }

  const domain = await prisma.domain.create({
    data: {
      organizationId: user.organizationId,
      name:           parsed.data.name,
      type:           parsed.data.type,
      pointsTo:       parsed.data.pointsTo || null,
      serverId:       parsed.data.serverId ?? null,
      projectId:      parsed.data.projectId ?? null,
      sslEnabled:     parsed.data.sslEnabled,
      sslExpiresAt:   parsed.data.sslExpiresAt ? new Date(parsed.data.sslExpiresAt) : null,
      registrar:      parsed.data.registrar || null,
      expiresAt:      parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath('/infrastructure/domains')
  return { success: true, data: { id: domain.id } }
}

// ─── Update ───────────────────────────────────────────────────────────────────

const updateDomainSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(1).max(253).optional(),
  type:        z.enum(['INTERNAL', 'PUBLIC']).optional(),
  pointsTo:    z.string().max(200).optional().nullable(),
  serverId:    z.string().uuid().optional().nullable(),
  projectId:   z.string().uuid().optional().nullable(),
  sslEnabled:  z.boolean().optional(),
  sslExpiresAt:z.string().datetime().optional().nullable(),
  registrar:   z.string().max(200).optional().nullable(),
  expiresAt:   z.string().datetime().optional().nullable(),
  notes:       z.string().max(2000).optional().nullable(),
})

export async function updateDomain(
  input: z.infer<typeof updateDomainSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.domains', 'edit')

  const parsed = updateDomainSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const existing = await prisma.domain.findFirst({
    where: { id: parsed.data.id, organizationId: user.organizationId, deletedAt: null },
  })
  if (!existing) return { success: false, error: 'Dominio no encontrado' }

  const { id, sslExpiresAt, expiresAt, ...rest } = parsed.data
  await prisma.domain.update({
    where: { id },
    data:  {
      ...rest,
      ...(sslExpiresAt !== undefined && { sslExpiresAt: sslExpiresAt ? new Date(sslExpiresAt) : null }),
      ...(expiresAt    !== undefined && { expiresAt:    expiresAt    ? new Date(expiresAt)    : null }),
    },
  })

  revalidatePath('/infrastructure/domains')
  return { success: true, data: undefined }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDomain(domainId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.domains', 'delete', domainId)

  const existing = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!existing) return { success: false, error: 'Dominio no encontrado' }

  await prisma.domain.update({ where: { id: domainId }, data: { deletedAt: new Date() } })

  revalidatePath('/infrastructure/domains')
  return { success: true, data: undefined }
}
