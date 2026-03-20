'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { getDataScope } from '@/core/permissions/scope'
import { encrypt, decrypt, verifyPassword } from '@/core/crypto/encryption'
import type { DatabaseEngine, DatabaseManagedBy } from '@/generated/prisma/client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Create Database ──────────────────────────────────────────────────────────

const createDatabaseSchema = z.object({
  name:         z.string().min(1, 'El nombre es requerido').max(200),
  engine:       z.enum(['POSTGRESQL', 'MYSQL', 'SQL_SERVER', 'MONGODB', 'SQLITE', 'OTHER']),
  version:      z.string().max(50).optional(),
  serverIp:     z.string().max(200).optional(),
  port:         z.coerce.number().int().min(1).max(65535).optional().nullable(),
  databaseName: z.string().max(200).optional(),
  managedBy:    z.enum(['DBA_TEAM', 'DEV_TEAM', 'EXTERNAL']),
  projectId:    z.string().uuid().optional().nullable(),
  notes:        z.string().max(2000).optional(),
})

export async function createDatabase(
  input: z.infer<typeof createDatabaseSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases', 'create')

  const parsed = createDatabaseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId: user.organizationId, deletedAt: null },
    })
    if (!project) return { success: false, error: 'Proyecto no encontrado' }
  }

  const db = await prisma.database.create({
    data: {
      organizationId: user.organizationId,
      name:           parsed.data.name,
      engine:         parsed.data.engine as DatabaseEngine,
      version:        parsed.data.version || null,
      serverIp:       parsed.data.serverIp || null,
      port:           parsed.data.port ?? null,
      databaseName:   parsed.data.databaseName || null,
      managedBy:      parsed.data.managedBy as DatabaseManagedBy,
      projectId:      parsed.data.projectId ?? null,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath('/databases')
  return { success: true, data: { id: db.id } }
}

// ─── Update Database ──────────────────────────────────────────────────────────

const updateDatabaseSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string().min(1).max(200).optional(),
  engine:       z.enum(['POSTGRESQL', 'MYSQL', 'SQL_SERVER', 'MONGODB', 'SQLITE', 'OTHER']).optional(),
  version:      z.string().max(50).optional(),
  serverIp:     z.string().max(200).optional(),
  port:         z.coerce.number().int().min(1).max(65535).optional().nullable(),
  databaseName: z.string().max(200).optional(),
  managedBy:    z.enum(['DBA_TEAM', 'DEV_TEAM', 'EXTERNAL']).optional(),
  projectId:    z.string().uuid().optional().nullable(),
  notes:        z.string().max(2000).optional(),
})

export async function updateDatabase(
  input: z.infer<typeof updateDatabaseSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases', 'edit')

  const parsed = updateDatabaseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const scope = getDataScope(user.id, user.roles, 'databases')

  const existing = await prisma.database.findFirst({
    where: { id: parsed.data.id, organizationId: user.organizationId, deletedAt: null, ...scope },
  })
  if (!existing) return { success: false, error: 'Base de datos no encontrada o sin acceso' }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name         !== undefined) updateData.name         = parsed.data.name
  if (parsed.data.engine       !== undefined) updateData.engine       = parsed.data.engine as DatabaseEngine
  if (parsed.data.version      !== undefined) updateData.version      = parsed.data.version || null
  if (parsed.data.serverIp     !== undefined) updateData.serverIp     = parsed.data.serverIp || null
  if (parsed.data.port         !== undefined) updateData.port         = parsed.data.port
  if (parsed.data.databaseName !== undefined) updateData.databaseName = parsed.data.databaseName || null
  if (parsed.data.managedBy    !== undefined) updateData.managedBy    = parsed.data.managedBy as DatabaseManagedBy
  if (parsed.data.projectId    !== undefined) updateData.projectId    = parsed.data.projectId
  if (parsed.data.notes        !== undefined) updateData.notes        = parsed.data.notes || null

  await prisma.database.update({ where: { id: parsed.data.id }, data: updateData })

  revalidatePath(`/databases/${parsed.data.id}`)
  revalidatePath('/databases')
  return { success: true, data: undefined }
}

// ─── Delete Database ──────────────────────────────────────────────────────────

export async function deleteDatabase(
  databaseId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases', 'delete', databaseId)

  const scope = getDataScope(user.id, user.roles, 'databases')

  const existing = await prisma.database.findFirst({
    where: { id: databaseId, organizationId: user.organizationId, deletedAt: null, ...scope },
  })
  if (!existing) return { success: false, error: 'Base de datos no encontrada o sin acceso' }

  await prisma.database.update({
    where: { id: databaseId },
    data:  { deletedAt: new Date() },
  })

  revalidatePath('/databases')
  return { success: true, data: undefined }
}

// ─── Create Database Credential ───────────────────────────────────────────────

