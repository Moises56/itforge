'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { requirePermission } from '@/core/permissions/middleware'
import { uploadFile, deleteFile, getPresignedUrl, BUCKETS } from '@/core/storage/minio-client'
import type { ChangeRequestStatus, ChangeRequestType, Priority } from '@/generated/prisma/client'

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Status transition rules ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED:    ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'REQUESTED'],
  APPROVED:     ['IN_PROGRESS', 'CANCELLED'],
  REJECTED:     ['REQUESTED'],
  IN_PROGRESS:  ['COMPLETED', 'CANCELLED'],
  COMPLETED:    [],
  CANCELLED:    ['REQUESTED'],
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED:    'Solicitado',
  UNDER_REVIEW: 'En Revisión',
  APPROVED:     'Aprobado',
  REJECTED:     'Rechazado',
  IN_PROGRESS:  'En Progreso',
  COMPLETED:    'Completado',
  CANCELLED:    'Cancelado',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCRWithOrg(changeRequestId: string, organizationId: string) {
  return prisma.changeRequest.findFirst({
    where: {
      id: changeRequestId,
      deletedAt: null,
      project: { organizationId },
    },
    include: { project: { select: { id: true, organizationId: true } } },
  })
}

async function logAudit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  await prisma.auditLog.create({
    data: { userId, action, resource, resourceId, ipAddress, metadata: metadata as never },
  }).catch(() => null)
}

