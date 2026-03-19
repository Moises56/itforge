'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { uploadFile, deleteFile, getPresignedUrl, BUCKETS } from '@/core/storage/minio-client'
import type { DocumentType } from '@/generated/prisma/client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
])

const VALID_DOC_TYPES = [
  'SCREENSHOT',
  'TECHNICAL_DOC',
  'USER_MANUAL',
  'ARCHITECTURE_DIAGRAM',
  'CONFIG_FILE',
  'OTHER',
] as const

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const file      = formData.get('file')      as File   | null
  const projectId = formData.get('projectId') as string | null
  const title     = formData.get('title')     as string | null
  const docType   = formData.get('type')      as string | null

  if (!file || !projectId || !title?.trim() || !docType) {
    return { success: false, error: 'Faltan datos requeridos (archivo, proyecto, título, tipo)' }
  }

  if (!VALID_DOC_TYPES.includes(docType as DocumentType)) {
    return { success: false, error: 'Tipo de documento inválido' }
  }

  if (file.size === 0) {
    return { success: false, error: 'El archivo está vacío' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'El archivo supera el límite de 50 MB' }
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { success: false, error: `Tipo de archivo no permitido: ${mimeType}` }
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const timestamp = Date.now()
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  const objectPath = `projects/${projectId}/${timestamp}-${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await uploadFile(BUCKETS.dev, objectPath, buffer, mimeType, {
      'x-amz-meta-project-id':  projectId,
      'x-amz-meta-uploaded-by': user.id,
      'x-amz-meta-original-name': file.name.slice(0, 200),
    })
  } catch (err) {
    console.error('[documents] MinIO upload error:', err)
    return { success: false, error: 'Error al subir el archivo. Verifica que MinIO esté corriendo.' }
  }

  const document = await prisma.projectDocument.create({
    data: {
      projectId,
      title:       title.trim(),
      type:        docType as DocumentType,
      filePath:    objectPath,
      fileSize:    file.size,
      mimeType,
      uploadedById: user.id,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: { id: document.id } }
}

// ─── Generate presigned download URL ─────────────────────────────────────────

const getUrlSchema = z.object({
  docId:     z.string().uuid(),
  projectId: z.string().uuid(),
})

export async function getDocumentDownloadUrl(
  docId: string,
  projectId: string,
): Promise<ActionResult<{ url: string; filename: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'view')

  const parsed = getUrlSchema.safeParse({ docId, projectId })
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const doc = await prisma.projectDocument.findFirst({
    where: {
      id:       parsed.data.docId,
      projectId: parsed.data.projectId,
      deletedAt: null,
      project: { organizationId: user.organizationId, deletedAt: null },
    },
    select: { filePath: true, title: true, mimeType: true },
  })
  if (!doc) return { success: false, error: 'Documento no encontrado' }

  try {
    const url = await getPresignedUrl(BUCKETS.dev, doc.filePath, 300)
    return { success: true, data: { url, filename: doc.title } }
  } catch (err) {
    console.error('[documents] Presign error:', err)
    return { success: false, error: 'Error al generar URL de descarga' }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDocument(
  docId: string,
  projectId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects', 'edit')

  const doc = await prisma.projectDocument.findFirst({
    where: {
      id:        docId,
      projectId,
      deletedAt: null,
      project: { organizationId: user.organizationId, deletedAt: null },
    },
    select: { filePath: true },
  })
  if (!doc) return { success: false, error: 'Documento no encontrado' }

  // Soft delete in DB
  await prisma.projectDocument.update({
    where: { id: docId },
    data:  { deletedAt: new Date() },
  })

  // Best-effort removal from MinIO
  await deleteFile(BUCKETS.dev, doc.filePath).catch(() => null)

  revalidatePath(`/projects/${projectId}`)
  return { success: true, data: undefined }
}
