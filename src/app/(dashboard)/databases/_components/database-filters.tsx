'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useTransition } from 'react'
import { SearchInput } from '@/components/shared/search-input'

// ─── Options ──────────────────────────────────────────────────────────────────

const ENGINE_OPTIONS = [
  { value: '',           label: 'Todos los motores' },
  { value: 'POSTGRESQL', label: 'PostgreSQL'        },
  { value: 'MYSQL',      label: 'MySQL'             },
  { value: 'SQL_SERVER', label: 'SQL Server'        },
  { value: 'MONGODB',    label: 'MongoDB'           },
  { value: 'SQLITE',     label: 'SQLite'            },
  { value: 'OTHER',      label: 'Otro'              },
]

const MANAGED_BY_OPTIONS = [
  { value: '',         label: 'Todos los equipos' },
  { value: 'DBA_TEAM', label: 'Equipo DBA'        },
  { value: 'DEV_TEAM', label: 'Desarrollo'        },
  { value: 'EXTERNAL', label: 'Externo'           },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = { id: string; name: string; code: string }

interface DatabaseFiltersProps {
  projects: Project[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DatabaseFilters({ projects }: DatabaseFiltersProps) {
  const router        = useRouter()
  const pathname      = usePathname()
  const searchParams  = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentEngine    = searchParams.get('engine')    ?? ''
  const currentManagedBy = searchParams.get('managedBy') ?? ''
  const currentProject   = searchParams.get('project')   ?? ''

  const hasFilters = currentEngine !== '' || currentManagedBy !== '' || currentProject !== '' || searchParams.has('q')

  const updateParam = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(name, value)
    else params.delete(name)
    params.delete('page')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const clearFilters = () => {
    startTransition(() => router.push(pathname))
  }

  const selectCls = 'px-3 py-2 rounded text-sm transition-all cursor-pointer outline-none'
  const selectStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(37,99,235,0.1)' : 'var(--surface-2)',
    border:     active ? '1px solid var(--border-bright)' : '1px solid var(--border)',
    color:      active ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
  })

  return (
    <div
      className="rounded p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <SearchInput
          placeholder="Buscar por nombre o BD..."
          paramName="q"
          className="flex-1 min-w-48 max-w-xs"
        />

        {/* Engine */}
        <select
          value={currentEngine}
          onChange={(e) => updateParam('engine', e.target.value)}
          className={selectCls}
          style={selectStyle(currentEngine !== '')}
        >
          {ENGINE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* ManagedBy */}
        <select
          value={currentManagedBy}
          onChange={(e) => updateParam('managedBy', e.target.value)}
          className={selectCls}
          style={selectStyle(currentManagedBy !== '')}
        >
          {MANAGED_BY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Project */}
        {projects.length > 0 && (
          <select
            value={currentProject}
            onChange={(e) => updateParam('project', e.target.value)}
            className={selectCls}
            style={selectStyle(currentProject !== '')}
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        )}

        {/* Clear */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-sm transition-all"
            style={{
              background: 'transparent',
              border:     '1px solid var(--border)',
              color:      'var(--foreground-muted)',
            }}
          >
            <X size={13} />
            Limpiar
          </button>
        )}

        {isPending && (
          <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Cargando...
          </span>
        )}
      </div>
    </div>
  )
}
