import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { Plus, Monitor, Printer, Server, Smartphone, Box } from 'lucide-react'

export const metadata: Metadata = { title: 'Activos TI' }

const ASSET_ICONS: Record<string, React.ElementType> = {
  DESKTOP: Monitor, LAPTOP: Monitor, PRINTER: Printer, MONITOR: Monitor,
  SERVER: Server, PHONE: Smartphone, TABLET: Smartphone, OTHER: Box,
  SCANNER: Box, UPS: Box,
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE:         { label: 'Activo',        color: 'var(--status-green)'  },
  IN_REPAIR:      { label: 'En reparación', color: 'var(--status-amber)'  },
  STORAGE:        { label: 'En almacén',    color: 'var(--status-blue)'   },
  DECOMMISSIONED: { label: 'Dado de baja',  color: 'var(--foreground-dim)'},
  LOST:           { label: 'Perdido',       color: 'var(--status-red)'    },
}

const TYPE_LABELS: Record<string, string> = {
  DESKTOP: 'Computadora', LAPTOP: 'Laptop', PRINTER: 'Impresora',
  SCANNER: 'Escáner', MONITOR: 'Monitor', UPS: 'UPS',
  PHONE: 'Teléfono', TABLET: 'Tablet', OTHER: 'Otro',
}

export default async function AssetsPage() {
  const user   = await getCurrentUser()
  const assets = await prisma.asset.findMany({
    where:   { organizationId: user.organizationId, deletedAt: null },
    include: {
      assignedDepartment: { select: { name: true } },
      _count:             { select: { supportTickets: true, maintenanceLogs: true } },
    },
    orderBy: { name: 'asc' },
  })

  const stats = {
    total:    assets.length,
    active:   assets.filter(a => a.status === 'ACTIVE').length,
    inRepair: assets.filter(a => a.status === 'IN_REPAIR').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Activos TI
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {stats.total} equipos · {stats.active} activos · {stats.inRepair} en reparación
          </p>
        </div>
        <Link href="/support/assets/new"
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={15} /> Nuevo Activo
        </Link>
      </div>

      {assets.length === 0 ? (
        <div className="py-20 text-center rounded" style={{ border: '1px dashed var(--border)' }}>
          <Monitor size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>No hay activos registrados.</p>
        </div>
      ) : (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'Tipo', 'Marca / Modelo', 'Asignado a', 'Dependencia', 'Estado', 'Tickets'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-heading font-semibold uppercase tracking-[0.12em]"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map(a => {
                const Icon = ASSET_ICONS[a.type] ?? Box
                const sm   = STATUS_META[a.status] ?? STATUS_META['ACTIVE']!
                return (
                  <tr key={a.id} className="hover:bg-white/[0.01] transition-colors"
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <td className="px-4 py-3">
                      <Link href={`/support/assets/${a.id}`} className="flex items-center gap-2 group">
                        <Icon size={14} style={{ color: 'var(--foreground-dim)', flexShrink: 0 }} />
                        <div>
                          <p className="font-medium group-hover:underline" style={{ color: 'var(--foreground)' }}>{a.name}</p>
                          {a.assetTag && <p className="text-[10px] font-mono" style={{ color: 'var(--foreground-dim)' }}>{a.assetTag}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{TYPE_LABELS[a.type] ?? a.type}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {[a.brand, a.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.assignedToUser ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.assignedDepartment?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: sm.color }}>{sm.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-center" style={{ color: 'var(--foreground-dim)' }}>{a._count.supportTickets}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
