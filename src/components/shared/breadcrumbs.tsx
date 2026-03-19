'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

// ─── Route label map ────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  'projects':         'Proyectos',
  'change-requests':  'Solicitudes de Cambio',
  'databases':        'Bases de Datos',
  'admin':            'Administración',
  'users':            'Usuarios',
  'roles':            'Roles',
  'settings':         'Configuración',
  'new':              'Nuevo',
  'edit':             'Editar',
}

// Detect dynamic segments (UUIDs, numeric IDs)
const isDynamicSegment = (s: string) =>
  /^[0-9a-f-]{8,}$/i.test(s) || /^\d+$/.test(s)

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

export function Breadcrumbs() {
  const pathname = usePathname()

  // Split path and filter empty strings
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return (
      <span
        className="text-xs font-heading font-semibold uppercase tracking-widest"
        style={{ color: 'var(--foreground-muted)' }}
      >
        Inicio
      </span>
    )
  }

  // Build crumbs, skipping dynamic segments that have no label
  const crumbs: { label: string; href: string; isActive: boolean }[] = []

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const href = '/' + segments.slice(0, i + 1).join('/')
    const isActive = i === segments.length - 1

    // Skip UUID/numeric segments — they're detail views without a good label
    if (isDynamicSegment(seg)) {
      // Replace the last crumb href to point here if active
      if (isActive && crumbs.length > 0) {
        crumbs[crumbs.length - 1]!.isActive = true
      }
      continue
    }

    const label = ROUTE_LABELS[seg] ?? seg
    crumbs.push({ label, href, isActive: isActive && !isDynamicSegment(seg) })
  }

  if (crumbs.length === 0) return null

  return (
    <nav className="flex items-center gap-1" aria-label="Breadcrumbs">
      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight
              size={11}
              strokeWidth={2}
              style={{ color: 'var(--foreground-dim)' }}
            />
          )}
          {crumb.isActive ? (
            <span
              className="text-xs font-heading font-semibold uppercase tracking-widest"
              style={{ color: 'var(--foreground)' }}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-xs font-heading font-semibold uppercase tracking-widest transition-colors"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
