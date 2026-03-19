'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { encrypt, decrypt, verifyPassword } from '@/core/crypto/encryption'
import type { CredentialType } from '@/generated/prisma/client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Create ───────────────────────────────────────────────────────────────────

const createCredentialSchema = z.object({
  projectId:     z.string().uuid(),
  environmentId: z.string().uuid().optional().nullable(),
  label:         z.string().min(1, 'La etiqueta es requerida').max(100),
  type:          z.enum(['DATABASE', 'SSH', 'API_KEY', 'ADMIN_ACCESS', 'OTHER']),
  username:      z.string().max(200).optional(),
  plainValue:    z.string().min(1, 'El valor es requerido').max(5000),
  notes:         z.string().max(500).optional(),
})

export async function createCredential(
  input: z.infer<typeof createCredentialSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.credentials', 'create')

  const parsed = createCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const encryptedValue = encrypt(parsed.data.plainValue)

  const credential = await prisma.projectCredential.create({
    data: {
      projectId:      parsed.data.projectId,
      environmentId:  parsed.data.environmentId ?? null,
      label:          parsed.data.label,
      type:           parsed.data.type as CredentialType,
      username:       parsed.data.username || null,
      encryptedValue,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: { id: credential.id } }
}

// ─── Reveal (re-auth required) ────────────────────────────────────────────────

export async function revealCredential(
  credentialId: string,
  password: string,
): Promise<ActionResult<{ value: string }>> {
  const user = await getCurrentUser()
  await requirePermission(
    user.id,
    user.organizationId,
    'projects.credentials',
    'reveal',
    credentialId,
  )

  // Re-authentication
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!fullUser) return { success: false, error: 'Usuario no encontrado' }

  const isValid = await verifyPassword(fullUser.passwordHash, password)
  if (!isValid) return { success: false, error: 'Contraseña incorrecta' }

  const credential = await prisma.projectCredential.findFirst({
    where: { id: credentialId, deletedAt: null },
    include: { project: { select: { organizationId: true, id: true } } },
  })
  if (!credential || credential.project.organizationId !== user.organizationId) {
    return { success: false, error: 'Credencial no encontrada' }
  }

  let decryptedValue: string
  try {
    decryptedValue = decrypt(credential.encryptedValue)
  } catch {
    return { success: false, error: 'Error al descifrar la credencial' }
  }

  // Detailed audit log (in addition to the one from requirePermission)
  const headersList = await headers()
  const ipAddress =
    headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null

  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      action:     'reveal',
      resource:   'projects.credentials',
      resourceId: credentialId,
      ipAddress,
      metadata: {
        projectId: credential.project.id,
        label:     credential.label,
        type:      credential.type,
      },
    },
  }).catch(() => null)

  return { success: true, data: { value: decryptedValue } }
}

// ─── Update ───────────────────────────────────────────────────────────────────

const updateCredentialSchema = z.object({
  id:         z.string().uuid(),
  projectId:  z.string().uuid(),
  label:      z.string().min(1).max(100).optional(),
  type:       z.enum(['DATABASE', 'SSH', 'API_KEY', 'ADMIN_ACCESS', 'OTHER']).optional(),
  username:   z.string().max(200).optional(),
  plainValue: z.string().min(1).max(5000).optional(),
  notes:      z.string().max(500).optional(),
})

export async function updateCredential(
  input: z.infer<typeof updateCredentialSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.credentials', 'edit')

  const parsed = updateCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.label      !== undefined) updateData.label          = parsed.data.label
  if (parsed.data.type       !== undefined) updateData.type           = parsed.data.type as CredentialType
  if (parsed.data.username   !== undefined) updateData.username       = parsed.data.username || null
  if (parsed.data.notes      !== undefined) updateData.notes          = parsed.data.notes || null
  if (parsed.data.plainValue !== undefined) updateData.encryptedValue = encrypt(parsed.data.plainValue)

  await prisma.projectCredential.update({
    where: { id: parsed.data.id },
    data:  updateData,
  })

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { success: true, data: undefined }
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteCredential(
  credentialId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(
    user.id,
    user.organizationId,
    'projects.credentials',
    'delete',
    credentialId,
  )

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  await prisma.projectCredential.update({
    where: { id: credentialId },
    data:  { deletedAt: new Date() },
  })

  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}
