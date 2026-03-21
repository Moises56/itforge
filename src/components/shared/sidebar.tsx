'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Layers,
  GitPullRequest,
  Database,
  Users,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
  Server,
  LifeBuoy,
  Network,
  Globe,
  LayoutDashboard,
  Headphones,
  Monitor,
  Ticket,
} from 'lucide-react'
import { logoutAction } from '@/app/(auth)/login/actions'

// ─── Types ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

interface EnabledModules {
  development: boolean
  infrastructure: boolean
  support: boolean
}

interface SidebarProps {
  user: {
    firstName: string
    lastName: string
    roles: string[]
  }
  canViewAdmin: boolean
  orgName: string
  orgTagline: string
  orgLogoUrl: string | null
  enabledModules: EnabledModules
}

// ─── Navigation config ─────────────────────────────────────────────────────

const devNavItems: NavItem[] = [
  { label: 'Inicio',               href: '/',                         icon: Home },
  { label: 'Proyectos',            href: '/projects',                  icon: Layers },
  { label: 'Dependencias',         href: '/projects/dependencies',     icon: Network },
  { label: 'Solicitudes de Cambio',href: '/change-requests',           icon: GitPullRequest },
  { label: 'Bases de Datos',       href: '/databases',                 icon: Database },
]

const infraNavItems: NavItem[] = [
  { label: 'Dashboard',       href: '/infrastructure',         icon: LayoutDashboard },
  { label: 'Servidores',      href: '/infrastructure/servers', icon: Server          },
  { label: 'Equipos de Red',  href: '/infrastructure/network', icon: Network         },
  { label: 'Dominios',        href: '/infrastructure/domains', icon: Globe           },
]

const supportNavItems: NavItem[] = [
  { label: 'Dashboard',          href: '/support',          icon: Headphones },
  { label: 'Tickets',            href: '/support/tickets',  icon: Ticket     },
  { label: 'Activos',            href: '/support/assets',   icon: Monitor    },
  { label: 'Cuentas de usuario', href: '/support/accounts', icon: Users      },
]

const adminNavItems: NavItem[] = [
  { label: 'Usuarios',      href: '/admin/users',    icon: Users },
  { label: 'Roles',         href: '/admin/roles',    icon: Shield },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

// ─── Sidebar Logo ───────────────────────────────────────────────────────────

function SidebarLogo({ orgName, orgTagline, orgLogoUrl }: { orgName: string; orgTagline: string; orgLogoUrl: string | null }) {
  return (
    <div className="h-14 flex items-center px-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Logo image or hex fallback */}
        {orgLogoUrl ? (
          <div className="w-7 h-7 shrink-0 rounded overflow-hidden flex items-center justify-center">
            <Image src={orgLogoUrl} alt={orgName} width={28} height={28} className="object-contain" unoptimized />
          </div>
        ) : (
          <div
            className="relative w-7 h-7 shrink-0 flex items-center justify-center"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--border-bright)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          >
            <span
              className="text-[9px] font-heading font-bold tracking-wider select-none"
              style={{ color: 'var(--accent-cyan)' }}
            >
              {orgName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex flex-col leading-none min-w-0">
          <span
            className="font-heading font-bold text-base tracking-[0.14em] uppercase select-none truncate"
            style={{ color: 'var(--foreground)' }}
          >
            {orgName}
          </span>
          <span
            className="text-[9px] tracking-[0.2em] uppercase select-none"
            style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {orgTagline}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Nav Section ────────────────────────────────────────────────────────────

function NavSection({
  title,
  items,
  isActive,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  isActive: (href: string) => boolean
  onNavigate: () => void
}) {
  return (
    <div>
      <div className="px-3 mb-1.5 flex items-center gap-2">
        <span
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--foreground-dim)' }}
        >
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="group flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 border-l-2"
              style={{
                color:           active ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                background:      active ? 'var(--accent-glow)' : 'transparent',
                borderLeftColor: active ? 'var(--accent)'      : 'transparent',
              }}
            >
              <Icon size={15} strokeWidth={1.75} />
              <span className="flex-1 font-medium tracking-wide truncate">{item.label}</span>
              {active && (
                <ChevronRight size={11} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── User Footer ────────────────────────────────────────────────────────────

function UserFooter({ user }: { user: SidebarProps['user'] }) {
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
  const primaryRole = user.roles[0] ?? 'sin rol'

  return (
    <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
      <div
        className="rounded p-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        {/* User info */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-xs font-heading font-bold shrink-0"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--border-bright)',
              color: 'var(--accent)',
            }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate leading-tight"
              style={{ color: 'var(--foreground)' }}
            >
              {user.firstName} {user.lastName}
            </p>
            <p
              className="text-[11px] truncate mt-0.5 font-mono"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {primaryRole}
            </p>
          </div>
        </div>

        {/* Logout */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-all duration-150"
            style={{ color: 'var(--foreground-muted)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--status-red)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground-muted)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
            }}
          >
            <LogOut size={12} strokeWidth={2} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Sidebar Inner Content ──────────────────────────────────────────────────

function SidebarContent({
  user,
  canViewAdmin,
  orgName,
  orgTagline,
  orgLogoUrl,
  enabledModules,
  isActive,
  onNavigate,
}: SidebarProps & { isActive: (href: string) => boolean; onNavigate: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface)' }}>
      <SidebarLogo orgName={orgName} orgTagline={orgTagline} orgLogoUrl={orgLogoUrl} />

      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {enabledModules.development && (
          <NavSection
            title="Desarrollo"
            items={devNavItems}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        )}
        {enabledModules.infrastructure && (
          <NavSection
            title="Infraestructura"
            items={infraNavItems}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        )}
        {enabledModules.support && (
          <NavSection
            title="Soporte"
            items={supportNavItems}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        )}
        {canViewAdmin && (
          <NavSection
            title="Administración"
            items={adminNavItems}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        )}
      </nav>

      <UserFooter user={user} />
    </div>
  )
}

// ─── Main Sidebar Export ────────────────────────────────────────────────────

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/infrastructure') return pathname === '/infrastructure'
    if (href === '/support') return pathname === '/support'
    return pathname.startsWith(href)
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <button
        aria-label="Abrir menú"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded transition-colors"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--foreground-muted)',
        }}
      >
        <Menu size={17} />
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={closeMobile}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-60 transition-transform duration-200 ease-in-out border-r"
        style={{
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          aria-label="Cerrar menú"
          onClick={closeMobile}
          className="absolute top-4 right-3 p-1.5 rounded"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <X size={15} />
        </button>
        <SidebarContent {...props} isActive={isActive} onNavigate={closeMobile} />
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{ borderColor: 'var(--border)' }}
      >
        <SidebarContent {...props} isActive={isActive} onNavigate={() => {}} />
      </aside>
    </>
  )
}
