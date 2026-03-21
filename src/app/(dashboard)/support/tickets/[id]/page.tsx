import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Monitor, Server, FolderOpen } from 'lucide-react'
import { TicketActionButtons } from './_components/ticket-action-buttons'
import { TicketComments } from './_components/ticket-comments'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:          { label: 'Abierto',           color: 'var(--status-blue)',    bg: 'rgba(59,130,246,0.1)'   },
  IN_PROGRESS:   { label: 'En progreso',        color: 'var(--status-amber)',   bg: 'rgba(245,158,11,0.1)'   },
  WAITING_PARTS: { label: 'Esperando piezas',   color: 'var(--status-purple)',  bg: 'rgba(139,92,246,0.1)'   },
  WAITING_USER:  { label: 'Esperando usuario',  color: 'var(--foreground-muted)', bg: 'var(--surface-2)'     },
  RESOLVED:      { label: 'Resuelto',           color: 'var(--status-green)',   bg: 'rgba(16,185,129,0.1)'   },
  CLOSED:        { label: 'Cerrado',            color: 'var(--foreground-dim)', bg: 'var(--surface-2)'       },
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:      { label: 'Baja',    color: 'var(--foreground-muted)' },
  MEDIUM:   { label: 'Media',   color: 'var(--status-blue)'      },
  HIGH:     { label: 'Alta',    color: 'var(--status-amber)'     },
  CRITICAL: { label: 'Crítica', color: 'var(--status-red)'       },
}

const TYPE_LABELS: Record<string, string> = {
  HARDWARE_REPAIR: 'Reparación hardware', SOFTWARE_INSTALL: 'Instalación software',
  ACCESS_REQUEST: 'Acceso', NETWORK_ISSUE: 'Problema de red',
  PRINTER_ISSUE: 'Impresora', GENERAL_SUPPORT: 'Soporte general', OTHER: 'Otro',
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const ticket  = await prisma.supportTicket.findUnique({ where: { id }, select: { ticketNumber: true, title: true } })
  return { title: ticket ? `${ticket.ticketNumber} — ${ticket.title}` : 'Ticket' }
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user    = await getCurrentUser()

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      requestedByDept: { select: { id: true, name: true } },
      assignedTo:      { select: { id: true, firstName: true, lastName: true, email: true } },
      asset:           { select: { id: true, name: true, type: true, assetTag: true, brand: true, model: true } },
      project:         { select: { id: true, name: true, code: true } },
      server:          { select: { id: true, hostname: true, displayName: true, ip: true } },
      comments: {
        where: { deletedAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!ticket) notFound()

  const sm = STATUS_META[ticket.status]    ?? STATUS_META['OPEN']!
  const pm = PRIORITY_META[ticket.priority] ?? PRIORITY_META['MEDIUM']!
  const formattedDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—'

  return (
    <div className="max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/support/tickets" className="flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--foreground-muted)' }}>
          <ArrowLeft size={14} /> Tickets
        </Link>
        <span style={{ color: 'var(--border-bright)' }}>/</span>
        <span className="text-sm font-mono" style={{ color: 'var(--foreground-dim)' }}>{ticket.ticketNumber}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="rounded p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start gap-3 flex-wrap">
              <span className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
              <span className="px-2.5 py-1 rounded text-xs font-medium" style={{ color: pm.color, border: `1px solid ${pm.color}40` }}>{pm.label}</span>
              <span className="px-2.5 py-1 rounded text-xs" style={{ background: 'var(--surface-2)', color: 'var(--foreground-muted)' }}>
                {TYPE_LABELS[ticket.type] ?? ticket.type}
              </span>
            </div>
            <h1 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>{ticket.title}</h1>
            {ticket.description && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--foreground-muted)' }}>{ticket.description}</p>
            )}
            {ticket.resolution && (
              <div className="rounded p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--status-green)' }}>Resolución</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground-muted)' }}>{ticket.resolution}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <TicketActionButtons
            ticket={{ id: ticket.id, status: ticket.status, assignedToId: ticket.assignedToId }}
            currentUserId={user.id}
          />

          {/* Comments */}
          <TicketComments ticketId={ticket.id} comments={ticket.comments} currentUserId={user.id} />
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--foreground-dim)' }}>Información</p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {[
                { label: 'Solicitante', value: ticket.requestedByName },
                { label: 'Dependencia', value: ticket.requestedByDept?.name ?? '—' },
                { label: 'Asignado a',  value: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : '—' },
                { label: 'Creado',      value: formattedDate(ticket.createdAt) },
                { label: 'Actualizado', value: formattedDate(ticket.updatedAt) },
                { label: 'Resuelto',    value: formattedDate(ticket.resolvedAt) },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-2.5 flex justify-between gap-2">
                  <span className="text-xs shrink-0" style={{ color: 'var(--foreground-dim)' }}>{label}</span>
                  <span className="text-xs text-right" style={{ color: 'var(--foreground-muted)' }}>{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Associations */}
          {(ticket.asset || ticket.project || ticket.server) && (
            <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--foreground-dim)' }}>Asociaciones</p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {ticket.asset && (
                  <Link href={`/support/assets/${ticket.asset.id}`}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <Monitor size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{ticket.asset.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>{ticket.asset.brand} {ticket.asset.model}</p>
                    </div>
                  </Link>
                )}
                {ticket.project && (
                  <Link href={`/projects/${ticket.project.id}`}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <FolderOpen size={14} style={{ color: 'var(--status-green)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{ticket.project.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>{ticket.project.code}</p>
                    </div>
                  </Link>
                )}
                {ticket.server && (
                  <Link href={`/infrastructure/servers/${ticket.server.id}`}
                        className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <Server size={14} style={{ color: 'var(--status-amber)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{ticket.server.displayName ?? ticket.server.hostname}</p>
                      <p className="text-[10px] font-mono" style={{ color: 'var(--foreground-dim)' }}>{ticket.server.ip}</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
