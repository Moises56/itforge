'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProject, type CreateProjectInput } from '../../actions'
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  Globe,
  Server,
  Code2,
  Building2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type User = { id: string; firstName: string; lastName: string }
type Department = { id: string; name: string; code: string }

type TechEntry = { category: string; name: string; version: string }
type EnvEntry = {
  type: string
  serverIp: string
  serverPort: string
  url: string
  uncPath: string
  notes: string
}
type DeptEntry = { departmentId: string; estimatedUsers: string; contactPerson: string }

interface CreateProjectFormProps {
  users: User[]
  departments: Department[]
}

// ─── Step options ─────────────────────────────────────────────────────────────

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
  { value: 'WEB', label: 'Web', desc: 'Aplicación web con URL' },
  { value: 'DESKTOP', label: 'Escritorio', desc: 'Aplicación de escritorio' },
  { value: 'SERVICE', label: 'Servicio/API', desc: 'Backend sin interfaz' },
  { value: 'MOBILE', label: 'Móvil', desc: 'App Android/iOS' },
]

const CONTROL_OPTIONS = [
  { value: 'LEVEL_0', label: 'Nivel 0', desc: 'Sin código fuente ni documentación' },
  { value: 'LEVEL_1', label: 'Nivel 1', desc: 'Sin código, pero con acceso a DB' },
  { value: 'LEVEL_2', label: 'Nivel 2', desc: 'Código disponible, sin documentación' },
  { value: 'LEVEL_3', label: 'Nivel 3', desc: 'Control total: código + docs + despliegue' },
]

const TECH_CATEGORIES = [
  { value: 'LANGUAGE', label: 'Lenguaje' },
  { value: 'FRAMEWORK', label: 'Framework' },
  { value: 'DATABASE_ENGINE', label: 'Base de Datos' },
  { value: 'TOOL', label: 'Herramienta' },
  { value: 'OTHER', label: 'Otro' },
]

const ENV_TYPES = [
  { value: 'DEV', label: 'Desarrollo', color: '#3b82f6' },
  { value: 'STAGING', label: 'Staging', color: '#f59e0b' },
  { value: 'PRODUCTION', label: 'Producción', color: '#10b981' },
]

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}

const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Info Básica',    icon: Code2     },
  { label: 'Stack Técnico',  icon: Server    },
  { label: 'Ambientes',      icon: Globe     },
  { label: 'Departamentos',  icon: Building2 },
]

// ─── Stepper header ───────────────────────────────────────────────────────────

