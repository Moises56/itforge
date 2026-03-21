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

async function verifyEquipment(equipmentId: string, organizationId: string) {
  const eq = await prisma.networkEquipment.findFirst({
    where: { id: equipmentId, organizationId, deletedAt: null },
  })
  if (!eq) throw new Error('Equipo no encontrado')
  return eq
}

// ─── Create Equipment ─────────────────────────────────────────────────────────

const createEquipmentSchema = z.object({
  name:          z.string().min(1).max(200),
  type:          z.enum(['SWITCH', 'ROUTER', 'ACCESS_POINT', 'FIREWALL', 'UPS', 'OTHER']),
  brand:         z.string().max(100).optional(),
  model:         z.string().max(100).optional(),
  ip:            z.string().max(45).optional(),
  location:      z.string().max(300).optional(),
  managementUrl: z.string().url().max(500).optional().or(z.literal('')),
  totalPorts:    z.number().int().min(1).max(9999).optional().nullable(),
  firmware:      z.string().max(100).optional(),
  status:        z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).default('ACTIVE'),
  notes:         z.string().max(2000).optional(),
})

export async function createNetworkEquipment(
  input: z.infer<typeof createEquipmentSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'create')

  const parsed = createEquipmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const eq = await prisma.networkEquipment.create({
    data: {
      organizationId: user.organizationId,
      name:           parsed.data.name,
      type:           parsed.data.type,
      brand:          parsed.data.brand || null,
      model:          parsed.data.model || null,
      ip:             parsed.data.ip || null,
      location:       parsed.data.location || null,
      managementUrl:  parsed.data.managementUrl || null,
      totalPorts:     parsed.data.totalPorts ?? null,
      firmware:       parsed.data.firmware || null,
      status:         parsed.data.status,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath('/infrastructure/network')
  return { success: true, data: { id: eq.id } }
}

// ─── Update Equipment ─────────────────────────────────────────────────────────

const updateEquipmentSchema = z.object({
  id:            z.string().uuid(),
  name:          z.string().min(1).max(200).optional(),
  type:          z.enum(['SWITCH', 'ROUTER', 'ACCESS_POINT', 'FIREWALL', 'UPS', 'OTHER']).optional(),
  brand:         z.string().max(100).optional().nullable(),
  model:         z.string().max(100).optional().nullable(),
  ip:            z.string().max(45).optional().nullable(),
  location:      z.string().max(300).optional().nullable(),
  managementUrl: z.string().max(500).optional().nullable(),
  totalPorts:    z.number().int().min(1).max(9999).optional().nullable(),
  firmware:      z.string().max(100).optional().nullable(),
  status:        z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
  notes:         z.string().max(2000).optional().nullable(),
})

export async function updateNetworkEquipment(
  input: z.infer<typeof updateEquipmentSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'edit')

  const parsed = updateEquipmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyEquipment(parsed.data.id, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  const { id, ...rest } = parsed.data
  await prisma.networkEquipment.update({ where: { id }, data: rest })

  revalidatePath(`/infrastructure/network/${id}`)
  revalidatePath('/infrastructure/network')
  return { success: true, data: undefined }
}

// ─── Delete Equipment ─────────────────────────────────────────────────────────

export async function deleteNetworkEquipment(equipmentId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'delete', equipmentId)

  try {
    await verifyEquipment(equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  await prisma.networkEquipment.update({ where: { id: equipmentId }, data: { deletedAt: new Date() } })

  revalidatePath('/infrastructure/network')
  return { success: true, data: undefined }
}

// ─── Equipment Credentials ────────────────────────────────────────────────────

const createEqCredentialSchema = z.object({
  equipmentId: z.string().uuid(),
  label:       z.string().min(1).max(100),
  protocol:    z.enum(['SSH', 'WEB_PANEL', 'SNMP', 'OTHER']),
  port:        z.number().int().min(1).max(65535).optional().nullable(),
  username:    z.string().max(200).optional(),
  plainValue:  z.string().min(1).max(10000),
  notes:       z.string().max(500).optional(),
})

export async function createEquipmentCredential(
  input: z.infer<typeof createEqCredentialSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network.credentials', 'create')

  const parsed = createEqCredentialSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyEquipment(parsed.data.equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  const encryptedValue = encrypt(parsed.data.plainValue)

  const cred = await prisma.networkEquipmentCredential.create({
    data: {
      equipmentId:    parsed.data.equipmentId,
      label:          parsed.data.label,
      protocol:       parsed.data.protocol,
      port:           parsed.data.port ?? null,
      username:       parsed.data.username || null,
      encryptedValue,
      notes:          parsed.data.notes || null,
    },
  })

  revalidatePath(`/infrastructure/network/${parsed.data.equipmentId}`)
  return { success: true, data: { id: cred.id } }
}

export async function revealEquipmentCredential(
  credentialId: string,
  password: string,
): Promise<ActionResult<{ value: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network.credentials', 'reveal', credentialId)

  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
  if (!fullUser) return { success: false, error: 'Usuario no encontrado' }

  const isValid = await verifyPassword(fullUser.passwordHash, password)
  if (!isValid) return { success: false, error: 'Contraseña incorrecta' }

  const cred = await prisma.networkEquipmentCredential.findFirst({
    where:   { id: credentialId, deletedAt: null },
    include: { equipment: { select: { organizationId: true, id: true, name: true } } },
  })
  if (!cred || cred.equipment.organizationId !== user.organizationId) {
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
      userId: user.id, action: 'reveal', resource: 'infrastructure.network.credentials',
      resourceId: credentialId, ipAddress,
      metadata: { equipmentId: cred.equipment.id, name: cred.equipment.name, label: cred.label },
    },
  }).catch(() => null)

  return { success: true, data: { value: decryptedValue } }
}

export async function deleteEquipmentCredential(
  credentialId: string,
  equipmentId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network.credentials', 'delete', credentialId)

  try {
    await verifyEquipment(equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  await prisma.networkEquipmentCredential.update({ where: { id: credentialId }, data: { deletedAt: new Date() } })
  revalidatePath(`/infrastructure/network/${equipmentId}`)
  return { success: true, data: undefined }
}

// ─── Equipment Ports ──────────────────────────────────────────────────────────

const portSchema = z.object({
  equipmentId: z.string().uuid(),
  portNumber:  z.string().min(1).max(20),
  label:       z.string().max(100).optional(),
  vlan:        z.string().max(50).optional(),
  connectedTo: z.string().max(300).optional(),
  status:      z.string().max(20).default('unknown'),
  notes:       z.string().max(500).optional(),
})

export async function createEquipmentPort(
  input: z.infer<typeof portSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'edit')

  const parsed = portSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    await verifyEquipment(parsed.data.equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  const port = await prisma.networkEquipmentPort.create({
    data: {
      equipmentId: parsed.data.equipmentId,
      portNumber:  parsed.data.portNumber,
      label:       parsed.data.label || null,
      vlan:        parsed.data.vlan || null,
      connectedTo: parsed.data.connectedTo || null,
      status:      parsed.data.status,
      notes:       parsed.data.notes || null,
    },
  })

  revalidatePath(`/infrastructure/network/${parsed.data.equipmentId}`)
  return { success: true, data: { id: port.id } }
}

export async function updateEquipmentPort(input: {
  id: string; equipmentId: string; portNumber?: string; label?: string | null
  vlan?: string | null; connectedTo?: string | null; status?: string; notes?: string | null
}): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'edit')

  try {
    await verifyEquipment(input.equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  const { id, equipmentId: _e, ...data } = input
  await prisma.networkEquipmentPort.update({ where: { id }, data })
  revalidatePath(`/infrastructure/network/${input.equipmentId}`)
  return { success: true, data: undefined }
}

export async function deleteEquipmentPort(portId: string, equipmentId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'infrastructure.network', 'edit')

  try {
    await verifyEquipment(equipmentId, user.organizationId)
  } catch {
    return { success: false, error: 'Equipo no encontrado' }
  }

  await prisma.networkEquipmentPort.delete({ where: { id: portId } })
  revalidatePath(`/infrastructure/network/${equipmentId}`)
  return { success: true, data: undefined }
}
