'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  ExternalLink,
  GitBranch,
  Globe,
  Monitor,
  Server,
  Smartphone,
  Code2,
  Building2,
  Users,
  Network,
  Info,
  Key,
  FileText,
  GitPullRequest,
  Flame,
  AlertTriangle,
  ArrowDown,
  Minus,
} from 'lucide-react'
import { CredentialsTab, type CredentialItem } from './credentials-tab'
import { DocumentsTab, type DocumentItem } from './documents-tab'
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  addTechStack,
  removeTechStack,
  addDepartmentUsage,
  updateDepartmentUsage,
  removeDepartmentUsage,
  createProjectRole,
  updateProjectRole,
  deleteProjectRole,
  createProjectRelation,
  deleteProjectRelation,
} from '@/modules/development/actions/project-tabs'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectInfo = {
  id: string
  name: string
  code: string
  description: string | null
  status: string
  controlLevel: string
  deploymentType: string
  priority: string
  hasSourceCode: boolean
  repositoryUrl: string | null
  sourceCodePath: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  responsibleUser: { id: string; firstName: string; lastName: string; email: string } | null
  changeRequestCount: number
  credentialCount: number
  documentCount: number
}

type Environment = {
  id: string
  type: string
  serverIp: string | null
  serverPort: number | null
  url: string | null
  uncPath: string | null
  notes: string | null
}

type TechStackItem = {
  id: string
  category: string
  name: string
  version: string | null
}

type DepartmentUsage = {
  id: string
  estimatedUsers: number | null
  contactPerson: string | null
  department: { id: string; name: string; code: string }
}

type ProjectRole = {
  id: string
  roleName: string
  description: string | null
}

type RelationItem = {
  id: string
  type: string
  notes: string | null
  targetProject?: { id: string; name: string; code: string; status: string }
  sourceProject?: { id: string; name: string; code: string; status: string }
}

type Department = { id: string; name: string; code: string }
type ProjectRef = { id: string; name: string; code: string }

type ChangeRequestSummary = {
  id:            string
  title:         string
  status:        string
  priority:      string
  type:          string
  requesterName: string
  assignedTo:    { id: string; firstName: string; lastName: string } | null
  createdAt:     string
}

interface Props {
  project: ProjectInfo
  environments: Environment[]
  techStack: TechStackItem[]
  departmentUsages: DepartmentUsage[]
  projectRoles: ProjectRole[]
  sourceRelations: RelationItem[]
  targetRelations: RelationItem[]
  departments: Department[]
  allProjects: ProjectRef[]
  credentials: CredentialItem[]
  documents: DocumentItem[]
  changeRequests: ChangeRequestSummary[]
  canEdit: boolean
  canManageChanges: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

type TabKey = 'general' | 'environments' | 'techstack' | 'departments' | 'roles' | 'relations' | 'credentials' | 'documents' | 'changes'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general',      label: 'General',          icon: <Info             size={13} /> },
  { key: 'environments', label: 'Ambientes',         icon: <Globe            size={13} /> },
  { key: 'techstack',    label: 'Stack Técnico',     icon: <Code2            size={13} /> },
  { key: 'departments',  label: 'Departamentos',     icon: <Building2        size={13} /> },
  { key: 'roles',        label: 'Roles',             icon: <Users            size={13} /> },
  { key: 'relations',    label: 'Relaciones',        icon: <Network          size={13} /> },
  { key: 'credentials',  label: 'Credenciales',      icon: <Key              size={13} /> },
  { key: 'documents',    label: 'Documentos',        icon: <FileText         size={13} /> },
  { key: 'changes',      label: 'Cambios',           icon: <GitPullRequest   size={13} /> },
]

const ENV_META: Record<string, { label: string; color: string }> = {
  DEV:        { label: 'Desarrollo',  color: '#3b82f6' },
  STAGING:    { label: 'Staging',     color: '#f59e0b' },
  PRODUCTION: { label: 'Producción',  color: '#10b981' },
}

const TECH_CATEGORIES = [
  { value: 'LANGUAGE',        label: 'Lenguaje' },
  { value: 'FRAMEWORK',       label: 'Framework' },
  { value: 'DATABASE_ENGINE', label: 'Base de Datos' },
  { value: 'TOOL',            label: 'Herramienta' },
  { value: 'OTHER',           label: 'Otro' },
]

const RELATION_TYPES = [
  { value: 'DEPENDS_ON',      label: 'Depende de' },
  { value: 'EXTENDS',         label: 'Extiende' },
  { value: 'REPLACES',        label: 'Reemplaza' },
  { value: 'SHARES_DATABASE', label: 'Comparte BD' },
]

const RELATION_TYPE_CONFIG: Record<string, {
  label:       string
  outLabel:    string
  inLabel:     string
  description: string
  color:       string
  bg:          string
  border:      string
}> = {
  DEPENDS_ON: {
    label:       'Dependencias',
    outLabel:    'Este proyecto depende de',
    inLabel:     'Este proyecto es requerido por',
    description: 'Sistemas de los que este proyecto necesita para funcionar',
    color:       '#f59e0b',
    bg:          'rgba(245,158,11,0.08)',
    border:      'rgba(245,158,11,0.2)',
  },
  EXTENDS: {
    label:       'Extensiones',
    outLabel:    'Este proyecto extiende',
    inLabel:     'Este proyecto es extendido por',
    description: 'Este proyecto actúa como satélite que añade funcionalidad a otro sistema',
    color:       '#3b82f6',
    bg:          'rgba(59,130,246,0.08)',
    border:      'rgba(59,130,246,0.2)',
  },
  REPLACES: {
    label:       'Reemplazos',
    outLabel:    'Este proyecto reemplaza',
    inLabel:     'Este proyecto es reemplazado por',
    description: 'Relación de sustitución entre sistemas legacy y nuevos',
    color:       '#8b5cf6',
    bg:          'rgba(139,92,246,0.08)',
    border:      'rgba(139,92,246,0.2)',
  },
  SHARES_DATABASE: {
    label:       'BD Compartida',
    outLabel:    'Comparte base de datos con',
    inLabel:     'Comparte base de datos con',
    description: 'Múltiples sistemas leen/escriben la misma base de datos',
    color:       '#06b6d4',
    bg:          'rgba(6,182,212,0.08)',
    border:      'rgba(6,182,212,0.2)',
  },
}

