import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProjectStatusValue =
  | 'IDEA'
  | 'PLANNING'
  | 'DEVELOPMENT'
  | 'QA'
  | 'PRODUCTION'
  | 'SUSPENDED'
  | 'DISCONTINUED'

const STATUS_CONFIG: Record<
  ProjectStatusValue,
  { label: string; color: string; bg: string; border: string; pulse: boolean }
> = {
  IDEA:         { label: 'Idea',           color: '#475569', bg: 'rgba(71,85,105,0.08)',   border: 'rgba(71,85,105,0.2)',   pulse: false },
  PLANNING:     { label: 'Planificación',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.2)',  pulse: false },
  DEVELOPMENT:  { label: 'Desarrollo',     color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  pulse: false },
  QA:           { label: 'QA',             color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.2)',   pulse: false },
  PRODUCTION:   { label: 'Producción',     color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  pulse: true  },
  SUSPENDED:    { label: 'Suspendido',     color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  pulse: false },
  DISCONTINUED: { label: 'Descontinuado',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   pulse: false },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BadgeStatusProps {
  status: string
  showDot?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export function BadgeStatus({
  status,
  showDot = true,
  size = 'sm',
  className,
}: BadgeStatusProps) {
  const cfg = STATUS_CONFIG[status as ProjectStatusValue]

  if (!cfg) {
    return (
      <span
        className={cn('inline-flex items-center font-medium rounded px-2 py-0.5', className)}
        style={{
          color: 'var(--foreground-muted)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontSize: '11px',
        }}
      >
        {status}
      </span>
    )
  }

  const sizeStyles = {
    xs: { fontSize: '9px', padding: '1px 5px' },
    sm: { fontSize: '11px', padding: '2px 8px' },
    md: { fontSize: '12px', padding: '3px 10px' },
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-medium rounded', className)}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        ...sizeStyles[size],
      }}
    >
      {showDot && (
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', cfg.pulse && 'animate-pulse')}
          style={{ background: cfg.color }}
        />
      )}
      {cfg.label}
    </span>
  )
}
