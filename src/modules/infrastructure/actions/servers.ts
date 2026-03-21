'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { encrypt, decrypt, verifyPassword } from '@/core/crypto/encryption'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyServer(serverId: string, organizationId: string) {
  const server = await prisma.server.findFirst({
    where: { id: serverId, organizationId, deletedAt: null },
  })
  if (!server) throw new Error('Servidor no encontrado')
  return server
}

// ─── Create Server ────────────────────────────────────────────────────────────

const createServerSchema = z.object({
  hostname:    z.string().min(1, 'El hostname es requerido').max(253),
  displayName: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  ip:          z.string().min(1, 'La IP es requerida').max(45),
  secondaryIp: z.string().max(45).optional(),
  os:          z.enum(['WINDOWS_SERVER', 'UBUNTU', 'CENTOS', 'DEBIAN', 'RHEL', 'OTHER']),
  type:        z.enum(['PHYSICAL', 'VIRTUAL', 'CONTAINER']),
  groupId:     z.string().uuid().optional().nullable(),
  specs:       z.object({
    cpu:  z.string().max(200).optional(),
    ram:  z.string().max(100).optional(),
    disk: z.string().max(200).optional(),
  }).optional(),
  location:    z.string().max(300).optional(),
  domain:      z.string().max(200).optional(),
  status:      z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'DECOMMISSIONED']).default('ACTIVE'),
  notes:       z.string().max(2000).optional(),
})