const STATUS_COLORS: Record<string, string> = {
  PRODUCTION:   'var(--status-green)',
  QA:           'var(--status-blue)',
  DEVELOPMENT:  'var(--status-blue)',
  PLANNING:     'var(--status-purple)',
  IDEA:         'var(--status-slate)',
  SUSPENDED:    'var(--status-amber)',
  DISCONTINUED: 'var(--status-red)',
}

const CONTROL_DESCRIPTIONS: Record<string, string> = {
  LEVEL_0: 'Sin código fuente ni documentación (caja negra)',
  LEVEL_1: 'Sin código fuente, pero con acceso a base de datos',
  LEVEL_2: 'Código fuente disponible, sin documentación',
  LEVEL_3: 'Control total: código + documentación + proceso de despliegue',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
}
const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'var(--status-slate)', MEDIUM: 'var(--status-blue)',
  HIGH: 'var(--status-amber)', CRITICAL: 'var(--status-red)',
}

const DEPLOYMENT_ICONS: Record<string, React.ReactNode> = {
  WEB: <Globe size={14} />, DESKTOP: <Monitor size={14} />,
  SERVICE: <Server size={14} />, MOBILE: <Smartphone size={14} />,
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-2 rounded text-xs outline-none transition-all focus:ring-1 focus:ring-[var(--border-focus)]'
const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
}
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] mb-2"
      style={{ color: 'var(--foreground-muted)' }}
    >
      {children}
    </h3>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded p-8 text-center"
      style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
    >
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{message}</p>
    </div>
  )
}

function InlineError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div
      className="p-3 rounded text-xs"
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        color: 'var(--status-red)',
      }}
    >
      {error}
    </div>
  )
}

function AddButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-40"
      style={{
        color: 'var(--accent-cyan)',
        background: 'var(--accent-cyan-dim)',
        border: '1px solid rgba(6,182,212,0.2)',
      }}
    >
      <Plus size={12} />
      {children}
    </button>
  )
}

