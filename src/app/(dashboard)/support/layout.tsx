import type { ReactNode } from 'react'
import { getCurrentUser } from '@/core/auth/get-current-user'

export default async function SupportLayout({ children }: { children: ReactNode }) {
  await getCurrentUser()
  return (
    <div>
      {children}
    </div>
  )
}
