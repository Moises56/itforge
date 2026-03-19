import type { Metadata } from 'next'
import { Database } from 'lucide-react'

export const metadata: Metadata = { title: 'Bases de Datos' }

export default function DatabasesPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Database size={22} style={{ color: 'var(--accent-cyan)' }} />
        <div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
            Bases de Datos
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Inventario y gestión de bases de datos
          </p>
        </div>
      </div>

      <div
        className="rounded p-12 text-center"
        style={{ background: 'var(--surface)', border: '1px dashed var(--border-bright)' }}
      >
        <Database size={40} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground-muted)' }}>
          Próximamente
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
          El módulo de bases de datos estará disponible en la siguiente fase.
        </p>
      </div>
    </div>
  )
}
