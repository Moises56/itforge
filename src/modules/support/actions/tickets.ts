'use server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { revalidatePath } from 'next/cache'

async function getNextTicketNumber(organizationId: string): Promise<string> {
  const last = await prisma.supportTicket.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true },
  })
  if (!last) return 'TK-0001'
  const num = parseInt(last.ticketNumber.replace('TK-', ''), 10)
  return `TK-${String(num + 1).padStart(4, '0')}`
}

const CreateSchema = z.object({
  title:                   z.string().min(3),
  description:             z.string().optional(),
  type:                    z.enum(['HARDWARE_REPAIR','SOFTWARE_INSTALL','ACCESS_REQUEST','NETWORK_ISSUE','PRINTER_ISSUE','GENERAL_SUPPORT','OTHER']),
  priority:                z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),
  requestedByName:         z.string().min(2),
  requestedByDepartmentId: z.string().optional(),
  assignedToId:            z.string().optional(),
  assetId:                 z.string().optional(),
  projectId:               z.string().optional(),
  serverId:                z.string().optional(),
})

export async function createSupportTicket(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser()
    const raw = {
      title:                   formData.get('title'),
      description:             formData.get('description') ?? undefined,
      type:                    formData.get('type'),
      priority:                formData.get('priority'),
      requestedByName:         formData.get('requestedByName'),
      requestedByDepartmentId: (formData.get('requestedByDepartmentId') as string) || undefined,
      assignedToId:            (formData.get('assignedToId') as string) || undefined,
      assetId:                 (formData.get('assetId') as string) || undefined,
      projectId:               (formData.get('projectId') as string) || undefined,
      serverId:                (formData.get('serverId') as string) || undefined,
    }
    const data = CreateSchema.parse(raw)
    const ticketNumber = await getNextTicketNumber(user.organizationId)

    const ticket = await prisma.supportTicket.create({
      data: {
        ...data,
        ticketNumber,
        organizationId: user.organizationId,
      },
    })
    revalidatePath('/support/tickets')
    return { success: true, id: ticket.id }
  } catch (e) {
    console.error('createSupportTicket', e)
    return { success: false, error: 'Error al crear el ticket.' }
  }
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: string,
  extra?: Record<string, unknown>,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser()
    const now  = new Date()
    const updateData: Record<string, unknown> = { status: newStatus }
    if (extra?.assignedToId) updateData.assignedToId = extra.assignedToId
    if (extra?.resolution)   updateData.resolution   = extra.resolution
    if (newStatus === 'RESOLVED') updateData.resolvedAt = now
    if (newStatus === 'CLOSED')   updateData.closedAt   = now

    await prisma.supportTicket.updateMany({
      where: { id: ticketId, organizationId: user.organizationId },
      data:  updateData,
    })
    revalidatePath(`/support/tickets/${ticketId}`)
    return { success: true }
  } catch (e) {
    console.error('updateTicketStatus', e)
    return { success: false, error: 'Error al actualizar el ticket.' }
  }
}

export async function addTicketComment(ticketId: string, content: string, isInternal: boolean) {
  const user = await getCurrentUser()
  await prisma.supportTicketComment.create({
    data: { ticketId, userId: user.id, content, isInternal },
  })
  revalidatePath(`/support/tickets/${ticketId}`)
}