function StepperHeader({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: number
  completedSteps: Set<number>
  onStepClick: (step: number) => void
}) {
  return (
    <div
      className="flex items-center gap-0 rounded overflow-hidden mb-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {STEPS.map((step, idx) => {
        const isActive = idx === currentStep
        const isDone = completedSteps.has(idx)
        const isClickable = isDone || idx <= Math.max(...Array.from(completedSteps), currentStep)
        const Icon = step.icon

        return (
          <button
            key={idx}
            type="button"
            onClick={() => isClickable && onStepClick(idx)}
            className="flex-1 flex items-center gap-2.5 px-4 py-3 transition-all"
            style={{
              background: isActive ? 'var(--accent-glow)' : 'transparent',
              borderRight: idx < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: isClickable ? 'pointer' : 'default',
              opacity: isClickable ? 1 : 0.5,
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono font-bold"
              style={{
                background: isActive
                  ? 'var(--accent)'
                  : isDone
                  ? 'rgba(16,185,129,0.15)'
                  : 'var(--surface-2)',
                border: isActive
                  ? '1px solid var(--accent)'
                  : isDone
                  ? '1px solid rgba(16,185,129,0.4)'
                  : '1px solid var(--border)',
                color: isActive ? '#fff' : isDone ? '#10b981' : 'var(--foreground-muted)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              {isDone && !isActive ? <Check size={10} /> : idx + 1}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p
                className="text-[10px] font-heading font-semibold uppercase tracking-widest truncate"
                style={{
                  color: isActive
                    ? 'var(--accent-cyan)'
                    : isDone
                    ? '#10b981'
                    : 'var(--foreground-muted)',
                }}
              >
                {step.label}
              </p>
            </div>
            <Icon
              size={13}
              className="hidden sm:block ml-auto shrink-0"
              style={{
                color: isActive
                  ? 'var(--accent-cyan)'
                  : isDone
                  ? '#10b981'
                  : 'var(--foreground-dim)',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
        {label} {required && <span style={{ color: 'var(--status-red)' }}>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--status-red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Step 1 — Info Básica ─────────────────────────────────────────────────────

function Step1({
  data,
  users,
  errors,
  onChange,
}: {
  data: {
    name: string
    code: string
    description: string
    status: string
    deploymentType: string
    controlLevel: string
    priority: string
    responsibleUserId: string
    hasSourceCode: boolean
    repositoryUrl: string
  }
  users: User[]
  errors: Record<string, string>
  onChange: (key: string, value: string | boolean) => void
}) {
  const inputCls =
    'w-full px-3 py-2.5 rounded text-sm outline-none transition-all focus:border-[var(--border-focus)]'

  return (
    <div className="space-y-5">
      {/* Name + Code */}
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Nombre del proyecto" required error={errors.name} className="md:col-span-2">
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Ej: Sistema de Gestión de Inventarios"
            className={inputCls}
            style={{
              ...inputStyle,
              ...(errors.name ? { borderColor: 'var(--status-red)' } : {}),
            }}
          />
        </Field>
        <Field label="Código" required error={errors.code}>
          <input
            type="text"
            value={data.code}
            onChange={(e) => onChange('code', e.target.value.toUpperCase())}
            placeholder="SGI-001"
            className={inputCls}
            style={{
              ...inputStyle,
              fontFamily: 'var(--font-jetbrains)',
              ...(errors.code ? { borderColor: 'var(--status-red)' } : {}),
            }}
          />
        </Field>
      </div>

      {/* Description */}
      <Field label="Descripción">
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={3}
          placeholder="Propósito del sistema, a quién sirve, funcionalidades principales..."
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
      </Field>

      {/* Deployment + Control Level */}
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tipo de despliegue" required>
          <select
            value={data.deploymentType}
            onChange={(e) => onChange('deploymentType', e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            {DEPLOYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.desc}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nivel de control" required>
          <select
            value={data.controlLevel}
            onChange={(e) => onChange('controlLevel', e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            {CONTROL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.desc}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Status + Priority + Responsible */}
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Estado" required>
          <select
            value={data.status}
            onChange={(e) => onChange('status', e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad" required>
          <select
            value={data.priority}
            onChange={(e) => onChange('priority', e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsable">
          <select
            value={data.responsibleUserId}
            onChange={(e) => onChange('responsibleUserId', e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Source code */}
      <div
        className="rounded p-4"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <label className="flex items-center gap-3 cursor-pointer mb-0">
          <input
            type="checkbox"
            checked={data.hasSourceCode}
            onChange={(e) => onChange('hasSourceCode', e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Tenemos acceso al código fuente
          </span>
        </label>
        {data.hasSourceCode && (
          <div className="mt-4">
            <Field label="URL del repositorio">
              <input
                type="url"
                value={data.repositoryUrl}
                onChange={(e) => onChange('repositoryUrl', e.target.value)}
                placeholder="https://github.com/org/repositorio"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 2 — Stack Técnico ───────────────────────────────────────────────────

function Step2({
  entries,
  onChange,
}: {
  entries: TechEntry[]
  onChange: (entries: TechEntry[]) => void
}) {
  const addEntry = () =>
    onChange([...entries, { category: 'LANGUAGE', name: '', version: '' }])

  const removeEntry = (i: number) =>
    onChange(entries.filter((_, idx) => idx !== i))

  const updateEntry = (i: number, field: keyof TechEntry, value: string) => {
    const next = [...entries]
    next[i] = { ...next[i]!, [field]: value }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Registra las tecnologías principales del sistema. Se mostrarán las primeras 3 en la lista de proyectos.
      </p>

      {entries.length === 0 ? (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            No hay tecnologías registradas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="rounded p-3 flex items-end gap-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                    Categoría
                  </label>
                  <select
                    value={entry.category}
                    onChange={(e) => updateEntry(i, 'category', e.target.value)}
                    className="w-full px-2.5 py-2 rounded text-xs outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    {TECH_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateEntry(i, 'name', e.target.value)}
                    placeholder="Ej: React, PostgreSQL..."
                    className="w-full px-2.5 py-2 rounded text-xs outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                    Versión
                  </label>
                  <input
                    type="text"
                    value={entry.version}
                    onChange={(e) => updateEntry(i, 'version', e.target.value)}
                    placeholder="Ej: 18.2.0"
                    className="w-full px-2.5 py-2 rounded text-xs outline-none"
                    style={{
                      ...inputStyle,
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="p-2 rounded flex-shrink-0 transition-colors"
                style={{ color: 'var(--foreground-muted)' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--status-red)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground-muted)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all"
        style={{
          color: 'var(--accent-cyan)',
          background: 'var(--accent-cyan-dim)',
          border: '1px solid rgba(6,182,212,0.2)',
        }}
      >
        <Plus size={14} />
        Agregar tecnología
      </button>
    </div>
  )
}

// ─── Step 3 — Ambientes ───────────────────────────────────────────────────────

function Step3({
  entries,
  deploymentType,
  onChange,
}: {
  entries: EnvEntry[]
  deploymentType: string
  onChange: (entries: EnvEntry[]) => void
}) {
  const usedTypes = new Set(entries.map((e) => e.type))

  const addEnv = (type: string) => {
    if (usedTypes.has(type)) return
    onChange([...entries, { type, serverIp: '', serverPort: '', url: '', uncPath: '', notes: '' }])
  }

  const removeEnv = (i: number) => onChange(entries.filter((_, idx) => idx !== i))

  const updateEnv = (i: number, field: keyof EnvEntry, value: string) => {
    const next = [...entries]
    next[i] = { ...next[i]!, [field]: value }
    onChange(next)
  }

  const showUrl = deploymentType === 'WEB' || deploymentType === 'MOBILE'
  const showIpPort = deploymentType === 'WEB' || deploymentType === 'SERVICE' || deploymentType === 'DESKTOP'
  const showUncPath = deploymentType === 'DESKTOP'

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Define los ambientes de despliegue del sistema. Puedes agregar hasta uno de cada tipo.
      </p>

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2">
        {ENV_TYPES.map((envType) => {
          const used = usedTypes.has(envType.value)
          return (
            <button
              key={envType.value}
              type="button"
              onClick={() => addEnv(envType.value)}
              disabled={used}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                color: used ? 'var(--foreground-dim)' : envType.color,
                background: used ? 'var(--surface-2)' : `${envType.color}14`,
                border: used
                  ? '1px solid var(--border)'
                  : `1px solid ${envType.color}30`,
                cursor: used ? 'not-allowed' : 'pointer',
              }}
            >
              {used ? <Check size={11} /> : <Plus size={11} />}
              {envType.label}
            </button>
          )
        })}
      </div>

      {/* Env cards */}
      {entries.length === 0 ? (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Agrega al menos un ambiente usando los botones de arriba
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((env, i) => {
            const envConfig = ENV_TYPES.find((e) => e.value === env.type)
            return (
              <div
                key={i}
                className="rounded overflow-hidden"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between px-4 py-2 border-b"
                  style={{
                    borderColor: 'var(--border)',
                    borderLeft: `3px solid ${envConfig?.color ?? 'var(--border)'}`,
                  }}
                >
                  <span
                    className="text-xs font-heading font-semibold uppercase tracking-widest"
                    style={{ color: envConfig?.color ?? 'var(--foreground-muted)' }}
                  >
                    {envConfig?.label ?? env.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEnv(i)}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--foreground-muted)' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--status-red)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground-muted)'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Fields */}
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  {showIpPort && (
                    <>
                      <div>
                        <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                          IP del Servidor
                        </label>
                        <input
                          type="text"
                          value={env.serverIp}
                          onChange={(e) => updateEnv(i, 'serverIp', e.target.value)}
                          placeholder="192.168.1.100"
                          className="w-full px-2.5 py-2 rounded text-xs outline-none"
                          style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                          Puerto
                        </label>
                        <input
                          type="number"
                          value={env.serverPort}
                          onChange={(e) => updateEnv(i, 'serverPort', e.target.value)}
                          placeholder="8080"
                          min={1}
                          max={65535}
                          className="w-full px-2.5 py-2 rounded text-xs outline-none"
                          style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                        />
                      </div>
                    </>
                  )}
                  {showUrl && (
                    <div className={showIpPort ? 'md:col-span-2' : ''}>
                      <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                        URL
                      </label>
                      <input
                        type="url"
                        value={env.url}
                        onChange={(e) => updateEnv(i, 'url', e.target.value)}
                        placeholder="https://sistema.ejemplo.com"
                        className="w-full px-2.5 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                      />
                    </div>
                  )}
                  {showUncPath && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                        Ruta UNC
                      </label>
                      <input
                        type="text"
                        value={env.uncPath}
                        onChange={(e) => updateEnv(i, 'uncPath', e.target.value)}
                        placeholder="\\servidor\aplicaciones\sistema"
                        className="w-full px-2.5 py-2 rounded text-xs outline-none"
                        style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                      Notas del ambiente
                    </label>
                    <input
                      type="text"
                      value={env.notes}
                      onChange={(e) => updateEnv(i, 'notes', e.target.value)}
                      placeholder="Observaciones sobre este ambiente..."
                      className="w-full px-2.5 py-2 rounded text-xs outline-none"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Step 4 — Departamentos ───────────────────────────────────────────────────

function Step4({
  entries,
  departments,
  onChange,
}: {
  entries: DeptEntry[]
  departments: Department[]
  onChange: (entries: DeptEntry[]) => void
}) {
  const usedDeptIds = new Set(entries.map((e) => e.departmentId))

  const toggleDept = (deptId: string) => {
    if (usedDeptIds.has(deptId)) {
      onChange(entries.filter((e) => e.departmentId !== deptId))
    } else {
      onChange([...entries, { departmentId: deptId, estimatedUsers: '', contactPerson: '' }])
    }
  }

  const updateEntry = (deptId: string, field: 'estimatedUsers' | 'contactPerson', value: string) => {
    onChange(
      entries.map((e) => (e.departmentId === deptId ? { ...e, [field]: value } : e)),
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Selecciona los departamentos que utilizan este sistema y agrega información de uso.
      </p>

      {departments.length === 0 ? (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            No hay departamentos configurados en el sistema
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => {
            const isSelected = usedDeptIds.has(dept.id)
            const entry = entries.find((e) => e.departmentId === dept.id)

            return (
              <div
                key={dept.id}
                className="rounded overflow-hidden transition-all"
                style={{
                  background: isSelected ? 'var(--accent-glow)' : 'var(--surface-2)',
                  border: isSelected
                    ? '1px solid var(--border-bright)'
                    : '1px solid var(--border)',
                }}
              >
                {/* Dept toggle row */}
                <button
                  type="button"
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected ? 'var(--accent)' : 'var(--surface)',
                      border: isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                    }}
                  >
                    {isSelected && <Check size={10} style={{ color: '#fff' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium"
                      style={{ color: isSelected ? 'var(--foreground)' : 'var(--foreground-muted)' }}
                    >
                      {dept.name}
                    </p>
                    <p
                      className="text-[10px] font-mono"
                      style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
                    >
                      {dept.code}
                    </p>
                  </div>
                </button>

                {/* Detail fields when selected */}
                {isSelected && entry && (
                  <div
                    className="px-4 pb-4 grid md:grid-cols-2 gap-3 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="pt-3">
                      <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                        Usuarios estimados
                      </label>
                      <input
                        type="number"
                        value={entry.estimatedUsers}
                        onChange={(e) => updateEntry(dept.id, 'estimatedUsers', e.target.value)}
                        placeholder="Ej: 25"
                        min={1}
                        className="w-full px-2.5 py-2 rounded text-xs outline-none"
                        style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                      />
                    </div>
                    <div className="pt-3">
                      <label className="block text-[10px] font-medium mb-1" style={labelStyle}>
                        Persona de contacto
                      </label>
                      <input
                        type="text"
                        value={entry.contactPerson}
                        onChange={(e) => updateEntry(dept.id, 'contactPerson', e.target.value)}
                        placeholder="Nombre del contacto en el área"
                        className="w-full px-2.5 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function CreateProjectForm({ users, departments }: CreateProjectFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 1 state
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    code: '',
    description: '',
    status: 'PLANNING',
    deploymentType: 'WEB',
    controlLevel: 'LEVEL_0',
    priority: 'MEDIUM',
    responsibleUserId: '',
    hasSourceCode: false,
    repositoryUrl: '',
  })

  // Step 2 state
  const [techStack, setTechStack] = useState<TechEntry[]>([])

  // Step 3 state
  const [environments, setEnvironments] = useState<EnvEntry[]>([])

  // Step 4 state
  const [deptUsages, setDeptUsages] = useState<DeptEntry[]>([])

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!basicInfo.name.trim() || basicInfo.name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    }
    if (!basicInfo.code.trim() || basicInfo.code.length < 2) {
      newErrors.code = 'El código debe tener al menos 2 caracteres'
    } else if (!/^[A-Z0-9_-]+$/.test(basicInfo.code)) {
      newErrors.code = 'Solo mayúsculas, números, guiones y guiones bajos'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const hasEmptyName = techStack.some((t) => !t.name.trim())
    if (hasEmptyName) {
      setErrors({ techStack: 'Todos los elementos deben tener un nombre' })
      return false
    }
    setErrors({})
    return true
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goToStep = (target: number) => {
    setErrors({})
    setServerError(null)
    setCurrentStep(target)
  }

  const handleNext = () => {
    let valid = true
    if (currentStep === 0) valid = validateStep1()
    if (currentStep === 1) valid = validateStep2()

    if (!valid) return

    setCompletedSteps((prev) => new Set(prev).add(currentStep))
    setCurrentStep((s) => s + 1)
  }

  const handleBack = () => {
    setErrors({})
    setCurrentStep((s) => s - 1)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    setServerError(null)

    const input: CreateProjectInput = {
      name: basicInfo.name,
      code: basicInfo.code,
      description: basicInfo.description || undefined,
      status: basicInfo.status as CreateProjectInput['status'],
      deploymentType: basicInfo.deploymentType as CreateProjectInput['deploymentType'],
      controlLevel: basicInfo.controlLevel as CreateProjectInput['controlLevel'],
      priority: basicInfo.priority as CreateProjectInput['priority'],
      hasSourceCode: basicInfo.hasSourceCode,
      repositoryUrl: basicInfo.repositoryUrl || undefined,
      responsibleUserId: basicInfo.responsibleUserId || undefined,
      techStack: techStack
        .filter((t) => t.name.trim())
        .map((t) => ({
          category: t.category as CreateProjectInput['techStack'][0]['category'],
          name: t.name.trim(),
          version: t.version.trim() || undefined,
        })),
      environments: environments.map((e) => ({
        type: e.type as CreateProjectInput['environments'][0]['type'],
        serverIp: e.serverIp.trim() || undefined,
        serverPort: e.serverPort ? parseInt(e.serverPort, 10) : undefined,
        url: e.url.trim() || undefined,
        uncPath: e.uncPath.trim() || undefined,
        notes: e.notes.trim() || undefined,
      })),
      departmentUsages: deptUsages.map((d) => ({
        departmentId: d.departmentId,
        estimatedUsers: d.estimatedUsers ? parseInt(d.estimatedUsers, 10) : undefined,
        contactPerson: d.contactPerson.trim() || undefined,
      })),
    }

    startTransition(async () => {
      const result = await createProject(input)
      if (!result.success) {
        setServerError(result.error)
        if (result.fieldErrors) {
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(result.fieldErrors)) {
            if (v?.[0]) mapped[k] = v[0]
          }
          setErrors(mapped)
          if (mapped.name || mapped.code) setCurrentStep(0)
        }
        return
      }
      router.push(`/projects/${result.data.id}`)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <StepperHeader
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      {/* Error banner */}
      {serverError && (
        <div
          className="mb-5 p-4 rounded text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--status-red)',
          }}
        >
          {serverError}
        </div>
      )}

      {errors.techStack && currentStep === 1 && (
        <div
          className="mb-4 p-3 rounded text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--status-red)',
          }}
        >
          {errors.techStack}
        </div>
      )}

      {/* Step content */}
      <div
        className="rounded p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {currentStep === 0 && (
          <Step1
            data={basicInfo}
            users={users}
            errors={errors}
            onChange={(key, value) =>
              setBasicInfo((prev) => ({ ...prev, [key]: value }))
            }
          />
        )}
        {currentStep === 1 && (
          <Step2 entries={techStack} onChange={setTechStack} />
        )}
        {currentStep === 2 && (
          <Step3
            entries={environments}
            deploymentType={basicInfo.deploymentType}
            onChange={setEnvironments}
          />
        )}
        {currentStep === 3 && (
          <Step4
            entries={deptUsages}
            departments={departments}
            onChange={setDeptUsages}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-5">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-30"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--foreground-muted)',
          }}
        >
          <ChevronLeft size={14} />
          Anterior
        </button>

        <div className="flex items-center gap-2">
          {/* Step indicators */}
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{
                background:
                  i === currentStep
                    ? 'var(--accent-cyan)'
                    : completedSteps.has(i)
                    ? '#10b981'
                    : 'var(--border-bright)',
              }}
            />
          ))}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Siguiente
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check size={14} />
                Crear Proyecto
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
