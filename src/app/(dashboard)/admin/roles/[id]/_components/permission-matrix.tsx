'use client'

import { useRef, useState, useTransition } from 'react'
import { saveRolePermissionsAction } from '../../actions'
import { cn } from '@/lib/utils'
import { CheckSquare, Square, Minus, Save, Loader2 } from 'lucide-react'

// ─── Types (plain objects, no Prisma imports in client) ───────────────────────

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

// All action columns we show (in display order)
const ACTION_COLUMNS = [
  { code: 'view',          label: 'Ver'            },
  { code: 'create',        label: 'Crear'          },
  { code: 'edit',          label: 'Editar'         },
  { code: 'delete',        label: 'Eliminar'       },
  { code: 'reveal',        label: 'Revelar'        },
  { code: 'change_status', label: 'Cambiar Estado' },
  { code: 'export',        label: 'Exportar'       },
]

const MODULE_LABELS: Record<string, string> = {
  DEVELOPMENT: 'Módulo: Desarrollo',
  INFRASTRUCTURE: 'Módulo: Infraestructura',
  SUPPORT: 'Módulo: Soporte',
  SYSTEM: 'Módulo: Sistema',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PermissionMatrix({ roleId, resources, allowedIds: initial, canEdit }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initial))
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Build a lookup: resourceId → { actionCode → resourceActionId }
  const resourceActionLookup = new Map<string, Map<string, string>>()
  for (const resource of resources) {
    const actionMap = new Map<string, string>()
    for (const ra of resource.resourceActions) {
      actionMap.set(ra.action.code, ra.id)
    }
    resourceActionLookup.set(resource.id, actionMap)
  }

  function toggle(raId: string) {
    if (!canEdit) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(raId)) next.delete(raId)
      else next.add(raId)
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
      if (allChecked) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
    setSaved(false)
  }

  function getRowState(resource: Resource): 'all' | 'some' | 'none' {
    const ids = resource.resourceActions.map((ra) => ra.id)
    const checkedCount = ids.filter((id) => checked.has(id)).length
    if (checkedCount === 0) return 'none'
    if (checkedCount === ids.length) return 'all'
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-semibold text-slate-700 w-56">
                  Recurso
                </th>
                <th className="py-3 px-2 font-medium text-slate-500 text-center w-24">
                  Control total
                </th>
                {ACTION_COLUMNS.map((col) => (
                  <th
                    key={col.code}
                    className="py-3 px-2 font-medium text-slate-500 text-center min-w-[80px]"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from(byModule.entries()).map(([module, moduleResources]) => (
                <>
                  {/* Module group header */}
                  <tr key={`module-${module}`} className="bg-slate-50/50 border-t border-slate-100">
                    <td
                      colSpan={2 + ACTION_COLUMNS.length}
                      className="py-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                    >
                      {MODULE_LABELS[module] ?? module}
                    </td>
                  </tr>

                  {/* Resource rows */}
                  {moduleResources.map((resource) => {
                    const rowState = getRowState(resource)
                    return (
                      <tr
                        key={resource.id}
                        className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Resource name */}
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {resource.name}
                          <span className="block text-xs text-slate-400 font-normal font-mono">
                            {resource.code}
                          </span>
                        </td>

                        {/* Full control toggle */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => toggleFullControl(resource)}
                            className={cn(
                              'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                              canEdit ? 'hover:bg-slate-100' : 'cursor-not-allowed opacity-50',
                              rowState === 'all' && 'text-indigo-600',
                              rowState === 'some' && 'text-amber-500',
                              rowState === 'none' && 'text-slate-300',
                            )}
                            title={rowState === 'all' ? 'Quitar todos' : 'Seleccionar todos'}
                          >
                            {rowState === 'all' && <CheckSquare className="w-5 h-5" />}
                            {rowState === 'some' && <Minus className="w-5 h-5" />}
                            {rowState === 'none' && <Square className="w-5 h-5" />}
                          </button>
                        </td>

                        {/* Action checkboxes */}
                        {ACTION_COLUMNS.map((col) => {
                          const actionMap = resourceActionLookup.get(resource.id)
                          const raId = actionMap?.get(col.code)

                          if (!raId) {
                            // This action doesn't exist for this resource
                            return (
                              <td key={col.code} className="py-3 px-2 text-center">
                                <span className="text-slate-200">—</span>
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
                                className={cn(
                                  'inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                                  canEdit ? 'hover:bg-slate-100' : 'cursor-not-allowed opacity-50',
                                  isChecked ? 'text-indigo-600' : 'text-slate-300',
                                )}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-5 h-5" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">
                ✓ Cambios guardados
              </span>
            )}
            {!saved && <span />}

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
