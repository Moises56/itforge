import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { Plus, Ticket } from 'lucide-react'

export const metadata: Metadata = { title: 'Tickets de Soporte' }

const STATUS_COLUMNS = [
  { key: 'OPEN',          label: 'Abierto',          color: 'var(--status-blue)'    },
  { key: 'IN_PROGRESS',   label: 'En progreso',       color: 'var(--status-amber)'   },
  { key: 'WAITING_PARTS', label: 'Esperando piezas',  color: 'var(--status-purple)'  },
  { key: 'WAITING_USER',  label: 'Esperando usuario', color: 'var(--foreground-muted)'},
  { key: 'RESOLVED',      label: 'Resuelto',          color: 'var(--status-green)'   },
  { key: 'CLOSED',        label: 'Cerrado',           color: 'var(--foreground-dim)' },
] as const

const PRIORITY_META: Record<string, { label: string; color: string; dot: string }> = {
  LOW:      { label: 'Baja',    color: 'var(--foreground-muted)', dot: '#475569' },
  MEDIUM:   { label: 'Media',   color: 'var(--status-blue)',      dot: '#3b82f6' },
  HIGH:     { label: 'Alta',    color: 'var(--status-amber)',     dot: '#f59e0b' },
  CRITICAL: { label: 'Crítica', color: 'var(--status-red)',       dot: '#ef4444' },
}

const TYPE_META: Record<string, string> = {
  HARDWARE_REPAIR:  'Reparación hardware',
  SOFTWARE_INSTALL: 'Instalación software',
  ACCESS_REQUEST:   'Acceso',
  NETWORK_ISSUE:    'Red',
  PRINTER_ISSUE:    'Impresora',
  GENERAL_SUPPORT:  'Soporte general',
  OTHER:            'Otro',
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; priority?: string }>
}) {
  const user   = await getCurrentUser()
  const params = await searchParams
  const view   = params.view ?? 'kanban'

  const tickets = await prisma.supportTicket.findMany({
    where: {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(params.status   ? { status:   params.status   as never } : {}),
      ...(params.priority ? { priority: params.priority as never } : {}),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      asset:      { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })

  const grouped = STATUS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = tickets.filter(t => t.status === col.key)
    return acc
  }, {} as Record<string, typeof tickets>)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Tickets de Soporte
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} encontrado{tickets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/support/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={15} /> Nuevo Ticket
        </Link>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 rounded w-fit" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {(['kanban', 'table'] as const).map(v => (
          <Link
            key={v}
            href={`/support/tickets?view=${v}`}
            className="px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize"
            style={view === v
              ? { background: 'var(--surface-3)', color: 'var(--foreground)', border: '1px solid var(--border-bright)' }
              : { color: 'var(--foreground-muted)' }}
          >
            {v === 'kanban' ? 'Kanban' : 'Tabla'}
          </Link>
        ))}
      </div>

      {view === 'kanban' ? (
        /* Kanban */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map(col => (
            <div key={col.key} className="shrink-0 w-72">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                <span className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--foreground-muted)' }}>
                  {col.label}
                </span>
                <span className="ml-auto text-xs font-heading font-bold" style={{ color: col.color }}>
                  {grouped[col.key]?.length ?? 0}
                </span>
              </div>
              <div className="space-y-2">
                {(grouped[col.key] ?? []).map(t => {
                  const pm = PRIORITY_META[t.priority] ?? PRIORITY_META['MEDIUM']!
                  return (
                    <Link key={t.id} href={`/support/tickets/${t.id}`}
                          className="block rounded p-3 transition-all hover:border-[var(--border-bright)]"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--foreground-dim)' }}>{t.ticketNumber}</span>
                        <span className="flex items-center gap-1 text-[10px] shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: pm.dot }} />
                          <span style={{ color: pm.color }}>{pm.label}</span>
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{t.title}</p>
                      {t.asset && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--foreground-dim)' }}>
                          {t.asset.name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--surface-2)', color: 'var(--foreground-muted)' }}>
                          {TYPE_META[t.type] ?? t.type}
                        </span>
                        {t.assignedTo && (
                          <span className="text-[10px] ml-auto" style={{ color: 'var(--foreground-dim)' }}>
                            {t.assignedTo.firstName}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
                {(grouped[col.key] ?? []).length === 0 && (
                  <div className="rounded p-4 text-center" style={{ border: '1px dashed var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin tickets</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table */
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Título', 'Tipo', 'Prioridad', 'Estado', 'Asignado a', 'Equipo'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-heading font-semibold uppercase tracking-[0.12em]"
                      style={{ color: 'var(--foreground-dim)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => {
                const pm  = PRIORITY_META[t.priority]  ?? PRIORITY_META['MEDIUM']!
                const scol = STATUS_COLUMNS.find(c => c.key === t.status)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
                      className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground-dim)' }}>
                      <Link href={`/support/tickets/${t.id}`} style={{ color: 'var(--accent-cyan)' }}>{t.ticketNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/support/tickets/${t.id}`} className="font-medium hover:underline" style={{ color: 'var(--foreground)' }}>
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{TYPE_META[t.type] ?? t.type}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: pm.dot }} />
                        <span style={{ color: pm.color }}>{pm.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: scol?.color ?? 'var(--foreground-muted)' }}>
                        {scol?.label ?? t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {t.asset?.name ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tickets.length === 0 && (
            <div className="py-16 text-center" style={{ background: 'var(--surface)' }}>
              <Ticket size={24} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--foreground-dim)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>No hay tickets. Crea el primero.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