export async function createServer(
  input: z.infer<typeof createServerSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'create')

  const parsed = createServerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const server = await prisma.server.create({
    data: {
      organizationId: user.organizationId,
      hostname:       parsed.data.hostname,
      displayName:    parsed.data.displayName || null,
      description:    parsed.data.description || null,
      ip:             parsed.data.ip,
      secondaryIp:    parsed.data.secondaryIp || null,
      os:             parsed.data.os,
      type:           parsed.data.type,
      groupId:        parsed.data.groupId ?? null,
      specs:          parsed.data.specs ?? {},
      location:       parsed.data.location || null,
      domain:         parsed.data.domain || null,
      status:         parsed.data.status,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath('/infrastructure/servers')
  return { success: true, data: { id: server.id } }
}

// ─── Update Server ────────────────────────────────────────────────────────────

const updateServerSchema = z.object({
  id:          z.string().uuid(),
  hostname:    z.string().min(1).max(253).optional(),
  displayName: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  ip:          z.string().min(1).max(45).optional(),
  secondaryIp: z.string().max(45).optional().nullable(),
  os:          z.enum(['WINDOWS_SERVER', 'UBUNTU', 'CENTOS', 'DEBIAN', 'RHEL', 'OTHER']).optional(),
  type:        z.enum(['PHYSICAL', 'VIRTUAL', 'CONTAINER']).optional(),
  groupId:     z.string().uuid().optional().nullable(),
  specs:       z.object({
    cpu:  z.string().max(200).optional(),
    ram:  z.string().max(100).optional(),
    disk: z.string().max(200).optional(),
  }).optional(),
  location:    z.string().max(300).optional().nullable(),
  domain:      z.string().max(200).optional().nullable(),
  status:      z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE', 'DECOMMISSIONED']).optional(),
  notes:       z.string().max(2000).optional().nullable(),
})

export async function updateServer(
  input: z.infer<typeof updateServerSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'edit')

  const parsed = updateServerSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyServer(parsed.data.id, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  const { id, ...rest } = parsed.data
  await prisma.server.update({ where: { id }, data: rest })

  revalidatePath(`/infrastructure/servers/${id}`)
  revalidatePath('/infrastructure/servers')
  return { success: true, data: undefined }
}

// ─── Delete Server (soft) ─────────────────────────────────────────────────────

export async function deleteServer(serverId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'delete', serverId)

  try {
    await verifyServer(serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  await prisma.server.update({ where: { id: serverId }, data: { deletedAt: new Date() } })

  revalidatePath('/infrastructure/servers')
  return { success: true, data: undefined }
}

// ─── Server Credentials ───────────────────────────────────────────────────────

const createServerCredentialSchema = z.object({
  serverId:   z.string().uuid(),
  label:      z.string().min(1).max(100),
  protocol:   z.enum(['RDP', 'SSH', 'WEB_PANEL', 'IPMI', 'VNC', 'OTHER']),
  port:       z.number().int().min(1).max(65535).optional().nullable(),
  username:   z.string().max(200).optional(),
  plainValue: z.string().min(1, 'El valor es requerido').max(10000),
  domain:     z.string().max(200).optional(),
  isDefault:  z.boolean().default(false),
  notes:      z.string().max(500).optional(),
})

export async function createServerCredential(
  input: z.infer<typeof createServerCredentialSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers.credentials', 'create')

  const parsed = createServerCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyServer(parsed.data.serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  const encryptedValue = encrypt(parsed.data.plainValue)

  const cred = await prisma.serverCredential.create({
    data: {
      serverId:       parsed.data.serverId,
      label:          parsed.data.label,
      protocol:       parsed.data.protocol,
      port:           parsed.data.port ?? null,
      username:       parsed.data.username || null,
      encryptedValue,
      domain:         parsed.data.domain || null,
      isDefault:      parsed.data.isDefault,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath(`/infrastructure/servers/${parsed.data.serverId}`)
  return { success: true, data: { id: cred.id } }
}

export async function revealServerCredential(
  credentialId: string,
  password: string,
): Promise<ActionResult<{ value: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers.credentials', 'reveal', credentialId)

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
  if (!fullUser) return { success: false, error: 'Usuario no encontrado' }

  const isValid = await verifyPassword(fullUser.passwordHash, password)
  if (!isValid) return { success: false, error: 'Contraseña incorrecta' }

  const cred = await prisma.serverCredential.findFirst({
    where:   { id: credentialId, deletedAt: null },
    include: { server: { select: { organizationId: true, id: true, hostname: true } } },
  })
  if (!cred || cred.server.organizationId !== user.organizationId) {
    return { success: false, error: 'Credencial no encontrada' }
  }

  let decryptedValue: string
  try {
    decryptedValue = decrypt(cred.encryptedValue)
  } catch {
    return { success: false, error: 'Error al descifrar la credencial' }
  }

  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null

  await prisma.auditLog.create({
    data: {
      userId: user.id, action: 'reveal', resource: 'infrastructure.servers.credentials',
      resourceId: credentialId, ipAddress,
      metadata: { serverId: cred.server.id, hostname: cred.server.hostname, label: cred.label, protocol: cred.protocol },
    },
  }).catch(() => null)

  return { success: true, data: { value: decryptedValue } }
}

const updateServerCredentialSchema = z.object({
  id:         z.string().uuid(),
  serverId:   z.string().uuid(),
  label:      z.string().min(1).max(100).optional(),
  protocol:   z.enum(['RDP', 'SSH', 'WEB_PANEL', 'IPMI', 'VNC', 'OTHER']).optional(),
  port:       z.number().int().min(1).max(65535).optional().nullable(),
  username:   z.string().max(200).optional().nullable(),
  plainValue: z.string().min(1).max(10000).optional(),
  domain:     z.string().max(200).optional().nullable(),
  isDefault:  z.boolean().optional(),
  notes:      z.string().max(500).optional().nullable(),
})

export async function updateServerCredential(
  input: z.infer<typeof updateServerCredentialSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers.credentials', 'edit')

  const parsed = updateServerCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyServer(parsed.data.serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.label     !== undefined) updateData.label         = parsed.data.label
  if (parsed.data.protocol  !== undefined) updateData.protocol      = parsed.data.protocol
  if (parsed.data.port      !== undefined) updateData.port          = parsed.data.port
  if (parsed.data.username  !== undefined) updateData.username      = parsed.data.username
  if (parsed.data.domain    !== undefined) updateData.domain        = parsed.data.domain
  if (parsed.data.isDefault !== undefined) updateData.isDefault     = parsed.data.isDefault
  if (parsed.data.notes     !== undefined) updateData.notes         = parsed.data.notes
  if (parsed.data.plainValue !== undefined) updateData.encryptedValue = encrypt(parsed.data.plainValue)

  await prisma.serverCredential.update({ where: { id: parsed.data.id }, data: updateData })
  revalidatePath(`/infrastructure/servers/${parsed.data.serverId}`)
  return { success: true, data: undefined }
}

export async function deleteServerCredential(
  credentialId: string,
  serverId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers.credentials', 'delete', credentialId)

  try {
    await verifyServer(serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  await prisma.serverCredential.update({ where: { id: credentialId }, data: { deletedAt: new Date() } })
  revalidatePath(`/infrastructure/servers/${serverId}`)
  return { success: true, data: undefined }
}

// ─── Server Services ──────────────────────────────────────────────────────────

const serviceSchema = z.object({
  serverId:  z.string().uuid(),
  name:      z.string().min(1).max(100),
  port:      z.number().int().min(1).max(65535).optional().nullable(),
  protocol:  z.string().max(20).optional(),
  status:    z.enum(['RUNNING', 'STOPPED', 'UNKNOWN']).default('UNKNOWN'),
  notes:     z.string().max(500).optional(),
})

export async function createServerService(
  input: z.infer<typeof serviceSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'edit')

  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyServer(parsed.data.serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  const svc = await prisma.serverService.create({
    data: {
      serverId: parsed.data.serverId,
      name:     parsed.data.name,
      port:     parsed.data.port ?? null,
      protocol: parsed.data.protocol || null,
      status:   parsed.data.status,
      notes:    parsed.data.notes || null,
    },
  })

  revalidatePath(`/infrastructure/servers/${parsed.data.serverId}`)
  return { success: true, data: { id: svc.id } }
}

export async function updateServerService(input: {
  id: string; serverId: string; name?: string; port?: number | null
  protocol?: string; status?: 'RUNNING' | 'STOPPED' | 'UNKNOWN'; notes?: string | null
}): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'edit')

  try {
    await verifyServer(input.serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  const { id, serverId: _s, ...data } = input
  await prisma.serverService.update({ where: { id }, data })
  revalidatePath(`/infrastructure/servers/${input.serverId}`)
  return { success: true, data: undefined }
}

export async function deleteServerService(serviceId: string, serverId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.servers', 'edit')

  try {
    await verifyServer(serverId, user.organizationId)
  } catch {
    return { success: false, error: 'Servidor no encontrado' }
  }

  await prisma.serverService.delete({ where: { id: serviceId } })
  revalidatePath(`/infrastructure/servers/${serverId}`)
  return { success: true, data: undefined }
}