function revalidateAll(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/changes`)
  revalidatePath('/change-requests')
}

// ─── Create ───────────────────────────────────────────────────────────────────

const createCRSchema = z.object({
  projectId:             z.string().uuid(),
  title:                 z.string().min(1, 'El título es requerido').max(200),
  description:           z.string().max(5000).optional().nullable(),
  requesterName:         z.string().min(1, 'El nombre del solicitante es requerido').max(200),
  requesterDepartmentId: z.string().uuid().optional().nullable(),
  type:                  z.enum(['NEW_FEATURE', 'MODIFICATION', 'BUG_FIX', 'DATA_CORRECTION', 'REPORT', 'VISUAL_CHANGE', 'OTHER']),
  priority:              z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  assignedToId:          z.string().uuid().optional().nullable(),
})

export async function createChangeRequest(
  input: z.infer<typeof createCRSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'create')

  const parsed = createCRSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, organizationId: user.organizationId, deletedAt: null },
  })
  if (!project) return { success: false, error: 'Proyecto no encontrado' }

  const cr = await prisma.changeRequest.create({
    data: {
      projectId:             parsed.data.projectId,
      title:                 parsed.data.title,
      description:           parsed.data.description ?? null,
      requestedById:         user.id,
      requesterName:         parsed.data.requesterName,
      requesterDepartmentId: parsed.data.requesterDepartmentId ?? null,
      type:                  parsed.data.type as ChangeRequestType,
      priority:              parsed.data.priority as Priority,
      assignedToId:          parsed.data.assignedToId ?? null,
      status:                'REQUESTED' as ChangeRequestStatus,
    },
  })

  await logAudit(user.id, 'create', 'projects.change-requests', cr.id, {
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    status: 'REQUESTED',
  })

  revalidateAll(parsed.data.projectId)
  return { success: true, data: { id: cr.id } }
}

// ─── Update ───────────────────────────────────────────────────────────────────

const updateCRSchema = z.object({
  id:                    z.string().uuid(),
  projectId:             z.string().uuid(),
  title:                 z.string().min(1).max(200).optional(),
  description:           z.string().max(5000).optional().nullable(),
  requesterName:         z.string().min(1).max(200).optional(),
  requesterDepartmentId: z.string().uuid().optional().nullable(),
  type:                  z.enum(['NEW_FEATURE', 'MODIFICATION', 'BUG_FIX', 'DATA_CORRECTION', 'REPORT', 'VISUAL_CHANGE', 'OTHER']).optional(),
  priority:              z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assignedToId:          z.string().uuid().optional().nullable(),
})

export async function updateChangeRequest(
  input: z.infer<typeof updateCRSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'edit')

  const parsed = updateCRSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const cr = await getCRWithOrg(parsed.data.id, user.organizationId)
  if (!cr) return { success: false, error: 'Solicitud no encontrada' }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.title                 !== undefined) updateData.title                 = parsed.data.title
  if (parsed.data.description           !== undefined) updateData.description           = parsed.data.description
  if (parsed.data.requesterName         !== undefined) updateData.requesterName         = parsed.data.requesterName
  if (parsed.data.requesterDepartmentId !== undefined) updateData.requesterDepartmentId = parsed.data.requesterDepartmentId
  if (parsed.data.type                  !== undefined) updateData.type                  = parsed.data.type as ChangeRequestType
  if (parsed.data.priority              !== undefined) updateData.priority              = parsed.data.priority as Priority
  if (parsed.data.assignedToId          !== undefined) updateData.assignedToId          = parsed.data.assignedToId

  await prisma.changeRequest.update({ where: { id: parsed.data.id }, data: updateData })

  revalidateAll(parsed.data.projectId)
  return { success: true, data: undefined }
}

// ─── Change Status ────────────────────────────────────────────────────────────

const changeStatusSchema = z.object({
  changeRequestId: z.string().uuid(),
  newStatus:       z.enum(['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  rejectionReason: z.string().max(1000).optional().nullable(),
  completionNotes: z.string().max(2000).optional().nullable(),
})

export async function changeStatus(
  input: z.infer<typeof changeStatusSchema>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'change_status')

  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  const cr = await getCRWithOrg(parsed.data.changeRequestId, user.organizationId)
  if (!cr) return { success: false, error: 'Solicitud no encontrada' }

  const { newStatus } = parsed.data
  const allowed = VALID_TRANSITIONS[cr.status] ?? []
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Transición no permitida: ${STATUS_LABELS[cr.status] ?? cr.status} → ${STATUS_LABELS[newStatus] ?? newStatus}`,
    }
  }

  if (newStatus === 'REJECTED' && !parsed.data.rejectionReason?.trim()) {
    return { success: false, error: 'Se requiere un motivo de rechazo' }
  }

  const updateData: Record<string, unknown> = { status: newStatus as ChangeRequestStatus }
  if (newStatus === 'REJECTED')    updateData.rejectionReason = parsed.data.rejectionReason
  if (newStatus === 'IN_PROGRESS') updateData.startedAt       = new Date()
  if (newStatus === 'COMPLETED') {
    updateData.completedAt = new Date()
    if (parsed.data.completionNotes?.trim()) updateData.completionNotes = parsed.data.completionNotes
  }
  // Clear rejection reason when re-opening
  if (newStatus === 'REQUESTED') {
    updateData.rejectionReason = null
    updateData.completionNotes = null
    updateData.startedAt       = null
    updateData.completedAt     = null
  }

  await prisma.changeRequest.update({ where: { id: parsed.data.changeRequestId }, data: updateData })

  await logAudit(user.id, 'change_status', 'projects.change-requests', parsed.data.changeRequestId, {
    fromStatus:      cr.status,
    toStatus:        newStatus,
    projectId:       cr.project.id,
    rejectionReason: parsed.data.rejectionReason ?? null,
    completionNotes: parsed.data.completionNotes ?? null,
  })

  revalidateAll(cr.project.id)
  return { success: true, data: undefined }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(
  changeRequestId: string,
  content: string,
): Promise<ActionResult<{ id: string; content: string; createdAt: string; authorName: string; authorId: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'view')

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) {
    return { success: false, error: 'El comentario debe tener entre 1 y 2000 caracteres' }
  }

  const cr = await getCRWithOrg(changeRequestId, user.organizationId)
  if (!cr) return { success: false, error: 'Solicitud no encontrada' }

  const comment = await prisma.changeRequestComment.create({
    data: { changeRequestId, userId: user.id, content: trimmed },
    include: { user: { select: { firstName: true, lastName: true } } },
  })

  revalidateAll(cr.project.id)
  return {
    success: true,
    data: {
      id:         comment.id,
      content:    comment.content,
      createdAt:  comment.createdAt.toISOString(),
      authorName: `${comment.user.firstName} ${comment.user.lastName}`,
      authorId:   user.id,
    },
  }
}

