'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { createDatabase } from '@/modules/development/actions/databases'

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = { id: string; name: string; code: string }

interface Props {
  projects: Project[]
}

// ─── Options ──────────────────────────────────────────────────────────────────

const ENGINE_OPTIONS = [
  { value: 'POSTGRESQL', label: 'PostgreSQL' },
  { value: 'MYSQL',      label: 'MySQL'      },
  { value: 'SQL_SERVER', label: 'SQL Server' },
  { value: 'MONGODB',    label: 'MongoDB'    },
  { value: 'SQLITE',     label: 'SQLite'     },
  { value: 'OTHER',      label: 'Otro'       },
]

const MANAGED_BY_OPTIONS = [
  { value: 'DBA_TEAM', label: 'Equipo DBA — solo equipo DBA gestiona esta BD' },
  { value: 'DEV_TEAM', label: 'Desarrollo — el equipo de desarrollo la gestiona' },
  { value: 'EXTERNAL', label: 'Externo — proveedor o cliente gestiona la BD'   },
]

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls   = 'w-full px-3 py-2 rounded text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border:     '1px solid var(--border)',
  color:      'var(--foreground)',
}
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateDatabaseForm({ projects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name:         '',
    engine:       'POSTGRESQL',
    version:      '',
    serverIp:     '',
    port:         '',
    databaseName: '',
    managedBy:    'DBA_TEAM',
    projectId:    '',
    notes:        '',
  })

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setError(null)

    startTransition(async () => {
      const result = await createDatabase({
        name:         form.name.trim(),
        engine:       form.engine as 'POSTGRESQL' | 'MYSQL' | 'SQL_SERVER' | 'MONGODB' | 'SQLITE' | 'OTHER',
        version:      form.version.trim() || undefined,
        serverIp:     form.serverIp.trim() || undefined,
        port:         form.port ? Number(form.port) : null,
        databaseName: form.databaseName.trim() || undefined,
        managedBy:    form.managedBy as 'DBA_TEAM' | 'DEV_TEAM' | 'EXTERNAL',
        projectId:    form.projectId || null,
        notes:        form.notes.trim() || undefined,
      })

      if (!result.success) { setError(result.error); return }
      router.push(`/databases/${result.data.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="p-3 rounded text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border:     '1px solid rgba(239,68,68,0.25)',
            color:      'var(--status-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Sección principal ── */}
      <div
        className="rounded p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p
          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Información básica
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Nombre descriptivo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Ej: Base de datos de producción ERP"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Engine */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Motor *
            </label>
            <select
              value={form.engine}
              onChange={set('engine')}
              className={`${inputCls} cursor-pointer`}
              style={inputStyle}
            >
              {ENGINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Version */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Versión
            </label>
            <input
              type="text"
              value={form.version}
              onChange={set('version')}
              placeholder="Ej: 16.2, 8.0, 2019"
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>

          {/* Server IP */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              IP / Host del servidor
            </label>
            <input
              type="text"
              value={form.serverIp}
              onChange={set('serverIp')}
              placeholder="Ej: 192.168.1.10 o db.internal"
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Puerto
            </label>
            <input
              type="number"
              value={form.port}
              onChange={set('port')}
              placeholder="Ej: 5432, 3306, 1433"
              min={1}
              max={65535}
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>

          {/* Database name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Nombre de la base de datos
            </label>
            <input
              type="text"
              value={form.databaseName}
              onChange={set('databaseName')}
              placeholder="Ej: erp_prod, ventas_db"
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>

          {/* ManagedBy */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Gestionada por *
            </label>
            <select
              value={form.managedBy}
              onChange={set('managedBy')}
              className={`${inputCls} cursor-pointer`}
              style={inputStyle}
            >
              {MANAGED_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
                Proyecto asociado (opcional)
              </label>
              <select
                value={form.projectId}
                onChange={set('projectId')}
                className={`${inputCls} cursor-pointer`}
                style={inputStyle}
              >
                <option value="">Sin proyecto asociado</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Información adicional sobre esta base de datos..."
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !form.name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Registrar base de datos
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded text-sm font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
