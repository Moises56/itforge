import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import { Plus, Network, ChevronRight, Key } from 'lucide-react'

export const metadata: Metadata = { title: 'Equipos de Red' }

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; short: string }> = {
  SWITCH:       { label: 'Switch',       color: '#3b82f6', short: 'SW'  },
  ROUTER:       { label: 'Router',       color: '#8b5cf6', short: 'RTR' },
  ACCESS_POINT: { label: 'Access Point', color: '#10b981', short: 'AP'  },
  FIREWALL:     { label: 'Firewall',     color: '#ef4444', short: 'FW'  },
  UPS:          { label: 'UPS',          color: '#f59e0b', short: 'UPS' },
  OTHER:        { label: 'Otro',         color: '#6b7280', short: 'OTR' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:      { label: 'Activo',         color: 'var(--status-green)', bg: 'rgba(16,185,129,0.08)' },
  MAINTENANCE: { label: 'Mantenimiento',  color: 'var(--status-amber)', bg: 'rgba(245,158,11,0.08)' },
  INACTIVE:    { label: 'Inactivo',       color: 'var(--status-red)',   bg: 'rgba(239,68,68,0.08)'  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ q?: string; type?: string; status?: string }>

export default async function NetworkPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'infrastructure.network', 'view')
  if (!canView) redirect('/infrastructure')

  const canCreate = await resolvePermission(user.id, 'infrastructure.network', 'create')
  const params    = await searchParams

  const equipment = await prisma.networkEquipment.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt:      null,
      ...(params.type   && { type:   params.type   as never }),
      ...(params.status && { status: params.status as never }),
      ...(params.q && {
        OR: [
          { name:  { contains: params.q, mode: 'insensitive' } },
          { ip:    { contains: params.q, mode: 'insensitive' } },
          { brand: { contains: params.q, mode: 'insensitive' } },
          { model: { contains: params.q, mode: 'insensitive' } },
        ],
      }),
    },
    include: { _count: { select: { credentials: { where: { deletedAt: null } }, ports: true } } },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const hasFilters = !!(params.q || params.type || params.status)

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Equipos de Red
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {equipment.length} equipo{equipment.length !== 1 ? 's' : ''} registrado{equipment.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtrado)'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/infrastructure/network/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} /> Nuevo Equipo
          </Link>
        )}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={params.q ?? ''} placeholder="Buscar nombre, IP, marca..."
          className="px-3 py-1.5 rounded text-sm flex-1 min-w-[160px] outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
        <select name="type" defaultValue={params.type ?? ''} className="px-3 py-1.5 rounded text-sm cursor-pointer outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="px-3 py-1.5 rounded text-sm cursor-pointer outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/infrastructure/network" className="px-3 py-1.5 rounded text-sm"
            style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}>
            Limpiar
          </Link>
        )}
      </form>

      {/* Table */}
      {equipment.length === 0 ? (
        <div className="rounded p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Network size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
            {hasFilters ? 'Sin resultados' : 'No hay equipos de red registrados aún'}
          </p>
          {!hasFilters && canCreate && (
            <Link href="/infrastructure/network/new" className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Plus size={14} /> Registrar primer equipo
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Equipo', 'IP', 'Marca / Modelo', 'Puertos', 'Credenciales', 'Estado', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map((eq, idx) => {
                const type   = TYPE_META[eq.type]     ?? TYPE_META.OTHER!
                const status = STATUS_META[eq.status] ?? STATUS_META.INACTIVE!
                return (
                  <tr key={eq.id} className="hover:bg-white/[0.02] transition-colors group"
                      style={{ borderBottom: idx < equipment.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 w-8 text-center"
                          style={{ background: `${type.color}18`, color: type.color, border: `1px solid ${type.color}30`, fontFamily: 'var(--font-jetbrains)' }}
                        >
                          {type.short}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/infrastructure/network/${eq.id}`}
                            className="block text-sm font-medium truncate group-hover:text-[var(--accent-cyan)] transition-colors"
                            style={{ color: 'var(--foreground)' }}>
                            {eq.name}
                          </Link>
                          <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>{type.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                        {eq.ip ?? <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {[eq.brand, eq.model].filter(Boolean).join(' / ') || <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {eq.totalPorts ? `${eq._count.ports}/${eq.totalPorts}` : eq._count.ports > 0 ? eq._count.ports : <span style={{ color: 'var(--foreground-dim)' }}>—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        <Key size={11} /> {eq._count.credentials}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                            style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}30` }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/infrastructure/network/${eq.id}`}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all"
                        style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}>
                        Ver <ChevronRight size={10} />
                      </Link>
                    </td>
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
