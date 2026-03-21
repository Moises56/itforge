'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { revalidatePath } from 'next/cache'

const CreateSchema = z.object({
  fullName:       z.string().min(2),
  username:       z.string().min(1),
  domain:         z.string().optional(),
  email:          z.string().email().optional().or(z.literal('')),
  departmentId:   z.string().optional(),
  accountType:    z.enum(['DOMAIN_AD', 'EMAIL', 'VPN', 'SYSTEM_ACCESS', 'OTHER']),
  status:         z.enum(['ACTIVE', 'DISABLED', 'EXPIRED']).default('ACTIVE'),
  createdDate:    z.string().optional(),
  expirationDate: z.string().optional(),
  notes:          z.string().optional(),
})

export async function createUserAccount(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser()
    const raw = {
      fullName:       formData.get('fullName'),
      username:       formData.get('username'),
      domain:         (formData.get('domain') as string) || undefined,
      email:          (formData.get('email') as string) || undefined,
      departmentId:   (formData.get('departmentId') as string) || undefined,
      accountType:    formData.get('accountType'),
      status:         (formData.get('status') as string) || 'ACTIVE',
      createdDate:    (formData.get('createdDate') as string) || undefined,
      expirationDate: (formData.get('expirationDate') as string) || undefined,
      notes:          (formData.get('notes') as string) || undefined,
    }
    const data = CreateSchema.parse(raw)

    const account = await prisma.userAccount.create({
      data: {
        organizationId: user.organizationId,
        fullName:       data.fullName,
        username:       data.username,
        domain:         data.domain,
        email:          data.email || undefined,
        departmentId:   data.departmentId,
        accountType:    data.accountType,
        status:         data.status,
        createdDate:    data.createdDate   ? new Date(data.createdDate)   : undefined,
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
        notes:          data.notes,
      },
    })

    revalidatePath('/support/accounts')
    return { success: true, id: account.id }
  } catch (e) {
    console.error('createUserAccount', e)
    return { success: false, error: 'Error al crear la cuenta.' }
  }
}
