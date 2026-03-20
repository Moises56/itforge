'use client'

import { useState, useTransition } from 'react'
import { Layers, Server, LifeBuoy, CheckCircle, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import { toggleModule } from '@/modules/system/actions/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  development: boolean
  infrastructure: boolean
  support: boolean
}

type ModuleKey = 'development' | 'infrastructure' | 'support'

interface ModuleDef {
  key: ModuleKey
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  phase: string
}

// ─── Module definitions ───────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  {
    key: 'development',
    label: 'Desarrollo',
    description: 'Proyectos, credenciales, solicitudes de cambio y bases de datos.',
    icon: Layers,
    phase: 'Fase 1 — Disponible',
  },
  {
    key: 'infrastructure',
    label: 'Infraestructura',
    description: 'Servidores, redes, dominios y activos de TI.',
    icon: Server,
    phase: 'Fase 2 — Próximamente',
  },
  {
    key: 'support',
    label: 'Soporte',
    description: 'Tickets de soporte, mantenimientos y gestión de activos.',
    icon: LifeBuoy,
    phase: 'Fase 3 — Próximamente',
  },
]

// ─── Feedback ─────────────────────────────────────────────────────────────────

function Feedback({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded text-xs"
      style={{
        background: type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color: type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
      }}
    >
      {type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {message}
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const Icon = enabled ? ToggleRight : ToggleLeft
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all"
      style={{
        background: enabled ? 'rgba(37,99,235,0.15)' : 'var(--surface-2)',
        border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border-bright)'}`,
        color: enabled ? 'var(--accent-cyan)' : 'var(--foreground-dim)',
      }}
    >
      <Icon size={16} />
      {enabled ? 'Habilitado' : 'Deshabilitado'}
    </button>
  )
}

// ─── Main Form ─────────────────────────────────────────────────────────────────

export function ModulesForm({ development, infrastructure, support }: Props) {
  const [states, setStates] = useState<Record<ModuleKey, boolean>>({
    development,
    infrastructure,
    support,
  })
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ key: ModuleKey; type: 'success' | 'error'; message: string } | null>(null)

  const handleToggle = (key: ModuleKey) => {
    const newValue = !states[key]
    setFeedback(null)

    startTransition(async () => {
      const prev = states[key]
      // Optimistic update
      setStates((s) => ({ ...s, [key]: newValue }))

      const result = await toggleModule({ module: key, enabled: newValue })
      if (result.success) {
        setFeedback({ key, type: 'success', message: `Módulo ${newValue ? 'habilitado' : 'deshabilitado'}. El sidebar se actualizará al recargar.` })
      } else {
        // Revert on error
        setStates((s) => ({ ...s, [key]: prev }))
        setFeedback({ key, type: 'error', message: result.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers size={15} style={{ color: 'var(--accent-cyan)' }} />
        <h3 className="text-sm font-heading font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
          Módulos del sistema
        </h3>
      </div>

      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Habilita o deshabilita módulos completos. Los módulos deshabilitados desaparecen del sidebar y sus rutas retornan 404.
      </p>

      <div className="space-y-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon
          const enabled = states[mod.key]

          return (
            <div
              key={mod.key}
              className="rounded p-4 flex items-center gap-4"
              style={{
                background: 'var(--surface-2)',
                border: `1px solid ${enabled ? 'var(--border-bright)' : 'var(--border)'}`,
                opacity: pending ? 0.7 : 1,
              }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                style={{
                  background: enabled ? 'rgba(37,99,235,0.1)' : 'var(--surface-3)',
                  border: `1px solid ${enabled ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                }}
              >
                <Icon size={18} color={enabled ? 'var(--accent-cyan)' : 'var(--foreground-dim)'} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {mod.label}
                  </p>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: 'var(--surface-3)',
                      color: 'var(--foreground-dim)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {mod.phase}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                  {mod.description}
                </p>
                {feedback?.key === mod.key && (
                  <div className="mt-2">
                    <Feedback type={feedback.type} message={feedback.message} />
                  </div>
                )}
              </div>

              {/* Toggle */}
              <ToggleSwitch enabled={enabled} onChange={() => handleToggle(mod.key)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
