'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { uploadFile, deleteFile, BUCKETS } from '@/core/storage/minio-client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function logAudit(
  userId: string,
  action: string,
  orgId: string,
  metadata: Record<string, unknown>,
) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  await prisma.auditLog.create({
    data: { userId, action, resource: 'system.config', resourceId: orgId, ipAddress: ip, metadata: metadata as never },
  }).catch(() => null)
}

// ─── Update Identity ──────────────────────────────────────────────────────────

const identitySchema = z.object({
  name:    z.string().min(1, 'El nombre es requerido').max(200),
  tagline: z.string().max(300).optional().nullable(),
})

export async function updateOrganizationIdentity(
  input: z.infer<typeof identitySchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      name:    parsed.data.name,
      tagline: parsed.data.tagline ?? null,
    },
  })

  await logAudit(user.id, 'update_identity', user.organizationId, {
    name:    parsed.data.name,
    tagline: parsed.data.tagline,
  })

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}

// ─── Upload Logo ──────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

export async function uploadLogo(formData: FormData): Promise<ActionResult<{ logoUrl: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const file = formData.get('logo')
  if (!(file instanceof File)) return { success: false, error: 'No se recibió archivo' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { success: false, error: 'Formato no soportado. Use PNG, JPG, SVG o WEBP.' }
  if (file.size > MAX_FILE_SIZE) return { success: false, error: 'El archivo no puede superar 2 MB' }

  const ext = file.name.split('.').pop() ?? 'png'
  const objectPath = `org/${user.organizationId}/logo.${ext}`

  // Delete old logo if exists (different extension)
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { logoPath: true } })
  if (org?.logoPath && org.logoPath !== objectPath) {
    await deleteFile(BUCKETS.system, org.logoPath).catch(() => null)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(BUCKETS.system, objectPath, buffer, file.type)

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { logoPath: objectPath },
  })

  await logAudit(user.id, 'upload_logo', user.organizationId, { objectPath, size: file.size })

  revalidatePath('/', 'layout')
  return { success: true, data: { logoUrl: `/api/org/favicon` } } // presigned URL generated client-side
}

// ─── Upload Favicon ───────────────────────────────────────────────────────────

export async function uploadFavicon(formData: FormData): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const file = formData.get('favicon')
  if (!(file instanceof File)) return { success: false, error: 'No se recibió archivo' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { success: false, error: 'Formato no soportado. Use PNG, ICO, JPG o SVG.' }
  if (file.size > 1024 * 1024) return { success: false, error: 'El favicon no puede superar 1 MB' }

  const ext = file.name.split('.').pop() ?? 'ico'
  const objectPath = `org/${user.organizationId}/favicon.${ext}`

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { faviconPath: true } })
  if (org?.faviconPath && org.faviconPath !== objectPath) {
    await deleteFile(BUCKETS.system, org.faviconPath).catch(() => null)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(BUCKETS.system, objectPath, buffer, file.type)

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { faviconPath: objectPath },
  })

  await logAudit(user.id, 'upload_favicon', user.organizationId, { objectPath })

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}

// ─── Update Theme Colors ──────────────────────────────────────────────────────

const hexColorRegex = /^#[0-9a-fA-F]{6}$/

const themeSchema = z.object({
  primary:   z.string().regex(hexColorRegex, 'Color primario inválido (usa formato #rrggbb)'),
  secondary: z.string().regex(hexColorRegex, 'Color secundario inválido'),
  accent:    z.string().regex(hexColorRegex, 'Color de acento inválido'),
})

export async function updateThemeColors(
  input: z.infer<typeof themeSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = themeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      primaryColor:   parsed.data.primary,
      secondaryColor: parsed.data.secondary,
      accentColor:    parsed.data.accent,
    },
  })

  await logAudit(user.id, 'update_theme', user.organizationId, {
    primary:   parsed.data.primary,
    secondary: parsed.data.secondary,
    accent:    parsed.data.accent,
  })

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}

// ─── Toggle Module ────────────────────────────────────────────────────────────

const moduleSchema = z.object({
  module:  z.enum(['development', 'infrastructure', 'support']),
  enabled: z.boolean(),
})

export async function toggleModule(
  input: z.infer<typeof moduleSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = moduleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Módulo inválido' }

  const field = {
    development:    'developmentEnabled',
    infrastructure: 'infrastructureEnabled',
    support:        'supportEnabled',
  }[parsed.data.module] as 'developmentEnabled' | 'infrastructureEnabled' | 'supportEnabled'

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { [field]: parsed.data.enabled },
  })

  await logAudit(user.id, 'toggle_module', user.organizationId, {
    module:  parsed.data.module,
    enabled: parsed.data.enabled,
  })

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}

// ─── Update Terminology ───────────────────────────────────────────────────────

const terminologySchema = z.object({
  department: z.string().min(1, 'El label de departamento es requerido').max(50),
  project:    z.string().min(1, 'El label de proyecto es requerido').max(50),
})

export async function updateTerminology(
  input: z.infer<typeof terminologySchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'system.config', 'edit')

  const parsed = terminologySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      terminology: {
        department: parsed.data.department,
        project:    parsed.data.project,
      },
    },
  })

  await logAudit(user.id, 'update_terminology', user.organizationId, {
    department: parsed.data.department,
    project:    parsed.data.project,
  })

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}
