'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus } from '@/modules/support/actions/tickets'
import { Play, UserCheck, CheckCircle, XCircle } from 'lucide-react'

interface Props {
  ticket: { id: string; status: string; assignedToId: string | null }
  currentUserId: string
}

const BTN = "flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-50"

export function TicketActionButtons({ ticket, currentUserId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [resolution, setResolution] = useState('')
  const [showResolve, setShowResolve] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = (newStatus: string, extra?: Record<string, unknown>) => {
    setError(null)
    startTransition(async () => {
      const result = await updateTicketStatus(ticket.id, newStatus, extra)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  const { status } = ticket

  return (
    <div className="rounded p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--foreground-dim)' }}>
        Acciones
      </p>
      <div className="flex flex-wrap gap-2">
        {status === 'OPEN' && !ticket.assignedToId && (
          <button onClick={() => act('IN_PROGRESS', { assignedToId: currentUserId })} disabled={pending} className={BTN}
                  style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--status-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <UserCheck size={13} /> Tomar ticket
          </button>
        )}
        {status === 'OPEN' && ticket.assignedToId && (
          <button onClick={() => act('IN_PROGRESS')} disabled={pending} className={BTN}
                  style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--status-blue)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <Play size={13} /> Iniciar
          </button>
        )}
        {status === 'IN_PROGRESS' && (
          <button onClick={() => act('WAITING_PARTS')} disabled={pending} className={BTN}
                  style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--status-purple)', border: '1px solid rgba(139,92,246,0.25)' }}>
            Esperando piezas
          </button>
        )}
        {['IN_PROGRESS', 'WAITING_PARTS', 'WAITING_USER'].includes(status) && (
          <button onClick={() => setShowResolve(v => !v)} disabled={pending} className={BTN}
                  style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--status-green)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <CheckCircle size={13} /> Resolver
          </button>
        )}
        {status === 'RESOLVED' && (
          <button onClick={() => act('CLOSED')} disabled={pending} className={BTN}
                  style={{ background: 'var(--surface-2)', color: 'var(--foreground-muted)', border: '1px solid var(--border-bright)' }}>
            <XCircle size={13} /> Cerrar
          </button>
        )}
      </div>

      {showResolve && (
        <div className="space-y-2">
          <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)}
                    placeholder="Describe la solución aplicada..."
                    className="w-full rounded px-3 py-2 text-sm outline-none resize-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-bright)', color: 'var(--foreground)' }} />
          <div className="flex gap-2">
            <button
              onClick={() => { act('RESOLVED', { resolution }); setShowResolve(false) }}
              disabled={pending || !resolution.trim()} className={BTN}
              style={{ background: 'var(--status-green)', color: '#fff' }}>
              Confirmar resolución
            </button>
            <button onClick={() => setShowResolve(false)} className={BTN}
                    style={{ border: '1px solid var(--border-bright)', color: 'var(--foreground-muted)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--status-red)' }}>{error}</p>}
    </div>
  )
}
