import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { Sidebar } from '@/components/shared/sidebar'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'

/**
 * Dashboard layout — all routes under (dashboard) require authentication.
 * Renders the sidebar + main content area with header.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const canViewAdmin = await resolvePermission(user.id, 'system.config', 'view')

  return (
    <div className="flex h-full" style={{ background: 'var(--background)' }}>
      {/* Sidebar — handles mobile drawer + desktop static */}
      <Sidebar
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        }}
        canViewAdmin={canViewAdmin}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="h-14 flex items-center px-6 gap-4 shrink-0 border-b"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Spacer for mobile hamburger button */}
          <div className="md:hidden w-8 shrink-0" />

          {/* Breadcrumbs */}
          <Breadcrumbs />

          {/* Right side status */}
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--status-green)' }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.18em]"
                style={{
                  color: 'var(--foreground-muted)',
                  fontFamily: 'var(--font-jetbrains)',
                }}
              >
                Online
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
