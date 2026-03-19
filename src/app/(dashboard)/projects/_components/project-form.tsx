'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createProject, updateProject } from '../actions'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Base fields only — techStack/environments/departmentUsages are managed separately
type ProjectFormData = {
  id?: string
  name: string
  code: string
  description: string
  controlLevel: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'
  deploymentType: 'WEB' | 'DESKTOP' | 'SERVICE' | 'MOBILE'
  status: 'IDEA' | 'PLANNING' | 'DEVELOPMENT' | 'QA' | 'PRODUCTION' | 'SUSPENDED' | 'DISCONTINUED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  hasSourceCode: boolean
  repositoryUrl: string
  sourceCodePath: string
  responsibleUserId: string
  notes: string
}

type Props = {
  initialData?: ProjectFormData
  users?: Array<{ id: string; firstName: string; lastName: string }>
  mode: 'create' | 'edit'
}

const STATUS_OPTIONS = [
  { value: 'IDEA', label: 'Idea' },
  { value: 'PLANNING', label: 'Planificación' },
  { value: 'DEVELOPMENT', label: 'Desarrollo' },
  { value: 'QA', label: 'QA' },
  { value: 'PRODUCTION', label: 'Producción' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'DISCONTINUED', label: 'Descontinuado' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
]

const DEPLOYMENT_OPTIONS = [
  { value: 'WEB', label: 'Web', description: 'Aplicación web con URL de acceso' },
  { value: 'DESKTOP', label: 'Escritorio', description: 'Aplicación de escritorio (EXE, instalable)' },
  { value: 'SERVICE', label: 'Servicio', description: 'API o servicio backend sin interfaz' },
  { value: 'MOBILE', label: 'Móvil', description: 'Aplicación móvil (Android/iOS)' },
]

const CONTROL_OPTIONS = [
  { value: 'LEVEL_0', label: 'Nivel 0', description: 'Sin código fuente ni documentación (caja negra)' },
  { value: 'LEVEL_1', label: 'Nivel 1', description: 'Sin código fuente, pero con acceso a base de datos' },
  { value: 'LEVEL_2', label: 'Nivel 2', description: 'Código fuente disponible, sin documentación' },
  { value: 'LEVEL_3', label: 'Nivel 3', description: 'Control total: código + documentación + proceso de despliegue' },
]

export function ProjectForm({ initialData, users = [], mode }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name ?? '',
    code: initialData?.code ?? '',
    description: initialData?.description ?? '',
    controlLevel: initialData?.controlLevel ?? 'LEVEL_0',
    deploymentType: initialData?.deploymentType ?? 'WEB',
    status: initialData?.status ?? 'PLANNING',
    priority: initialData?.priority ?? 'MEDIUM',
    hasSourceCode: initialData?.hasSourceCode ?? false,
    repositoryUrl: initialData?.repositoryUrl ?? '',
    sourceCodePath: initialData?.sourceCodePath ?? '',
    responsibleUserId: initialData?.responsibleUserId ?? '',
    notes: initialData?.notes ?? '',
    ...(initialData?.id && { id: initialData.id }),
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear field error when user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createProject({ ...formData, techStack: [], environments: [], departmentUsages: [] })
          : await updateProject({ ...formData, id: initialData!.id! })

      if (!result.success) {
        setError(result.error)
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      if (mode === 'create' && result.data) {
        router.push(`/projects/${result.data.id}`)
      } else {
        router.push(`/projects/${initialData!.id}`)
      }
    })
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  const labelStyle = { color: 'var(--foreground-muted)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error banner */}
      {error && (
        <div
          className="p-4 rounded text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--status-red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Basic info */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Información Básica
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Nombre del proyecto *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ej: Sistema de Gestión de Inventarios"
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1"
              style={{
                ...inputStyle,
                ...(fieldErrors.name && { borderColor: 'var(--status-red)' }),
              }}
            />
            {fieldErrors.name && (
              <p className="text-xs mt-1" style={{ color: 'var(--status-red)' }}>
                {fieldErrors.name[0]}
              </p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Código *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={(e) =>
                handleChange({
                  ...e,
                  target: { ...e.target, value: e.target.value.toUpperCase() },
                } as React.ChangeEvent<HTMLInputElement>)
              }
              required
              placeholder="Ej: SGI-001"
              className="w-full px-3 py-2.5 rounded text-sm font-mono transition-all focus:outline-none focus:ring-1"
              style={{
                ...inputStyle,
                fontFamily: 'var(--font-jetbrains)',
                ...(fieldErrors.code && { borderColor: 'var(--status-red)' }),
              }}
            />
            {fieldErrors.code && (
              <p className="text-xs mt-1" style={{ color: 'var(--status-red)' }}>
                {fieldErrors.code[0]}
              </p>
            )}
          </div>

          {/* Responsible */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Responsable
            </label>
            <select
              name="responsibleUserId"
              value={formData.responsibleUserId}
              onChange={handleChange}
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 cursor-pointer"
              style={inputStyle}
            >
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Breve descripción del sistema y su propósito..."
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 resize-none"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Classification */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Clasificación
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Deployment Type */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Tipo de despliegue *
            </label>
            <select
              name="deploymentType"
              value={formData.deploymentType}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 cursor-pointer"
              style={inputStyle}
            >
              {DEPLOYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Control Level */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Nivel de control *
            </label>
            <select
              name="controlLevel"
              value={formData.controlLevel}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 cursor-pointer"
              style={inputStyle}
            >
              {CONTROL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Estado *
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 cursor-pointer"
              style={inputStyle}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              Prioridad *
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 cursor-pointer"
              style={inputStyle}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Source code */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Código Fuente
        </h2>

        <div className="space-y-4">
          {/* Has source code */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="hasSourceCode"
              checked={formData.hasSourceCode}
              onChange={handleChange}
              className="w-4 h-4 rounded"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
              Tenemos acceso al código fuente
            </span>
          </label>

          {formData.hasSourceCode && (
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              {/* Repository URL */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
                  URL del repositorio
                </label>
                <input
                  type="url"
                  name="repositoryUrl"
                  value={formData.repositoryUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/org/repo"
                  className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1"
                  style={inputStyle}
                />
              </div>

              {/* Source code path */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
                  Ruta local del código
                </label>
                <input
                  type="text"
                  name="sourceCodePath"
                  value={formData.sourceCodePath}
                  onChange={handleChange}
                  placeholder="\\servidor\proyectos\codigo"
                  className="w-full px-3 py-2.5 rounded text-sm font-mono transition-all focus:outline-none focus:ring-1"
                  style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div
        className="rounded p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] mb-4"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Notas Adicionales
        </h2>

        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder="Información adicional, observaciones, historial relevante..."
          className="w-full px-3 py-2.5 rounded text-sm transition-all focus:outline-none focus:ring-1 resize-none"
          style={inputStyle}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={mode === 'edit' ? `/projects/${initialData?.id}` : '/projects'}
          className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--foreground-muted)',
          }}
        >
          <ArrowLeft size={14} />
          Cancelar
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: '#fff',
          }}
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save size={14} />
              {mode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
