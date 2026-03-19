'use client'

import { useState, useTransition } from 'react'
import { Trash2, Loader2, X } from 'lucide-react'
import { deleteProject } from '../../actions'

type Props = {
  projectId: string
  projectName: string
}

export function DeleteProjectButton({ projectId, projectName }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteProject(projectId)
      if (!result.success) {
        setError(result.error)
      }
      // If successful, the action redirects to /projects
    })
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--status-red)',
        }}
      >
        <Trash2 size={14} />
        Eliminar
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.7)' }}
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Eliminar proyecto
          </h3>
          <button
            onClick={() => setShowConfirm(false)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm mb-2" style={{ color: 'var(--foreground-muted)' }}>
          ¿Estás seguro de que deseas eliminar el proyecto?
        </p>
        <p
          className="text-sm font-medium mb-4"
          style={{ color: 'var(--foreground)' }}
        >
          {projectName}
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--foreground-muted)' }}>
          Esta acción moverá el proyecto a la papelera. Los datos asociados
          (credenciales, documentos, solicitudes) permanecerán vinculados.
        </p>

        {error && (
          <div
            className="p-3 rounded text-sm mb-4"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--status-red)',
            }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            className="px-4 py-2 rounded text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: 'var(--status-red)',
              color: '#fff',
            }}
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Eliminar proyecto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