export async function updateComment(
  commentId: string,
  content: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) {
    return { success: false, error: 'Comentario inválido' }
  }

  const comment = await prisma.changeRequestComment.findFirst({
    where: { id: commentId, deletedAt: null, userId: user.id },
    include: { changeRequest: { include: { project: { select: { organizationId: true, id: true } } } } },
  })
  if (!comment || comment.changeRequest.project.organizationId !== user.organizationId) {
    return { success: false, error: 'Comentario no encontrado' }
  }

  await prisma.changeRequestComment.update({ where: { id: commentId }, data: { content: trimmed } })

  revalidateAll(comment.changeRequest.project.id)
  return { success: true, data: undefined }
}

export async function deleteComment(commentId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()

  const comment = await prisma.changeRequestComment.findFirst({
    where: { id: commentId, deletedAt: null },
    include: { changeRequest: { include: { project: { select: { organizationId: true, id: true } } } } },
  })
  if (!comment || comment.changeRequest.project.organizationId !== user.organizationId) {
    return { success: false, error: 'Comentario no encontrado' }
  }

  if (comment.userId !== user.id) {
    await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'delete')
  }

  await prisma.changeRequestComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } })

  revalidateAll(comment.changeRequest.project.id)
  return { success: true, data: undefined }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
])

export async function addAttachment(
  formData: FormData,
): Promise<ActionResult<{ id: string; fileName: string; fileSize: number | null; mimeType: string | null; createdAt: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'edit')

  const file            = formData.get('file')            as File   | null
  const changeRequestId = formData.get('changeRequestId') as string | null

  if (!file || !changeRequestId) return { success: false, error: 'Faltan datos requeridos' }
  if (file.size > MAX_FILE_SIZE)  return { success: false, error: 'El archivo excede el límite de 50 MB' }
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { success: false, error: 'Tipo de archivo no permitido' }

  const cr = await getCRWithOrg(changeRequestId, user.organizationId)
  if (!cr) return { success: false, error: 'Solicitud no encontrada' }

  const buffer     = Buffer.from(await file.arrayBuffer())
  const timestamp  = Date.now()
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const objectPath = `change-requests/${changeRequestId}/${timestamp}-${safeName}`

  await uploadFile(BUCKETS.dev, objectPath, buffer, file.type, {
    'x-uploader-id':       user.id,
    'x-change-request-id': changeRequestId,
  })

  const attachment = await prisma.changeRequestAttachment.create({
    data: {
      changeRequestId,
      filePath:     objectPath,
      fileName:     file.name,
      fileSize:     file.size,
      mimeType:     file.type,
      uploadedById: user.id,
    },
  })

  revalidateAll(cr.project.id)
  return {
    success: true,
    data: {
      id:        attachment.id,
      fileName:  attachment.fileName,
      fileSize:  attachment.fileSize,
      mimeType:  attachment.mimeType,
      createdAt: attachment.createdAt.toISOString(),
    },
  }
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'edit')

  const attachment = await prisma.changeRequestAttachment.findFirst({
    where: { id: attachmentId },
    include: { changeRequest: { include: { project: { select: { organizationId: true, id: true } } } } },
  })
  if (!attachment || attachment.changeRequest.project.organizationId !== user.organizationId) {
    return { success: false, error: 'Adjunto no encontrado' }
  }

  await deleteFile(BUCKETS.dev, attachment.filePath).catch(() => null)
  await prisma.changeRequestAttachment.delete({ where: { id: attachmentId } })

  revalidateAll(attachment.changeRequest.project.id)
  return { success: true, data: undefined }
}

