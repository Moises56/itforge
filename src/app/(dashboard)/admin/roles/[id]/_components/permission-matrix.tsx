'use client'

import React, { useRef, useState, useTransition } from 'react'
import { saveRolePermissionsAction } from '../../actions'
import { CheckSquare, Square, Minus, Save, Loader2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceAction = {
  id: string
  action: { code: string; name: string }
}

type Resource = {
  id: string
  code: string
  name: string
  module: string
  resourceActions: ResourceAction[]
}

type Props = {
  roleId: string
  resources: Resource[]
  allowedIds: Set<string>
  canEdit: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_COLUMNS = [
  { code: 'view',          label: 'Ver'            },
  { code: 'create',        label: 'Crear'          },
  { code: 'edit',          label: 'Editar'         },
  { code: 'delete',        label: 'Eliminar'       },
  { code: 'reveal',        label: 'Revelar'        },
  { code: 'change_status', label: 'Est.'           },
  { code: 'export',        label: 'Exportar'       },
]

const MODULE_LABELS: Record<string, string> = {
  DEVELOPMENT:    'Desarrollo',
  INFRASTRUCTURE: 'Infraestructura',
  SUPPORT:        'Soporte',
  SYSTEM:         'Sistema',
}

const MODULE_COLORS: Record<string, string> = {
  DEVELOPMENT:    'var(--accent-cyan)',
  INFRASTRUCTURE: 'var(--status-amber)',
  SUPPORT:        'var(--status-blue)',
  SYSTEM:         'var(--status-red)',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PermissionMatrix({ roleId, resources, allowedIds: initial, canEdit }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initial))
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Build lookup: resourceId → { actionCode → resourceActionId }
  const resourceActionLookup = new Map<string, Map<string, string>>()
  for (const resource of resources) {
    const actionMap = new Map<string, string>()
    for (const ra of resource.resourceActions) actionMap.set(ra.action.code, ra.id)
    resourceActionLookup.set(resource.id, actionMap)
  }

  function toggle(raId: string) {
    if (!canEdit) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(raId)) next.delete(raId); else next.add(raId)
      return next
    })
    setSaved(false)
  }

  function toggleFullControl(resource: Resource) {
    if (!canEdit) return
    const ids = resource.resourceActions.map((ra) => ra.id)
    const allChecked = ids.every((id) => checked.has(id))
    setChecked((prev) => {
      const next = new Set(prev)
      if (allChecked) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
    setSaved(false)
  }

  function getRowState(resource: Resource): 'all' | 'some' | 'none' {
    const ids = resource.resourceActions.map((ra) => ra.id)
    const n = ids.filter((id) => checked.has(id)).length
    if (n === 0) return 'none'
    if (n === ids.length) return 'all'
    return 'some'
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const formData = new FormData()
      formData.append('roleId', roleId)
      checked.forEach((id) => formData.append('allowedIds', id))
      const result = await saveRolePermissionsAction(formData)
      if (result.success) setSaved(true)
    })
  }

  // Group resources by module
  const byModule = new Map<string, Resource[]>()
  for (const resource of resources) {
    const list = byModule.get(resource.module) ?? []
    list.push(resource)
    byModule.set(resource.module, list)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-3 px-4 text-[10px] font-heading font-semibold uppercase tracking-[0.15em]"
                    style={{ color: 'var(--foreground-dim)', width: 200 }}>
                  Recurso
                </th>
                <th className="py-3 px-2 text-center text-[10px] font-heading font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--foreground-dim)', width: 80 }}>
                  Todos
                </th>
                {ACTION_COLUMNS.map((col) => (
                  <th key={col.code} className="py-3 px-2 text-center text-[10px] font-heading font-semibold uppercase tracking-[0.12em]"
                      style={{ color: 'var(--foreground-dim)', minWidth: 68 }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from(byModule.entries()).map(([module, moduleResources]) => (
                <React.Fragment key={module}>
                  {/* Module header row */}
                  <tr style={{ background: 'var(--surface-3)', borderTop: '1px solid var(--border)' }}>
                    <td colSpan={2 + ACTION_COLUMNS.length} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: MODULE_COLORS[module] ?? 'var(--accent-cyan)' }} />
                        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.2em]"
                              style={{ color: MODULE_COLORS[module] ?? 'var(--accent-cyan)' }}>
                          {MODULE_LABELS[module] ?? module}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Resource rows */}
                  {moduleResources.map((resource) => {
                    const rowState = getRowState(resource)
                    return (
                      <tr key={resource.id}
                          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
                          className="transition-colors hover:bg-white/[0.01]">
                        {/* Resource name */}
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{resource.name}</p>
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--foreground-dim)' }}>{resource.code}</p>
                        </td>

                        {/* Full control toggle */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => toggleFullControl(resource)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              color: rowState === 'all' ? 'var(--accent-cyan)'
                                   : rowState === 'some' ? 'var(--status-amber)'
                                   : 'var(--foreground-dim)',
                            }}
                            title={rowState === 'all' ? 'Quitar todos' : 'Seleccionar todos'}
                          >
                            {rowState === 'all'  && <CheckSquare className="w-5 h-5" />}
                            {rowState === 'some' && <Minus       className="w-5 h-5" />}
                            {rowState === 'none' && <Square      className="w-5 h-5" />}
                          </button>
                        </td>

                        {/* Action checkboxes */}
                        {ACTION_COLUMNS.map((col) => {
                          const raId = resourceActionLookup.get(resource.id)?.get(col.code)
                          if (!raId) {
                            return (
                              <td key={col.code} className="py-3 px-2 text-center">
                                <span style={{ color: 'var(--border-bright)' }}>—</span>
                              </td>
                            )
                          }
                          const isChecked = checked.has(raId)
                          return (
                            <td key={col.code} className="py-3 px-2 text-center">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => toggle(raId)}
                                className="inline-flex items-center justify-center w-7 h-7 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                style={{ color: isChecked ? 'var(--accent-cyan)' : 'var(--foreground-dim)' }}
                              >
                                {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex items-center justify-between px-5 py-3"
               style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {saved ? (
              <span className="text-xs font-medium" style={{ color: 'var(--status-green)' }}>
                ✓ Cambios guardados
              </span>
            ) : <span />}
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
