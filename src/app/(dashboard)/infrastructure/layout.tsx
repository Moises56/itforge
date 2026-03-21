import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'

export default async function InfrastructureLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  const org = await prisma.organization.findUnique({
    where:  { id: user.organizationId },
    select: { infrastructureEnabled: true },
  })

  if (!org?.infrastructureEnabled) redirect('/')

  return <>{children}</>
}
