import type { Metadata } from 'next'
import { GitPullRequest } from 'lucide-react'

export const metadata: Metadata = { title: 'Solicitudes de Cambio' }

export default function ChangeRequestsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <GitPullRequest size={22} style={{ color: 'var(--accent-cyan)' }} />
        <div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
            Solicitudes de Cambio
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Kanban global de solicitudes de cambio
          </p>
        </div>
      </div>

      <div
        className="rounded p-12 text-center"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border-bright)' }}
      >
        <GitPullRequest size={40} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
          Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
          El tablero Kanban de solicitudes de cambio estará disponible en la siguiente fase.
        </p>
      </div>
    </div>
  )
}