function IconBtn({
  onClick,
  danger,
  title,
  children,
  disabled,
}: {
  onClick: () => void
  danger?: boolean
  title?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded transition-all disabled:opacity-40"
      style={{ color: danger ? 'var(--status-red)' : 'var(--foreground-muted)' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        if (danger) el.style.background = 'rgba(239,68,68,0.1)'
        else el.style.color = 'var(--foreground)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'transparent'
        if (!danger) el.style.color = 'var(--foreground-muted)'
      }}
    >
      {children}
    </button>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 2) return 'ahora'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days < 7) return `hace ${days}d`
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`
  return `hace ${Math.floor(days / 30)}mes`
}

// ─── Tab: General ─────────────────────────────────────────────────────────────

function GeneralTab({ project }: { project: ProjectInfo }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Left col */}
      <div className="lg:col-span-2 space-y-4">
        {project.description && (
          <div
            className="rounded p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <SectionLabel>Descripción</SectionLabel>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {project.description}
            </p>
          </div>
        )}

        {project.notes && (
          <div
            className="rounded p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <SectionLabel>Notas</SectionLabel>
            <p
              className="text-sm whitespace-pre-wrap leading-relaxed"
              style={{ color: 'var(--foreground-muted)' }}
            >
              {project.notes}
            </p>
          </div>
        )}

        {project.hasSourceCode && (
          <div
            className="rounded p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <SectionLabel>Código Fuente</SectionLabel>
            <div className="space-y-2">
              {project.repositoryUrl && (
                <a
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'var(--accent-cyan)' }}
                >
                  <GitBranch size={14} />
                  Ver repositorio
                  <ExternalLink size={11} />
                </a>
              )}
              {project.sourceCodePath && (
                <p
                  className="text-xs font-mono break-all"
                  style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}
                >
                  {project.sourceCodePath}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right col */}
      <div className="space-y-4">
        <div
          className="rounded p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <SectionLabel>Detalles</SectionLabel>
          <dl className="space-y-3 text-sm">
            {project.responsibleUser && (
              <div>
                <dt className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                  Responsable
                </dt>
                <dd style={{ color: 'var(--foreground)' }}>
                  {project.responsibleUser.firstName} {project.responsibleUser.lastName}
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {project.responsibleUser.email}
                  </p>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                Nivel de control
              </dt>
              <dd style={{ color: 'var(--foreground)' }}>
                <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                  {CONTROL_DESCRIPTIONS[project.controlLevel]}
                </p>
              </dd>
            </div>
            <div>
              <dt className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                Tipo de despliegue
              </dt>
              <dd className="flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                {DEPLOYMENT_ICONS[project.deploymentType]}
                <span className="text-xs">{project.deploymentType}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                Prioridad
              </dt>
              <dd
                className="text-xs font-medium"
                style={{ color: PRIORITY_COLORS[project.priority] }}
              >
                {PRIORITY_LABELS[project.priority]}
              </dd>
            </div>
            <div>
              <dt className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>Código fuente</dt>
              <dd className="text-xs" style={{ color: project.hasSourceCode ? 'var(--status-green)' : 'var(--foreground-muted)' }}>
                {project.hasSourceCode ? 'Disponible' : 'No disponible'}
              </dd>
            </div>
          </dl>
        </div>

        <div
          className="rounded p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <SectionLabel>Estadísticas</SectionLabel>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Credenciales', value: project.credentialCount },
              { label: 'Documentos', value: project.documentCount },
              { label: 'Solicitudes de cambio', value: project.changeRequestCount },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span style={{ color: 'var(--foreground-muted)' }}>{label}</span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains)' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded p-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <SectionLabel>Fechas</SectionLabel>
          <dl className="space-y-2 text-xs">
            <div>
              <dt style={{ color: 'var(--foreground-muted)' }}>Creado</dt>
              <dd style={{ color: 'var(--foreground)' }}>{formatDate(project.createdAt)}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--foreground-muted)' }}>Última actualización</dt>
              <dd style={{ color: 'var(--foreground)' }}>
                {formatDate(project.updatedAt)}{' '}
                <span style={{ color: 'var(--foreground-muted)' }}>
                  ({formatRelativeTime(project.updatedAt)})
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Environments ────────────────────────────────────────────────────────

function EnvironmentsTab({
  projectId,
  environments,
  deploymentType,
  canEdit,
}: {
  projectId: string
  environments: Environment[]
  deploymentType: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    serverIp: '', serverPort: '', url: '', uncPath: '', notes: '',
  })

  const usedTypes = new Set(environments.map((e) => e.type))
  const availableTypes = ['DEV', 'STAGING', 'PRODUCTION'].filter((t) => !usedTypes.has(t))

  const showUrl = deploymentType === 'WEB' || deploymentType === 'MOBILE'
  const showIpPort = deploymentType === 'WEB' || deploymentType === 'SERVICE' || deploymentType === 'DESKTOP'
  const showUncPath = deploymentType === 'DESKTOP'

  const resetForm = () => setForm({ serverIp: '', serverPort: '', url: '', uncPath: '', notes: '' })

  const startEdit = (env: Environment) => {
    setEditingId(env.id)
    setForm({
      serverIp: env.serverIp ?? '',
      serverPort: env.serverPort?.toString() ?? '',
      url: env.url ?? '',
      uncPath: env.uncPath ?? '',
      notes: env.notes ?? '',
    })
    setError(null)
  }

  const handleAdd = () => {
    if (!addingType) return
    setError(null)
    startTransition(async () => {
      const result = await createEnvironment({
        projectId,
        type: addingType as 'DEV' | 'STAGING' | 'PRODUCTION',
        serverIp: form.serverIp || undefined,
        serverPort: form.serverPort ? parseInt(form.serverPort, 10) : undefined,
        url: form.url || undefined,
        uncPath: form.uncPath || undefined,
        notes: form.notes || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAddingType(null)
      resetForm()
      router.refresh()
    })
  }

  const handleUpdate = (envId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await updateEnvironment({
        id: envId,
        projectId,
        serverIp: form.serverIp || undefined,
        serverPort: form.serverPort ? parseInt(form.serverPort, 10) : undefined,
        url: form.url || undefined,
        uncPath: form.uncPath || undefined,
        notes: form.notes || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      resetForm()
      router.refresh()
    })
  }

  const handleDelete = (envId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteEnvironment(envId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  const EnvFormFields = () => (
    <div className="grid md:grid-cols-2 gap-3 mt-3">
      {showIpPort && (
        <>
          <div>
            <label className="block text-[10px] font-medium mb-1" style={labelStyle}>IP del servidor</label>
            <input
              type="text"
              value={form.serverIp}
              onChange={(e) => setForm((f) => ({ ...f, serverIp: e.target.value }))}
              placeholder="192.168.1.100"
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Puerto</label>
            <input
              type="number"
              value={form.serverPort}
              onChange={(e) => setForm((f) => ({ ...f, serverPort: e.target.value }))}
              placeholder="8080"
              min={1}
              max={65535}
              className={inputCls}
              style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
            />
          </div>
        </>
      )}
      {showUrl && (
        <div className={showIpPort ? 'md:col-span-2' : ''}>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://sistema.ejemplo.com"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      )}
      {showUncPath && (
        <div className="md:col-span-2">
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Ruta UNC</label>
          <input
            type="text"
            value={form.uncPath}
            onChange={(e) => setForm((f) => ({ ...f, uncPath: e.target.value }))}
            placeholder="\\servidor\aplicaciones\sistema"
            className={inputCls}
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
          />
        </div>
      )}
      <div className="md:col-span-2">
        <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Notas</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Observaciones sobre este ambiente..."
          className={inputCls}
          style={inputStyle}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <InlineError error={error} />

      {environments.length === 0 && addingType === null && (
        <EmptyState message="No hay ambientes configurados. Agrega DEV, STAGING o PRODUCTION." />
      )}

      {/* Existing environments */}
      {environments.map((env) => {
        const meta = ENV_META[env.type] ?? { label: env.type, color: 'var(--foreground-muted)' }
        const isEditing = editingId === env.id

        return (
          <div
            key={env.id}
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{
                borderColor: 'var(--border)',
                borderLeft: `3px solid ${meta.color}`,
              }}
            >
              <span
                className="text-xs font-heading font-semibold uppercase tracking-widest"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
              {canEdit && (
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdate(env.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Guardar
                      </button>
                      <IconBtn onClick={() => { setEditingId(null); resetForm() }} title="Cancelar">
                        <X size={13} />
                      </IconBtn>
                    </>
                  ) : (
                    <>
                      <IconBtn onClick={() => startEdit(env)} title="Editar">
                        <Pencil size={13} />
                      </IconBtn>
                      <IconBtn onClick={() => handleDelete(env.id)} danger title="Eliminar" disabled={isPending}>
                        <Trash2 size={13} />
                      </IconBtn>
                    </>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="px-4 pb-4">
                <EnvFormFields />
              </div>
            ) : (
              <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-1">
                {env.serverIp && (
                  <span className="text-xs font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                    {env.serverIp}{env.serverPort ? `:${env.serverPort}` : ''}
                  </span>
                )}
                {env.url && (
                  <a
                    href={env.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: 'var(--accent-cyan)' }}
                  >
                    <ExternalLink size={11} />
                    {env.url}
                  </a>
                )}
                {env.uncPath && (
                  <span className="text-xs font-mono" style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-jetbrains)' }}>
                    {env.uncPath}
                  </span>
                )}
                {env.notes && (
                  <span className="text-xs italic" style={{ color: 'var(--foreground-muted)' }}>
                    {env.notes}
                  </span>
                )}
                {!env.serverIp && !env.url && !env.uncPath && !env.notes && (
                  <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin detalles configurados</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add new environment */}
      {canEdit && (
        <>
          {addingType === null ? (
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => {
                const meta = ENV_META[type] ?? { label: type, color: 'var(--accent-cyan)' }
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setAddingType(type); setError(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                    style={{
                      color: meta.color,
                      background: `${meta.color}14`,
                      border: `1px solid ${meta.color}30`,
                    }}
                  >
                    <Plus size={11} />
                    Agregar {meta.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div
              className="rounded overflow-hidden"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{
                  borderColor: 'var(--border)',
                  borderLeft: `3px solid ${ENV_META[addingType]?.color ?? 'var(--accent-cyan)'}`,
                }}
              >
                <span className="text-xs font-heading font-semibold uppercase tracking-widest" style={{ color: ENV_META[addingType]?.color }}>
                  Nuevo: {ENV_META[addingType]?.label ?? addingType}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isPending}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {isPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    Crear
                  </button>
                  <IconBtn onClick={() => { setAddingType(null); resetForm(); setError(null) }} title="Cancelar">
                    <X size={13} />
                  </IconBtn>
                </div>
              </div>
              <div className="px-4 pb-4">
                <EnvFormFields />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Tech Stack ──────────────────────────────────────────────────────────

function TechStackTab({
  projectId,
  techStack,
  canEdit,
}: {
  projectId: string
  techStack: TechStackItem[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ category: 'LANGUAGE', name: '', version: '' })

  const handleAdd = () => {
    if (!newItem.name.trim()) { setError('El nombre es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await addTechStack({
        projectId,
        category: newItem.category as 'LANGUAGE' | 'FRAMEWORK' | 'DATABASE_ENGINE' | 'TOOL' | 'OTHER',
        name: newItem.name.trim(),
        version: newItem.version.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setNewItem({ category: 'LANGUAGE', name: '', version: '' })
      router.refresh()
    })
  }

  const handleRemove = (techId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await removeTechStack(techId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  const byCategory: Record<string, TechStackItem[]> = {}
  for (const tech of techStack) {
    const cat = tech.category
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat]!.push(tech)
  }

  return (
    <div className="space-y-4">
      <InlineError error={error} />

      {techStack.length === 0 && !adding && (
        <EmptyState message="No hay tecnologías registradas para este proyecto." />
      )}

      {/* Grouped by category */}
      {Object.entries(byCategory).map(([cat, items]) => {
        const catLabel = TECH_CATEGORIES.find((c) => c.value === cat)?.label ?? cat
        return (
          <div key={cat}>
            <p className="text-[10px] font-heading font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--foreground-dim)' }}>
              {catLabel}
            </p>
            <div className="space-y-1">
              {items.map((tech) => (
                <div
                  key={tech.id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {tech.name}
                    </span>
                    {tech.version && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--foreground-muted)',
                          fontFamily: 'var(--font-jetbrains)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {tech.version}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <IconBtn onClick={() => handleRemove(tech.id)} danger title="Eliminar" disabled={isPending}>
                      <Trash2 size={13} />
                    </IconBtn>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Add form */}
      {canEdit && (
        <>
          {adding ? (
            <div
              className="rounded p-4 space-y-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                Nueva tecnología
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Categoría</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem((f) => ({ ...f, category: e.target.value }))}
                    className={inputCls + ' cursor-pointer'}
                    style={inputStyle}
                  >
                    {TECH_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Nombre *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: React, PostgreSQL"
                    className={inputCls}
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Versión</label>
                  <input
                    type="text"
                    value={newItem.version}
                    onChange={(e) => setNewItem((f) => ({ ...f, version: e.target.value }))}
                    placeholder="Ej: 18.2.0"
                    className={inputCls}
                    style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setError(null) }}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                  style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <AddButton onClick={() => setAdding(true)}>Agregar tecnología</AddButton>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Departments ─────────────────────────────────────────────────────────

function DepartmentsTab({
  projectId,
  departmentUsages,
  departments,
  canEdit,
}: {
  projectId: string
  departmentUsages: DepartmentUsage[]
  departments: Department[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ departmentId: '', estimatedUsers: '', contactPerson: '' })
  const [editForm, setEditForm] = useState({ estimatedUsers: '', contactPerson: '' })

  const usedIds = new Set(departmentUsages.map((d) => d.department.id))
  const availableDepts = departments.filter((d) => !usedIds.has(d.id))

  const startEdit = (usage: DepartmentUsage) => {
    setEditingId(usage.id)
    setEditForm({
      estimatedUsers: usage.estimatedUsers?.toString() ?? '',
      contactPerson: usage.contactPerson ?? '',
    })
    setError(null)
  }

  const handleAdd = () => {
    if (!newItem.departmentId) { setError('Selecciona un departamento'); return }
    setError(null)
    startTransition(async () => {
      const result = await addDepartmentUsage({
        projectId,
        departmentId: newItem.departmentId,
        estimatedUsers: newItem.estimatedUsers ? parseInt(newItem.estimatedUsers, 10) : undefined,
        contactPerson: newItem.contactPerson || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setNewItem({ departmentId: '', estimatedUsers: '', contactPerson: '' })
      router.refresh()
    })
  }

  const handleUpdate = (usageId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await updateDepartmentUsage({
        id: usageId,
        projectId,
        estimatedUsers: editForm.estimatedUsers ? parseInt(editForm.estimatedUsers, 10) : undefined,
        contactPerson: editForm.contactPerson || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  const handleRemove = (usageId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await removeDepartmentUsage(usageId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <InlineError error={error} />

      {departmentUsages.length === 0 && !adding && (
        <EmptyState message="No hay departamentos asociados a este proyecto." />
      )}

      {departmentUsages.map((usage) => {
        const isEditing = editingId === usage.id
        return (
          <div
            key={usage.id}
            className="rounded overflow-hidden"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {usage.department.name}
                </p>
                <p
                  className="text-[10px] font-mono"
                  style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
                >
                  {usage.department.code}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdate(usage.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                      >
                        {isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Guardar
                      </button>
                      <IconBtn onClick={() => setEditingId(null)} title="Cancelar">
                        <X size={13} />
                      </IconBtn>
                    </>
                  ) : (
                    <>
                      <IconBtn onClick={() => startEdit(usage)} title="Editar">
                        <Pencil size={13} />
                      </IconBtn>
                      <IconBtn onClick={() => handleRemove(usage.id)} danger disabled={isPending} title="Eliminar">
                        <Trash2 size={13} />
                      </IconBtn>
                    </>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="px-4 pb-4 pt-3 grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Usuarios estimados</label>
                  <input
                    type="number"
                    value={editForm.estimatedUsers}
                    onChange={(e) => setEditForm((f) => ({ ...f, estimatedUsers: e.target.value }))}
                    placeholder="Ej: 25"
                    min={1}
                    className={inputCls}
                    style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Persona de contacto</label>
                  <input
                    type="text"
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm((f) => ({ ...f, contactPerson: e.target.value }))}
                    placeholder="Nombre del contacto"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 flex gap-6">
                {usage.estimatedUsers != null && (
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    <span className="font-mono font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-jetbrains)' }}>
                      {usage.estimatedUsers}
                    </span>{' '}usuarios
                  </span>
                )}
                {usage.contactPerson && (
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Contacto: <span style={{ color: 'var(--foreground)' }}>{usage.contactPerson}</span>
                  </span>
                )}
                {!usage.estimatedUsers && !usage.contactPerson && (
                  <span className="text-xs" style={{ color: 'var(--foreground-dim)' }}>Sin detalles</span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {canEdit && (
        <>
          {adding ? (
            <div
              className="rounded p-4 space-y-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
                Asociar departamento
              </p>
              {availableDepts.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Todos los departamentos ya están asociados.
                </p>
              ) : (
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Departamento *</label>
                    <select
                      value={newItem.departmentId}
                      onChange={(e) => setNewItem((f) => ({ ...f, departmentId: e.target.value }))}
                      className={inputCls + ' cursor-pointer'}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar...</option>
                      {availableDepts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Usuarios estimados</label>
                    <input
                      type="number"
                      value={newItem.estimatedUsers}
                      onChange={(e) => setNewItem((f) => ({ ...f, estimatedUsers: e.target.value }))}
                      placeholder="25"
                      min={1}
                      className={inputCls}
                      style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Contacto</label>
                    <input
                      type="text"
                      value={newItem.contactPerson}
                      onChange={(e) => setNewItem((f) => ({ ...f, contactPerson: e.target.value }))}
                      placeholder="Nombre del contacto"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isPending || availableDepts.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  Asociar
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setError(null) }}
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <AddButton onClick={() => setAdding(true)} disabled={availableDepts.length === 0}>
              Asociar departamento
            </AddButton>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Project Roles ───────────────────────────────────────────────────────

function ProjectRolesTab({
  projectId,
  projectRoles,
  canEdit,
}: {
  projectId: string
  projectRoles: ProjectRole[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState({ roleName: '', description: '' })
  const [editRole, setEditRole] = useState({ roleName: '', description: '' })

  const startEdit = (role: ProjectRole) => {
    setEditingId(role.id)
    setEditRole({ roleName: role.roleName, description: role.description ?? '' })
    setAdding(false)
    setError(null)
  }

  const handleAdd = () => {
    if (!newRole.roleName.trim()) { setError('El nombre del rol es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await createProjectRole({
        projectId,
        roleName: newRole.roleName.trim(),
        description: newRole.description.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setNewRole({ roleName: '', description: '' })
      router.refresh()
    })
  }

  const handleUpdate = (roleId: string) => {
    if (!editRole.roleName.trim()) { setError('El nombre del rol es requerido'); return }
    setError(null)
    startTransition(async () => {
      const result = await updateProjectRole({
        id: roleId,
        projectId,
        roleName: editRole.roleName.trim(),
        description: editRole.description.trim() || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setEditingId(null)
      router.refresh()
    })
  }

  const handleDelete = (roleId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteProjectRole(roleId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
        Roles internos del proyecto — personas o responsabilidades específicas dentro del sistema (no son roles del sistema).
      </p>
      <InlineError error={error} />

      {projectRoles.length === 0 && !adding && (
        <EmptyState message="No hay roles definidos para este proyecto." />
      )}

      {projectRoles.map((role) => {
        const isEditing = editingId === role.id
        return (
          <div
            key={role.id}
            className="rounded p-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {isEditing ? (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Nombre del rol *</label>
                    <input
                      type="text"
                      value={editRole.roleName}
                      onChange={(e) => setEditRole((f) => ({ ...f, roleName: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Descripción</label>
                    <input
                      type="text"
                      value={editRole.description}
                      onChange={(e) => setEditRole((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Qué hace este rol..."
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(role.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setError(null) }}
                    className="px-3 py-1.5 rounded text-xs font-medium"
                    style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {role.roleName}
                  </p>
                  {role.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
                      {role.description}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn onClick={() => startEdit(role)} title="Editar">
                      <Pencil size={13} />
                    </IconBtn>
                    <IconBtn onClick={() => handleDelete(role.id)} danger disabled={isPending} title="Eliminar">
                      <Trash2 size={13} />
                    </IconBtn>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {canEdit && !adding && (
        <AddButton onClick={() => { setAdding(true); setEditingId(null); setError(null) }}>
          Agregar rol
        </AddButton>
      )}

      {canEdit && adding && (
        <div
          className="rounded p-4 space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>Nuevo rol</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Nombre del rol *</label>
              <input
                type="text"
                value={newRole.roleName}
                onChange={(e) => setNewRole((f) => ({ ...f, roleName: e.target.value }))}
                placeholder="Ej: Administrador del sistema"
                className={inputCls}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Descripción</label>
              <input
                type="text"
                value={newRole.description}
                onChange={(e) => setNewRole((f) => ({ ...f, description: e.target.value }))}
                placeholder="Qué hace este rol en el sistema..."
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Crear rol
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Relations ───────────────────────────────────────────────────────────

function RelationsTab({
  projectId,
  sourceRelations,
  targetRelations,
  allProjects,
  canEdit,
}: {
  projectId: string
  sourceRelations: RelationItem[]
  targetRelations: RelationItem[]
  allProjects: ProjectRef[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newRelation, setNewRelation] = useState({ targetProjectId: '', type: 'DEPENDS_ON', notes: '' })

  const handleAdd = () => {
    if (!newRelation.targetProjectId) { setError('Selecciona un proyecto destino'); return }
    setError(null)
    startTransition(async () => {
      const result = await createProjectRelation({
        sourceProjectId: projectId,
        targetProjectId: newRelation.targetProjectId,
        type: newRelation.type as 'DEPENDS_ON' | 'EXTENDS' | 'REPLACES' | 'SHARES_DATABASE',
        notes: newRelation.notes || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setAdding(false)
      setNewRelation({ targetProjectId: '', type: 'DEPENDS_ON', notes: '' })
      router.refresh()
    })
  }

  const handleDelete = (relationId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteProjectRelation(relationId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  const RelationRow = ({
    relation,
    linkedProject,
    canDelete,
  }: {
    relation: RelationItem
    linkedProject: { id: string; name: string; code: string; status: string }
    canDelete: boolean
  }) => (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="flex-1 min-w-0">
        <Link
          href={`/projects/${linkedProject.id}`}
          className="flex items-center gap-2 hover:underline group"
          style={{ color: 'var(--foreground)' }}
        >
          <span
            className="text-xs font-mono shrink-0"
            style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {linkedProject.code}
          </span>
          <span className="text-sm font-medium truncate">{linkedProject.name}</span>
        </Link>
        {relation.notes && (
          <p className="text-xs mt-0.5 ml-0 truncate" style={{ color: 'var(--foreground-muted)' }}>
            {relation.notes}
          </p>
        )}
      </div>
      <span
        className="text-[10px] shrink-0 font-mono"
        style={{ color: STATUS_COLORS[linkedProject.status] ?? 'var(--foreground-dim)' }}
      >
        ● {linkedProject.status}
      </span>
      {canEdit && canDelete && (
        <IconBtn onClick={() => handleDelete(relation.id)} danger disabled={isPending} title="Eliminar relación">
          <Trash2 size={13} />
        </IconBtn>
      )}
    </div>
  )

  const totalCount = sourceRelations.length + targetRelations.length

  // Group by relation type
  const outByType = RELATION_TYPES.reduce<Record<string, RelationItem[]>>((acc, t) => {
    acc[t.value] = sourceRelations.filter((r) => r.type === t.value)
    return acc
  }, {})
  const inByType = RELATION_TYPES.reduce<Record<string, RelationItem[]>>((acc, t) => {
    acc[t.value] = targetRelations.filter((r) => r.type === t.value)
    return acc
  }, {})

  const activeTypes = RELATION_TYPES.filter(
    (t) => (outByType[t.value]?.length ?? 0) > 0 || (inByType[t.value]?.length ?? 0) > 0
  )

  return (
    <div className="space-y-4">
      <InlineError error={error} />

      {totalCount === 0 && !adding && (
        <EmptyState message="No hay relaciones definidas para este proyecto." />
      )}

      {activeTypes.map((t) => {
        const cfg = RELATION_TYPE_CONFIG[t.value]!
        const outs = outByType[t.value] ?? []
        const ins  = inByType[t.value]  ?? []
        return (
          <div
            key={t.value}
            className="rounded overflow-hidden"
            style={{ border: `1px solid ${cfg.border}` }}
          >
            {/* Type header */}
            <div
              className="px-4 py-2.5 flex items-center gap-3"
              style={{ background: cfg.bg }}
            >
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {t.value.replace('_', ' ')}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-[11px] ml-2" style={{ color: 'var(--foreground-dim)' }}>{cfg.description}</span>
              </div>
              <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--foreground-dim)' }}>
                {outs.length + ins.length} relación{outs.length + ins.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Relations */}
            <div className="p-3 space-y-3" style={{ background: 'var(--surface)' }}>
              {outs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-dim)' }}>
                    {cfg.outLabel}
                  </p>
                  {outs.map((r) => r.targetProject && (
                    <RelationRow key={r.id} relation={r} linkedProject={r.targetProject} canDelete={true} />
                  ))}
                </div>
              )}
              {ins.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-dim)' }}>
                    {cfg.inLabel}
                  </p>
                  {ins.map((r) => r.sourceProject && (
                    <RelationRow key={r.id} relation={r} linkedProject={r.sourceProject} canDelete={false} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {canEdit && !adding && (
        <AddButton onClick={() => setAdding(true)}>Agregar relación</AddButton>
      )}

      {canEdit && adding && (
        <div
          className="rounded p-4 space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
            Nueva relación
          </p>
          {/* Type description hint */}
          {newRelation.type && RELATION_TYPE_CONFIG[newRelation.type] && (
            <p
              className="text-[11px] px-3 py-2 rounded"
              style={{
                background: RELATION_TYPE_CONFIG[newRelation.type]!.bg,
                color: RELATION_TYPE_CONFIG[newRelation.type]!.color,
                border: `1px solid ${RELATION_TYPE_CONFIG[newRelation.type]!.border}`,
              }}
            >
              {RELATION_TYPE_CONFIG[newRelation.type]!.description}
            </p>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Tipo de relación *</label>
              <select
                value={newRelation.type}
                onChange={(e) => setNewRelation((f) => ({ ...f, type: e.target.value }))}
                className={inputCls + ' cursor-pointer'}
                style={inputStyle}
              >
                {RELATION_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Proyecto destino *</label>
              <select
                value={newRelation.targetProjectId}
                onChange={(e) => setNewRelation((f) => ({ ...f, targetProjectId: e.target.value }))}
                className={inputCls + ' cursor-pointer'}
                style={inputStyle}
              >
                <option value="">Seleccionar proyecto...</option>
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Notas (opcional)</label>
              <input
                type="text"
                value={newRelation.notes}
                onChange={(e) => setNewRelation((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Descripción de la relación..."
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Crear relación
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null) }}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Changes ─────────────────────────────────────────────────────────────

const CR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED:    { label: 'Solicitado',  color: '#64748b' },
  UNDER_REVIEW: { label: 'En Revisión', color: '#3b82f6' },
  APPROVED:     { label: 'Aprobado',    color: '#10b981' },
  REJECTED:     { label: 'Rechazado',   color: '#ef4444' },
  IN_PROGRESS:  { label: 'En Progreso', color: '#f59e0b' },
  COMPLETED:    { label: 'Completado',  color: '#059669' },
  CANCELLED:    { label: 'Cancelado',   color: '#475569' },
}

const CR_PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CRITICAL: { label: 'Crítica',  color: '#ef4444', icon: <Flame         size={10} /> },
  HIGH:     { label: 'Alta',     color: '#f59e0b', icon: <AlertTriangle size={10} /> },
  MEDIUM:   { label: 'Media',    color: '#3b82f6', icon: <ArrowDown     size={10} /> },
  LOW:      { label: 'Baja',     color: '#64748b', icon: <Minus         size={10} /> },
}

const CR_TYPE_LABELS: Record<string, string> = {
  NEW_FEATURE: 'Nueva Función', MODIFICATION: 'Modificación', BUG_FIX: 'Corrección',
  DATA_CORRECTION: 'Datos', REPORT: 'Reporte', VISUAL_CHANGE: 'Visual', OTHER: 'Otro',
}

function ChangesTab({
  projectId,
  changeRequests,
  canManage,
}: {
  projectId:      string
  changeRequests: ChangeRequestSummary[]
  canManage:      boolean
}) {
  // Status distribution
  const byStatus = changeRequests.reduce<Record<string, number>>((acc, cr) => {
    acc[cr.status] = (acc[cr.status] ?? 0) + 1
    return acc
  }, {})

  const activeStatuses = Object.entries(CR_STATUS_CONFIG).filter(([s]) => (byStatus[s] ?? 0) > 0)

  return (
    <div className="space-y-4">
      {/* Header with link to full view */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitPullRequest size={14} style={{ color: 'var(--accent-cyan)' }} />
          <h3
            className="text-xs font-heading font-semibold uppercase tracking-[0.15em]"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Solicitudes de Cambio
          </h3>
        </div>
        <Link
          href={`/projects/${projectId}/changes`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
          style={{
            color:      'var(--accent-cyan)',
            background: 'var(--accent-cyan-dim)',
            border:     '1px solid rgba(6,182,212,0.2)',
          }}
        >
          <GitPullRequest size={11} />
          Ver tablero Kanban
          <ExternalLink size={10} />
        </Link>
      </div>

      {changeRequests.length === 0 ? (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <GitPullRequest size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Sin solicitudes de cambio
          </p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--foreground-dim)' }}>
            Las solicitudes registran peticiones de mejoras, correcciones o nuevas funciones.
          </p>
          <Link
            href={`/projects/${projectId}/changes`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              color:      'var(--accent-cyan)',
              background: 'var(--accent-cyan-dim)',
              border:     '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <Plus size={11} /> Crear primera solicitud
          </Link>
        </div>
      ) : (
        <>
          {/* Status distribution */}
          {activeStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeStatuses.map(([status, cfg]) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded"
                  style={{ background: `${cfg.color}11`, border: `1px solid ${cfg.color}33` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: cfg.color }}
                  />
                  <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>
                    {byStatus[status]}
                  </span>
                  <span className="text-[10px]" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recent CRs list */}
          <div className="space-y-1.5">
            {changeRequests
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 12)
              .map((cr) => {
                const statusCfg = CR_STATUS_CONFIG[cr.status]
                const prioCfg   = CR_PRIORITY_CONFIG[cr.priority]
                return (
                  <div
                    key={cr.id}
                    className="flex items-center gap-3 px-3 py-2 rounded"
                    style={{
                      background:  'var(--surface-2)',
                      border:      '1px solid var(--border)',
                      borderLeft:  `3px solid ${prioCfg?.color ?? '#64748b'}`,
                    }}
                  >
                    {/* Status dot */}
                    {statusCfg && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: statusCfg.color }}
                        title={statusCfg.label}
                      />
                    )}

                    {/* Title */}
                    <p className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                      {cr.title}
                    </p>

                    {/* Type */}
                    <span
                      className="text-[9px] font-mono shrink-0 px-1.5 py-0.5 rounded hidden sm:inline-block"
                      style={{ background: 'var(--surface)', color: 'var(--foreground-dim)', border: '1px solid var(--border)', fontFamily: 'var(--font-jetbrains)' }}
                    >
                      {CR_TYPE_LABELS[cr.type] ?? cr.type}
                    </span>

                    {/* Status badge */}
                    {statusCfg && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 hidden md:inline-block"
                        style={{ background: `${statusCfg.color}22`, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                    )}

                    {/* Priority */}
                    {prioCfg && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-semibold shrink-0"
                        style={{ color: prioCfg.color }}
                      >
                        {prioCfg.icon}
                      </span>
                    )}

                    {/* Requester */}
                    <span className="text-[9px] shrink-0 hidden lg:inline" style={{ color: 'var(--foreground-dim)' }}>
                      {cr.requesterName}
                    </span>

                    {/* Assignee avatar */}
                    {cr.assignedTo && (
                      <span
                        className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}
                        title={`${cr.assignedTo.firstName} ${cr.assignedTo.lastName}`}
                      >
                        {cr.assignedTo.firstName[0]}{cr.assignedTo.lastName[0]}
                      </span>
                    )}
                  </div>
                )
              })}
          </div>

          {changeRequests.length > 12 && (
            <p className="text-[10px] text-center" style={{ color: 'var(--foreground-dim)' }}>
              Mostrando 12 de {changeRequests.length} —{' '}
              <Link href={`/projects/${projectId}/changes`} className="underline" style={{ color: 'var(--accent-cyan)' }}>
                ver todas
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main tabs component ──────────────────────────────────────────────────────

export function ProjectDetailTabs({
  project,
  environments,
  techStack,
  departmentUsages,
  projectRoles,
  sourceRelations,
  targetRelations,
  departments,
  allProjects,
  credentials,
  documents,
  changeRequests,
  canEdit,
  canManageChanges,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('general')

  // Badge counts
  const counts: Partial<Record<TabKey, number>> = {
    environments: environments.length,
    techstack:    techStack.length,
    departments:  departmentUsages.length,
    roles:        projectRoles.length,
    relations:    sourceRelations.length + targetRelations.length,
    credentials:  credentials.length,
    documents:    documents.length,
    changes:      changeRequests.length,
  }

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex overflow-x-auto rounded-t"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none' }}
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key
          const count = counts[tab.key]
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-all relative"
              style={{
                color: isActive ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                borderRight: idx < TABS.length - 1 ? '1px solid var(--border)' : 'none',
                borderBottom: isActive ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--foreground-dim)' }}>
                {tab.icon}
              </span>
              <span className="font-heading font-semibold uppercase tracking-wider text-[10px]">
                {tab.label}
              </span>
              {count !== undefined && count > 0 && (
                <span
                  className="font-mono text-[10px] px-1 py-0.5 rounded"
                  style={{
                    background: isActive ? 'rgba(6,182,212,0.2)' : 'var(--surface-2)',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--foreground-dim)',
                    fontFamily: 'var(--font-jetbrains)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div
        className="rounded-b p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {activeTab === 'general' && <GeneralTab project={project} />}

        {activeTab === 'environments' && (
          <EnvironmentsTab
            projectId={project.id}
            environments={environments}
            deploymentType={project.deploymentType}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'techstack' && (
          <TechStackTab
            projectId={project.id}
            techStack={techStack}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'departments' && (
          <DepartmentsTab
            projectId={project.id}
            departmentUsages={departmentUsages}
            departments={departments}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'roles' && (
          <ProjectRolesTab
            projectId={project.id}
            projectRoles={projectRoles}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'relations' && (
          <RelationsTab
            projectId={project.id}
            sourceRelations={sourceRelations}
            targetRelations={targetRelations}
            allProjects={allProjects}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'credentials' && (
          <CredentialsTab
            projectId={project.id}
            credentials={credentials}
            environments={environments.map((e) => ({ id: e.id, type: e.type }))}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab
            projectId={project.id}
            documents={documents}
            canEdit={canEdit}
          />
        )}

        {activeTab === 'changes' && (
          <ChangesTab
            projectId={project.id}
            changeRequests={changeRequests}
            canManage={canManageChanges}
          />
        )}
      </div>
    </div>
  )
}