const createDbCredentialSchema = z.object({
  databaseId:  z.string().uuid(),
  label:       z.string().min(1, 'La etiqueta es requerida').max(100),
  username:    z.string().max(200).optional(),
  plainValue:  z.string().min(1, 'El valor es requerido').max(5000),
  accessLevel: z.string().max(100).optional(),
})

export async function createDatabaseCredential(
  input: z.infer<typeof createDbCredentialSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases.credentials', 'create')

  const parsed = createDbCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const scope = getDataScope(user.id, user.roles, 'databases.credentials')

  const db = await prisma.database.findFirst({
    where: { id: parsed.data.databaseId, organizationId: user.organizationId, deletedAt: null, ...scope },
  })
  if (!db) return { success: false, error: 'Base de datos no encontrada o sin acceso' }

  const encryptedValue = encrypt(parsed.data.plainValue)

  const credential = await prisma.databaseCredential.create({
    data: {
      databaseId:     parsed.data.databaseId,
      label:          parsed.data.label,
      username:       parsed.data.username ?? '',
      encryptedValue,
      accessLevel:    parsed.data.accessLevel || null,
    },
  })

  revalidatePath(`/databases/${parsed.data.databaseId}`)
  return { success: true, data: { id: credential.id } }
}

// ─── Update Database Credential ───────────────────────────────────────────────

const updateDbCredentialSchema = z.object({
  id:          z.string().uuid(),
  databaseId:  z.string().uuid(),
  label:       z.string().min(1).max(100).optional(),
  username:    z.string().max(200).optional(),
  plainValue:  z.string().min(1).max(5000).optional(),
  accessLevel: z.string().max(100).optional(),
})

export async function updateDatabaseCredential(
  input: z.infer<typeof updateDbCredentialSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases.credentials', 'edit')

  const parsed = updateDbCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const scope = getDataScope(user.id, user.roles, 'databases.credentials')

  const db = await prisma.database.findFirst({
    where: { id: parsed.data.databaseId, organizationId: user.organizationId, deletedAt: null, ...scope },
  })
  if (!db) return { success: false, error: 'Base de datos no encontrada o sin acceso' }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.label       !== undefined) updateData.label          = parsed.data.label
  if (parsed.data.username    !== undefined) updateData.username       = parsed.data.username ?? ''
  if (parsed.data.accessLevel !== undefined) updateData.accessLevel    = parsed.data.accessLevel || null
  if (parsed.data.plainValue  !== undefined) updateData.encryptedValue = encrypt(parsed.data.plainValue)

  await prisma.databaseCredential.update({ where: { id: parsed.data.id }, data: updateData })

  revalidatePath(`/databases/${parsed.data.databaseId}`)
  return { success: true, data: undefined }
}

// ─── Delete Database Credential ───────────────────────────────────────────────

export async function deleteDatabaseCredential(
  credentialId: string,
  databaseId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'databases.credentials', 'delete', credentialId)

  const scope = getDataScope(user.id, user.roles, 'databases.credentials')

  const db = await prisma.database.findFirst({
    where: { id: databaseId, organizationId: user.organizationId, deletedAt: null, ...scope },
  })
  if (!db) return { success: false, error: 'Base de datos no encontrada o sin acceso' }

  await prisma.databaseCredential.update({
    where: { id: credentialId },
    data:  { deletedAt: new Date() },
  })

  revalidatePath(`/databases/${databaseId}`)
  return { success: true, data: undefined }
}

// ─── Reveal Database Credential ───────────────────────────────────────────────

export async function revealDatabaseCredential(
  credentialId: string,
  password: string,
): Promise<ActionResult<{ value: string }>> {
  const user = await getCurrentUser()
  await requirePermission(
    user.id,
    user.organizationId,
    'databases.credentials',
    'reveal',
    credentialId,
  )

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!fullUser) return { success: false, error: 'Usuario no encontrado' }

  const isValid = await verifyPassword(fullUser.passwordHash, password)
  if (!isValid) return { success: false, error: 'Contraseña incorrecta' }

  const credential = await prisma.databaseCredential.findFirst({
    where: { id: credentialId, deletedAt: null },
    include: { database: { select: { organizationId: true, id: true } } },
  })
  if (!credential || credential.database.organizationId !== user.organizationId) {
    return { success: false, error: 'Credencial no encontrada' }
  }

  let decryptedValue: string
  try {
    decryptedValue = decrypt(credential.encryptedValue)
  } catch {
    return { success: false, error: 'Error al descifrar la credencial' }
  }

  const headersList = await headers()
  const ipAddress =
    headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null

  await prisma.auditLog.create({
    data: {
      userId:     user.id,
      action:     'reveal',
      resource:   'databases.credentials',
      resourceId: credentialId,
      ipAddress,
      metadata: {
        databaseId: credential.database.id,
        label:      credential.label,
      },
    },
  }).catch(() => null)

  return { success: true, data: { value: decryptedValue } }
}
