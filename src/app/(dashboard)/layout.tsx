import { getCurrentUser } from '@/core/auth/get-current-user'

/**
 * Dashboard layout — all routes under (dashboard) require authentication.
 * getCurrentUser() redirects to /login if no valid session exists.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // This call validates the session against DB and redirects if invalid.
  // It's the second line of defense after the cookie-existence check in middleware.
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Placeholder header — will be replaced with full sidebar in a later phase */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <span className="font-semibold text-slate-800 text-sm">
          {process.env.NEXT_PUBLIC_APP_NAME ?? 'ITForge'}
        </span>
        <span className="text-sm text-slate-500">
          {user.firstName} {user.lastName}
        </span>
      </header>

      <main className="p-6">{children}</main>
    </div>
  )
}
