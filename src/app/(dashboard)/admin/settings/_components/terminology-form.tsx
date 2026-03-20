'use client'

import { useState, useTransition } from 'react'
import { Languages, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { updateTerminology } from '@/modules/system/actions/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentDepartment: string
  currentProject: string
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

function Feedback({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded text-sm"
      style={{
        background: type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color: type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
      }}
    >
      {type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {message}
    </div>
  )
}

// ─── Terminology Row ──────────────────────────────────────────────────────────

function TerminologyRow({
  concept,
  defaultLabel,
  value,
  onChange,
}: {
  concept: string
  defaultLabel: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      className="rounded p-4 space-y-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-bright)' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: 'var(--surface-3)', color: 'var(--foreground-dim)', border: '1px solid var(--border)' }}>
          {concept}
        </span>
        <ArrowRight size={12} style={{ color: 'var(--foreground-dim)' }} />
        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          Default: <strong style={{ color: 'var(--foreground)' }}>{defaultLabel}</strong>
        </span>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultLabel}
        className="w-full px-3 py-2 rounded text-sm font-mono outline-none"
        style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--border-bright)',
          color: 'var(--foreground)',
        }}
      />
    </div>
  )
}

// ─── Main Form ─────────────────────────────────────────────────────────────────

export function TerminologyForm({ currentDepartment, currentProject }: Props) {
  const [department, setDepartment] = useState(currentDepartment)
  const [project, setProject] = useState(currentProject)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const result = await updateTerminology({ department, project })
      if (result.success) {
        setFeedback({ type: 'success', message: 'Terminología actualizada correctamente' })
      } else {
        setFeedback({ type: 'error', message: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Languages size={15} style={{ color: 'var(--accent-cyan)' }} />
          <h3 className="text-sm font-heading font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Terminología personalizada
          </h3>
        </div>
        <p className="text-sm mt-2" style={{ color: 'var(--foreground-muted)' }}>
          Adapta los conceptos clave al vocabulario de tu institución. Estos labels se usan en formularios, filtros y etiquetas a lo largo de toda la interfaz.
        </p>
      </div>

      <div className="space-y-3">
        <TerminologyRow
          concept="department"
          defaultLabel="Departamento"
          value={department}
          onChange={setDepartment}
        />
        <TerminologyRow
          concept="project"
          defaultLabel="Proyecto"
          value={project}
          onChange={setProject}
        />
      </div>

      {/* Examples */}
      <div
        className="rounded p-3 space-y-1.5"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>
          Vista previa de uso
        </p>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          &ldquo;Seleccione un <strong style={{ color: 'var(--accent-cyan)' }}>{department || 'Departamento'}</strong>&rdquo;
        </p>
        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
          &ldquo;Crear nuevo <strong style={{ color: 'var(--accent-cyan)' }}>{project || 'Proyecto'}</strong>&rdquo;
        </p>
      </div>

      {feedback && <Feedback {...feedback} />}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {pending ? 'Guardando...' : 'Guardar terminología'}
      </button>
    </form>
  )
}
