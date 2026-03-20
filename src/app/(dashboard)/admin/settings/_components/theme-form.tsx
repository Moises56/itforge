'use client'

import { useState, useTransition } from 'react'
import { Palette, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import { updateThemeColors } from '@/modules/system/actions/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentPrimary: string
  currentSecondary: string
  currentAccent: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
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

// ─── Color Picker Field ───────────────────────────────────────────────────────

function ColorField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* Native color input */}
        <label
          className="w-10 h-10 rounded cursor-pointer shrink-0 overflow-hidden"
          style={{ border: '2px solid var(--border-bright)' }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 -ml-1 -mt-1 cursor-pointer opacity-0 absolute"
            style={{ appearance: 'none' }}
          />
          <div className="w-full h-full rounded" style={{ background: value }} />
        </label>

        {/* Hex text input */}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          maxLength={7}
          className="w-28 px-3 py-1.5 rounded text-xs font-mono outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-bright)',
            color: 'var(--foreground)',
          }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>{description}</p>
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function SidebarPreview({ primary, secondary, accent }: { primary: string; secondary: string; accent: string }) {
  const glow = hexToRgba(primary, 0.12)
  const accentDim = hexToRgba(accent, 0.15)

  const navItems = [
    { label: 'Inicio', active: false },
    { label: 'Proyectos', active: true },
    { label: 'Solicitudes', active: false },
    { label: 'Bases de Datos', active: false },
  ]

  return (
    <div
      className="rounded overflow-hidden shrink-0"
      style={{ width: 180, border: '1px solid var(--border-bright)', background: secondary }}
    >
      {/* Logo area */}
      <div
        className="h-11 flex items-center px-3 gap-2"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}
      >
        <div
          className="w-5 h-5 rounded-sm flex items-center justify-center text-[7px] font-bold"
          style={{ background: glow, border: `1px solid ${primary}`, color: primary }}
        >
          IT
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-widest" style={{ color: '#cbd5e1' }}>ORG</div>
          <div className="text-[7px] tracking-wider" style={{ color: accent, opacity: 0.7 }}>SISTEMA</div>
        </div>
      </div>

      {/* Nav items */}
      <div className="p-2 space-y-0.5">
        <div className="px-2 py-1 mb-1">
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Módulo
          </span>
        </div>
        {navItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-[9px]"
            style={{
              background: item.active ? glow : 'transparent',
              borderLeft: `2px solid ${item.active ? primary : 'transparent'}`,
              color: item.active ? accent : 'rgba(203,213,225,0.5)',
            }}
          >
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: item.active ? accentDim : 'rgba(255,255,255,0.1)' }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Footer accent */}
      <div
        className="mx-2 mb-2 rounded p-2 text-[8px]"
        style={{ background: glow, border: `1px solid rgba(255,255,255,0.06)`, color: 'rgba(203,213,225,0.6)' }}
      >
        Usuario Admin
      </div>
    </div>
  )
}

// ─── Main Form ─────────────────────────────────────────────────────────────────

export function ThemeForm({ currentPrimary, currentSecondary, currentAccent }: Props) {
  const [primary, setPrimary] = useState(currentPrimary)
  const [secondary, setSecondary] = useState(currentSecondary)
  const [accent, setAccent] = useState(currentAccent)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const result = await updateThemeColors({ primary, secondary, accent })
      if (result.success) {
        setFeedback({ type: 'success', message: 'Colores guardados. Recarga la página para ver los cambios aplicados.' })
      } else {
        setFeedback({ type: 'error', message: result.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Palette size={15} style={{ color: 'var(--accent-cyan)' }} />
        <h3 className="text-sm font-heading font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
          Tema visual
        </h3>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Controls */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6">
          <ColorField
            label="Color primario"
            description="Botones, enlaces activos, indicadores principales."
            value={primary}
            onChange={setPrimary}
          />
          <ColorField
            label="Color secundario"
            description="Fondo del sidebar y superficies oscuras."
            value={secondary}
            onChange={setSecondary}
          />
          <ColorField
            label="Color de acento"
            description="Textos destacados, iconos activos, indicadores secundarios."
            value={accent}
            onChange={setAccent}
          />

          {feedback && <Feedback {...feedback} />}

          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: primary, color: '#fff' }}
          >
            {pending ? 'Guardando...' : 'Guardar colores'}
          </button>
        </form>

        {/* Live preview */}
        <div className="space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={12} style={{ color: 'var(--foreground-dim)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--foreground-dim)' }}>
              Vista previa
            </span>
          </div>
          <SidebarPreview primary={primary} secondary={secondary} accent={accent} />
        </div>
      </div>
    </div>
  )
}
