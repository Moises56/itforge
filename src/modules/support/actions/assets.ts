'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { revalidatePath } from 'next/cache'

const CreateSchema = z.object({
  name:                    z.string().min(2),
  type:                    z.enum(['DESKTOP','LAPTOP','PRINTER','SCANNER','MONITOR','UPS','PHONE','TABLET','OTHER']),
  brand:                   z.string().optional(),
  model:                   z.string().optional(),
  serialNumber:            z.string().optional(),
  assetTag:                z.string().optional(),
  assignedToUser:          z.string().optional(),
  assignedToDepartmentId:  z.string().optional(),
  status:                  z.enum(['ACTIVE','IN_REPAIR','STORAGE','DECOMMISSIONED','LOST']).default('ACTIVE'),
  purchaseDate:            z.string().optional(),
  warrantyExpires:         z.string().optional(),
  location:                z.string().optional(),
  notes:                   z.string().optional(),
})

export async function createAsset(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser()
    const raw = {
      name:                   formData.get('name'),
      type:                   formData.get('type'),
      brand:                  (formData.get('brand')    as string) || undefined,
      model:                  (formData.get('model')    as string) || undefined,
      serialNumber:           (formData.get('serialNumber') as string) || undefined,
      assetTag:               (formData.get('assetTag') as string) || undefined,
      assignedToUser:         (formData.get('assignedToUser') as string) || undefined,
      assignedToDepartmentId: (formData.get('assignedToDepartmentId') as string) || undefined,
      status:                 (formData.get('status')   as string) || 'ACTIVE',
      purchaseDate:           (formData.get('purchaseDate')   as string) || undefined,
      warrantyExpires:        (formData.get('warrantyExpires') as string) || undefined,
      location:               (formData.get('location') as string) || undefined,
      notes:                  (formData.get('notes')    as string) || undefined,
    }

    const data = CreateSchema.parse(raw)

    const asset = await prisma.asset.create({
      data: {
        organizationId:         user.organizationId,
        name:                   data.name,
        type:                   data.type,
        brand:                  data.brand,
        model:                  data.model,
        serialNumber:           data.serialNumber,
        assetTag:               data.assetTag,
        assignedToUser:         data.assignedToUser,
        assignedToDepartmentId: data.assignedToDepartmentId,
        status:                 data.status,
        purchaseDate:           data.purchaseDate    ? new Date(data.purchaseDate)    : undefined,
        warrantyExpires:        data.warrantyExpires ? new Date(data.warrantyExpires) : undefined,
        location:               data.location,
        notes:                  data.notes,
      },
    })

    revalidatePath('/support/assets')
    return { success: true, id: asset.id }
  } catch (e) {
    console.error('createAsset', e)
    return { success: false, error: 'Error al crear el activo.' }
  }
}
