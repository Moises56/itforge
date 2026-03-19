import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ControlLevelValue = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'

const LEVEL_CONFIG: Record<
  ControlLevelValue,
  { label: string; name: string; color: string; bg: string; border: string }
> = {
  LEVEL_0: {
    label: 'L0',
    name: 'Sin Control',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
  },
  LEVEL_1: {
    label: 'L1',
    name: 'BD Disponible',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  LEVEL_2: {
    label: 'L2',
    name: 'Código Disponible',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.2)',
  },
  LEVEL_3: {
    label: 'L3',
    name: 'Control Total',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BadgeControlLevelProps {
  level: string
  showName?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export function BadgeControlLevel({
  level,
  showName = false,
  size = 'sm',
  className,
}: BadgeControlLevelProps) {
  const cfg = LEVEL_CONFIG[level as ControlLevelValue]

  if (!cfg) {
    return (
      <span
        className={cn('inline-flex items-center font-mono rounded px-1.5 py-0.5', className)}
        style={{
          color: 'var(--foreground-muted)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-jetbrains)',
          fontSize: '10px',
        }}
      >
        {level}
      </span>
    )
  }

  const sizeStyles = {
    xs: { fontSize: '9px', padding: '1px 5px' },
    sm: { fontSize: '10px', padding: '2px 6px' },
    md: { fontSize: '11px', padding: '3px 8px' },
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-mono font-bold rounded', className)}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontFamily: 'var(--font-jetbrains)',
        ...sizeStyles[size],
      }}
      title={cfg.name}
    >
      {cfg.label}
      {showName && (
        <span
          style={{
            fontFamily: 'var(--font-barlow)',
            fontWeight: 400,
            fontSize: '10px',
          }}
        >
          {cfg.name}
        </span>
      )}
    </span>
  )
}

// ─── Stripe (top accent bar) ─────────────────────────────────────────────────

export function ControlLevelStripe({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LEVEL_0: '#ef4444',
    LEVEL_1: '#f59e0b',
    LEVEL_2: '#f97316',
    LEVEL_3: '#10b981',
  }
  return (
    <div
      className="h-0.5 w-full shrink-0"
      style={{ background: colors[level] ?? 'var(--border)' }}
    />
  )
}
