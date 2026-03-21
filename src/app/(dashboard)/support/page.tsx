import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import {
  Ticket, Monitor, Wrench, AlertTriangle, ChevronRight,
  CheckCircle, Clock, Users,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Soporte' }

const TICKET_STATUS_META: Record<string, { label: string; color: string }> = {
  OPEN:          { label: 'Abierto',        color: 'var(--status-blue)'   },
  IN_PROGRESS:   { label: 'En progreso',    color: 'var(--status-amber)'  },
  WAITING_PARTS: { label: 'Esperando piezas', color: 'var(--status-purple)' },
  WAITING_USER:  { label: 'Esperando usuario', color: 'var(--foreground-muted)' },
  RESOLVED:      { label: 'Resuelto',       color: 'var(--status-green)'  },
  CLOSED:        { label: 'Cerrado',        color: 'var(--foreground-dim)' },
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Baja',     color: 'var(--foreground-muted)' },
  MEDIUM:   { label: 'Media',    color: 'var(--status-blue)'     },
  HIGH:     { label: 'Alta',     color: 'var(--status-amber)'    },
  CRITICAL: { label: 'Crítica',  color: 'var(--status-red)'      },
}

function StatCard({ label, value, sub, href, color = 'var(--accent-cyan)', icon: Icon }: {
  label: string; value: number | string; sub?: string; href?: string; color?: string; icon: React.ElementType
}) {
  const inner = (
    <div className="rounded p-5 flex gap-4 items-start transition-all duration-150"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-9 h-9 rounded flex items-center justify-center shrink-0 mt-0.5"
           style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
           style={{ color: 'var(--foreground-dim)' }}>{label}</p>
        <p className="text-2xl font-heading font-bold mt-0.5" style={{ color }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block hover:scale-[1.01] transition-transform">{inner}</Link>
  return inner
}

export default async function SupportPage() {
  const user = await getCurrentUser()
  const now = new Date()

  const [ticketStats, myTickets, criticalTickets, repairAssets, overdueCount] = await Promise.all([
    prisma.supportTicket.groupBy({
      by: ['status'],
      where: { organizationId: user.organizationId, deletedAt: null },
      _count: true,
    }),
    prisma.supportTicket.findMany({
      where: { organizationId: user.organizationId, assignedToId: user.id, deletedAt: null,
               status: { notIn: ['RESOLVED', 'CLOSED'] } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 6,
      include: { asset: { select: { name: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { organizationId: user.organizationId, priority: 'CRITICAL', deletedAt: null,
               status: { notIn: ['RESOLVED', 'CLOSED'] } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
    prisma.asset.count({
      where: { organizationId: user.organizationId, status: 'IN_REPAIR', deletedAt: null },
    }),
    prisma.maintenanceLog.count({
      where: {
        asset: { organizationId: user.organizationId, deletedAt: null },
        nextMaintenanceAt: { lt: now },
      },
    }),
  ])

  const openCount   = ticketStats.find(r => r.status === 'OPEN')?._count ?? 0
  const inProgCount = ticketStats.find(r => r.status === 'IN_PROGRESS')?._count ?? 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
          Soporte TI
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
          Gestión de tickets, activos y cuentas de usuario
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tickets abiertos"    value={openCount}   href="/support/tickets" color="var(--status-blue)"  icon={Ticket}        />
        <StatCard label="En progreso"          value={inProgCount} href="/support/tickets" color="var(--status-amber)" icon={Clock}         />
        <StatCard label="Activos en reparación" value={repairAssets} href="/support/assets" color="var(--status-red)"  icon={Wrench}         />
        <StatCard label="Mant. vencidos"       value={overdueCount} href="/support/assets"  color="var(--status-purple)" icon={AlertTriangle} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* My assigned tickets */}
        <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <Ticket size={14} style={{ color: 'var(--accent-cyan)' }} />
              <h2 className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
                Mis Tickets Asignados
              </h2>
            </div>
            <span className="text-xs font-heading font-bold" style={{ color: 'var(--accent-cyan)' }}>{myTickets.length}</span>
          </div>
          {myTickets.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle size={20} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--status-green)' }} />
              <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin tickets asignados</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {myTickets.map(t => {
                const sm = TICKET_STATUS_META[t.status] ?? TICKET_STATUS_META['OPEN']!
                const pm = PRIORITY_META[t.priority] ?? PRIORITY_META['MEDIUM']!
                return (
                  <Link key={t.id} href={`/support/tickets/${t.id}`}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{t.title}</p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--foreground-dim)' }}>
                        {t.ticketNumber}{t.asset ? ` · ${t.asset.name}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-medium" style={{ color: sm.color }}>{sm.label}</span>
                      <span className="text-[10px]" style={{ color: pm.color }}>{pm.label}</span>
                    </div>
                    <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--foreground-dim)' }} />
                  </Link>
                )
              })}
            </div>
          )}
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Link href="/support/tickets" className="text-xs flex items-center gap-1" style={{ color: 'var(--accent-cyan)' }}>
              Ver todos los tickets <ChevronRight size={11} />
            </Link>
          </div>
        </div>

        {/* Critical tickets */}
        <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--status-red)' }} />
            <h2 className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--foreground-muted)' }}>
              Tickets Críticos
            </h2>
          </div>
          {criticalTickets.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle size={20} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--status-green)' }} />
              <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin tickets críticos activos</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {criticalTickets.map(t => {
                const sm = TICKET_STATUS_META[t.status] ?? TICKET_STATUS_META['OPEN']!
                return (
                  <Link key={t.id} href={`/support/tickets/${t.id}`}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--status-red)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{t.title}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--foreground-dim)' }}>{t.ticketNumber}</p>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: sm.color }}>{sm.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { href: '/support/tickets', icon: Ticket,  label: 'Tickets',         desc: 'Gestionar solicitudes de soporte',  color: 'var(--status-blue)'   },
          { href: '/support/assets',  icon: Monitor, label: 'Activos',          desc: 'Inventario de equipos y dispositivos', color: 'var(--accent-cyan)'  },
          { href: '/support/accounts', icon: Users,  label: 'Cuentas de usuario', desc: 'Gestión de cuentas de dominio y accesos', color: 'var(--status-purple)' },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
                className="rounded p-5 flex items-center gap-4 transition-all hover:border-[var(--border-bright)]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                 style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{desc}</p>
            </div>
            <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--foreground-dim)' }} />
          </Link>
        ))}
      </div>
    </div>
  )
}