export async function getAttachmentDownloadUrl(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'view')

  const attachment = await prisma.changeRequestAttachment.findFirst({
    where: { id: attachmentId },
    include: { changeRequest: { include: { project: { select: { organizationId: true } } } } },
  })
  if (!attachment || attachment.changeRequest.project.organizationId !== user.organizationId) {
    return { success: false, error: 'Adjunto no encontrado' }
  }

  const url = await getPresignedUrl(BUCKETS.dev, attachment.filePath, 300)
  return { success: true, data: { url } }
}

// ─── Detail (data-fetching action) ───────────────────────────────────────────

export type CRDetail = {
  id:                   string
  title:                string
  description:          string | null
  status:               string
  priority:             string
  type:                 string
  requesterName:        string
  requesterDepartment:  { id: string; name: string } | null
  requestedBy:          { id: string; firstName: string; lastName: string } | null
  assignedTo:           { id: string; firstName: string; lastName: string } | null
  rejectionReason:      string | null
  completionNotes:      string | null
  startedAt:            string | null
  completedAt:          string | null
  createdAt:            string
  updatedAt:            string
  comments: Array<{
    id:         string
    content:    string
    authorId:   string
    authorName: string
    createdAt:  string
    updatedAt:  string
  }>
  attachments: Array<{
    id:           string
    fileName:     string
    fileSize:     number | null
    mimeType:     string | null
    uploaderName: string | null
    createdAt:    string
  }>
  timeline: Array<{
    id:        string
    action:    string
    actorName: string
    metadata:  Record<string, unknown>
    createdAt: string
  }>
}

export async function getChangeRequestDetail(
  changeRequestId: string,
): Promise<ActionResult<CRDetail>> {
  const user = await getCurrentUser()
  await requirePermission(user.id, user.organizationId, 'projects.change-requests', 'view')

  const cr = await prisma.changeRequest.findFirst({
    where: { id: changeRequestId, deletedAt: null, project: { organizationId: user.organizationId } },
    include: {
      requesterDepartment: { select: { id: true, name: true } },
      requestedBy:         { select: { id: true, firstName: true, lastName: true } },
      assignedTo:          { select: { id: true, firstName: true, lastName: true } },
      comments: {
        where:   { deletedAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!cr) return { success: false, error: 'Solicitud no encontrada' }

  const auditLogs = await prisma.auditLog.findMany({
    where:   { resource: 'projects.change-requests', resourceId: changeRequestId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return {
    success: true,
    data: {
      id:                  cr.id,
      title:               cr.title,
      description:         cr.description,
      status:              cr.status,
      priority:            cr.priority,
      type:                cr.type,
      requesterName:       cr.requesterName,
      requesterDepartment: cr.requesterDepartment ?? null,
      requestedBy:         cr.requestedBy ?? null,
      assignedTo:          cr.assignedTo ?? null,
      rejectionReason:     cr.rejectionReason,
      completionNotes:     cr.completionNotes,
      startedAt:           cr.startedAt?.toISOString() ?? null,
      completedAt:         cr.completedAt?.toISOString() ?? null,
      createdAt:           cr.createdAt.toISOString(),
      updatedAt:           cr.updatedAt.toISOString(),
      comments: cr.comments.map((c) => ({
        id:         c.id,
        content:    c.content,
        authorId:   c.user.id,
        authorName: `${c.user.firstName} ${c.user.lastName}`,
        createdAt:  c.createdAt.toISOString(),
        updatedAt:  c.updatedAt.toISOString(),
      })),
      attachments: cr.attachments.map((a) => ({
        id:           a.id,
        fileName:     a.fileName,
        fileSize:     a.fileSize,
        mimeType:     a.mimeType,
        uploaderName: a.uploadedBy ? `${a.uploadedBy.firstName} ${a.uploadedBy.lastName}` : null,
        createdAt:    a.createdAt.toISOString(),
      })),
      timeline: auditLogs.map((l) => ({
        id:        l.id,
        action:    l.action,
        actorName: `${l.user.firstName} ${l.user.lastName}`,
        metadata:  (l.metadata as Record<string, unknown>) ?? {},
        createdAt: l.createdAt.toISOString(),
      })),
    },
  }
}