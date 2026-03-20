import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { getOrgConfig } from '@/core/config/get-org-config'
import { Sidebar } from '@/components/shared/sidebar'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'

/**
 * Dashboard layout — all routes under (dashboard) require authentication.
 * Loads org config once per request (React cache), injects theme CSS variables,
 * and passes branding + module flags to the sidebar.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const [canViewAdmin, orgConfig] = await Promise.all([
    resolvePermission(user.id, 'system.config', 'view'),
    getOrgConfig(),
  ])

  // Derive glow / hover variants from hex colors
  const primary   = orgConfig.colors.primary
  const secondary = orgConfig.colors.secondary
  const accent    = orgConfig.colors.accent

  // Convert #rrggbb to rgb(r, g, b) for alpha composition
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
  }
  const darken = (hex: string, amount: number) => {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Custom CSS variables derived from org theme
  const cssVars = `
    :root {
      --accent:          ${primary};
      --accent-hover:    ${darken(primary, 24)};
      --accent-glow:     rgba(${hexToRgb(primary)}, 0.12);
      --accent-cyan:     ${accent};
      --accent-cyan-dim: rgba(${hexToRgb(accent)}, 0.15);
    }
  `.trim()

  return (
    <>
      {/* Inject org theme variables */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />

      <div className="flex h-full" style={{ background: 'var(--background)' }}>
        {/* Sidebar — handles mobile drawer + desktop static */}
        <Sidebar
          user={{
            firstName: user.firstName,
            lastName:  user.lastName,
            roles:     user.roles,
          }}
          canViewAdmin={canViewAdmin}
          orgName={orgConfig.name}
          orgTagline={orgConfig.tagline}
          orgLogoUrl={orgConfig.logoUrl}
          enabledModules={orgConfig.enabledModules}
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
    </>
  )
}
