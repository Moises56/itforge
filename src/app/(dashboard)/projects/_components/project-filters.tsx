'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X, LayoutGrid, List } from 'lucide-react'
import { useTransition, useRef, useState, useEffect } from 'react'
import { SearchInput } from '@/components/shared/search-input'

// ─── Types ───────────────────────────────────────────────────────────────────

type Department = { id: string; name: string; code: string }

interface ProjectFiltersProps {
  departments: Department[]
}

// ─── Options ──────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  { value: 'PRODUCTION',   label: 'Producción',    color: '#10b981' },
  { value: 'QA',           label: 'QA',             color: '#06b6d4' },
  { value: 'DEVELOPMENT',  label: 'Desarrollo',     color: '#3b82f6' },
  { value: 'PLANNING',     label: 'Planificación',  color: '#8b5cf6' },
  { value: 'IDEA',         label: 'Idea',           color: '#475569' },
  { value: 'SUSPENDED',    label: 'Suspendido',     color: '#f59e0b' },
  { value: 'DISCONTINUED', label: 'Descontinuado',  color: '#ef4444' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'WEB',     label: 'Web'        },
  { value: 'DESKTOP', label: 'Escritorio' },
  { value: 'SERVICE', label: 'Servicio'   },
  { value: 'MOBILE',  label: 'Móvil'      },
]

const LEVEL_OPTIONS = [
  { value: '', label: 'Todos los niveles' },
  { value: 'LEVEL_0', label: 'L0 — Sin control'        },
  { value: 'LEVEL_1', label: 'L1 — BD disponible'      },
  { value: 'LEVEL_2', label: 'L2 — Código disponible'  },
  { value: 'LEVEL_3', label: 'L3 — Control total'      },
]

// ─── Status multi-select dropdown ─────────────────────────────────────────────

function StatusDropdown({
  selectedStatuses,
  onToggle,
}: {
  selectedStatuses: string[]
  onToggle: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label =
    selectedStatuses.length === 0
      ? 'Todos los estados'
      : selectedStatuses.length === 1
      ? (ALL_STATUSES.find((s) => s.value === selectedStatuses[0])?.label ?? selectedStatuses[0])
      : `${selectedStatuses.length} estados`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-all whitespace-nowrap"
        style={{
          background: selectedStatuses.length > 0 ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
          border: selectedStatuses.length > 0 ? '1px solid var(--border-bright)' : '1px solid var(--border)',
          color: selectedStatuses.length > 0 ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
        }}
      >
        {label}
        <span
          className="text-[10px] ml-1"
          style={{ color: 'var(--foreground-dim)' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 rounded overflow-hidden min-w-[200px]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-bright)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {ALL_STATUSES.map((s) => {
            const checked = selectedStatuses.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onToggle(s.value)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left"
                style={{
                  background: checked ? 'var(--accent-glow)' : 'transparent',
                  color: checked ? 'var(--foreground)' : 'var(--foreground-muted)',
                }}
                onMouseEnter={(e) => {
                  if (!checked)
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  if (!checked)
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 text-[9px]"
                  style={{
                    background: checked ? 'var(--accent)' : 'var(--surface-2)',
                    border: checked ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: '#fff',
                  }}
                >
                  {checked && '✓'}
                </span>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectFilters({ departments }: ProjectFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Current filter values
  const currentStatuses = (searchParams.get('status') ?? '')
    .split(',')
    .filter(Boolean)
  const currentType = searchParams.get('type') ?? ''
  const currentLevel = searchParams.get('level') ?? ''
  const currentDept = searchParams.get('department') ?? ''
  const currentView = searchParams.get('view') ?? 'grid'

  const hasFilters =
    currentStatuses.length > 0 ||
    currentType !== '' ||
    currentLevel !== '' ||
    currentDept !== '' ||
    searchParams.has('q')

  // ── URL param helpers ────────────────────────────────────────────────────────

  const updateParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(name, value)
    else params.delete(name)
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const toggleStatus = (value: string) => {
    const next = currentStatuses.includes(value)
      ? currentStatuses.filter((s) => s !== value)
      : [...currentStatuses, value]

    const params = new URLSearchParams(searchParams.toString())
    if (next.length > 0) params.set('status', next.join(','))
    else params.delete('status')
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const clearFilters = () => {
    const params = new URLSearchParams()
    if (currentView !== 'grid') params.set('view', currentView)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  // ── Select style ─────────────────────────────────────────────────────────────

  const selectCls = 'px-3 py-2 rounded text-sm transition-all cursor-pointer outline-none'
  const selectStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
    border: active ? '1px solid var(--border-bright)' : '1px solid var(--border)',
    color: active ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
  })

  return (
    <div
      className="rounded p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <SearchInput
          placeholder="Buscar por nombre o código..."
          paramName="q"
          className="flex-1 min-w-50 max-w-xs"
        />

        {/* Status multi-select */}
        <StatusDropdown
          selectedStatuses={currentStatuses}
          onToggle={toggleStatus}
        />

        {/* Deployment type */}
        <select
          value={currentType}
          onChange={(e) => updateParam('type', e.target.value)}
          className={selectCls}
          style={selectStyle(currentType !== '')}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Control level */}
        <select
          value={currentLevel}
          onChange={(e) => updateParam('level', e.target.value)}
          className={selectCls}
          style={selectStyle(currentLevel !== '')}
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Department */}
        {departments.length > 0 && (
          <select
            value={currentDept}
            onChange={(e) => updateParam('department', e.target.value)}
            className={selectCls}
            style={selectStyle(currentDept !== '')}
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
            }}
          >
            <X size={13} />
            Limpiar
          </button>
        )}

        {/* Loading */}
        {isPending && (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Cargando...
          </span>
        )}

        {/* View toggle */}
        <div
          className="ml-auto flex items-center rounded overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setView('grid')}
            className="px-3 py-2 transition-all"
            title="Vista tarjetas"
            style={{
              background: currentView === 'grid' ? 'var(--accent-glow)' : 'var(--surface-2)',
              color: currentView === 'grid' ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
              borderRight: '1px solid var(--border)',
            }}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className="px-3 py-2 transition-all"
            title="Vista tabla"
            style={{
              background: currentView === 'table' ? 'var(--accent-glow)' : 'var(--surface-2)',
              color: currentView === 'table' ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
            }}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
