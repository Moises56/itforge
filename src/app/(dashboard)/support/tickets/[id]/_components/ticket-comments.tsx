'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketComment } from '@/modules/support/actions/tickets'
import { MessageSquare, Lock } from 'lucide-react'

interface Comment {
  id: string
  content: string
  isInternal: boolean
  createdAt: Date
  user: { id: string; firstName: string; lastName: string }
}

interface Props {
  ticketId: string
  comments: Comment[]
  currentUserId: string
}

export function TicketComments({ ticketId, comments }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      await addTicketComment(ticketId, content, isInternal)
      setContent('')
      router.refresh()
    })
  }

  const fmt = (d: Date) => new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d))

  return (
    <div className="rounded overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        <MessageSquare size={14} style={{ color: 'var(--accent-cyan)' }} />
        <h3 className="text-[10px] font-heading font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--foreground-muted)' }}>
          Comentarios ({comments.length})
        </h3>
      </div>

      {/* Comment list */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {comments.map(c => (
          <div key={c.id} className="px-5 py-4 space-y-1.5"
               style={c.isInternal ? { background: 'rgba(245,158,11,0.04)' } : undefined}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                {c.user.firstName} {c.user.lastName}
              </span>
              {c.isInternal && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--status-amber)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Lock size={9} /> Nota interna
                </span>
              )}
              <span className="text-[10px] ml-auto" style={{ color: 'var(--foreground-dim)' }}>{fmt(c.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground-muted)' }}>{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="px-5 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin comentarios aún.</p>
          </div>
        )}
      </div>

      {/* Add comment */}
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
        <textarea rows={3} value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Añade un comentario..."
                  className="w-full rounded px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-bright)', color: 'var(--foreground)' }} />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
                   className="rounded" style={{ accentColor: 'var(--status-amber)' }} />
            <Lock size={11} /> Nota interna (solo técnicos)
          </label>
          <button type="submit" disabled={pending || !content.trim()}
                  className="px-4 py-2 rounded text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
            {pending ? 'Enviando...' : 'Comentar'}
          </button>
        </div>
      </form>
    </div>
  )
}
