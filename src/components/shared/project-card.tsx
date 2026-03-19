'use client'

import Link from 'next/link'
import { ExternalLink, Eye, User } from 'lucide-react'
import { BadgeControlLevel, ControlLevelStripe } from './badge-control-level'
import { BadgeStatus } from './badge-status'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectCardData {
  id: string
  name: string
  code: string
  status: string
  controlLevel: string
  deploymentType: string
  priority: string
  responsibleUser: { firstName: string; lastName: string } | null
  techStack: Array<{ name: string; category: string }>
  productionUrl: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
  LANGUAGE:        '#3b82f6',
  FRAMEWORK:       '#8b5cf6',
  DATABASE_ENGINE: '#10b981',
  TOOL:            '#f59e0b',
  OTHER:           '#475569',
}

const DEPLOYMENT_LABELS: Record<string, string> = {
  WEB:     'Web',
  DESKTOP: 'Desktop',
  SERVICE: 'Servicio',
  MOBILE:  'Móvil',
}

const PRIORITY_URGENT: Record<string, string | undefined> = {
  CRITICAL: '⚠ CRÍTICO',
  HIGH:     'ALTO',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const urgentLabel = PRIORITY_URGENT[project.priority]

  return (
    <div
      className="relative flex flex-col rounded overflow-hidden transition-all duration-150 hover:border-[var(--border-bright)] group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Control level color stripe */}
      <ControlLevelStripe level={project.controlLevel} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Code + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className="block text-[10px] mb-0.5 font-mono"
              style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-jetbrains)' }}
            >
              {project.code}
            </span>
            <h3
              className="text-sm font-heading font-semibold uppercase tracking-wide leading-tight line-clamp-2"
              style={{ color: 'var(--foreground)' }}
              title={project.name}
            >
              {project.name}
            </h3>
          </div>
          <BadgeControlLevel level={project.controlLevel} size="sm" />
        </div>

        {/* Status + deployment + priority */}
        <div className="flex items-center gap-2 flex-wrap">
          <BadgeStatus status={project.status} size="sm" />
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--foreground-muted)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            {DEPLOYMENT_LABELS[project.deploymentType] ?? project.deploymentType}
          </span>
          {urgentLabel && (
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-widest"
              style={{
                color: project.priority === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                background:
                  project.priority === 'CRITICAL'
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(245,158,11,0.08)',
                border:
                  project.priority === 'CRITICAL'
                    ? '1px solid rgba(239,68,68,0.2)'
                    : '1px solid rgba(245,158,11,0.2)',
                fontFamily: 'var(--font-jetbrains)',
              }}
            >
              {urgentLabel}
            </span>
          )}
        </div>

        {/* Tech stack pills */}
        {project.techStack.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.techStack.map((tech, i) => {
              const color = TECH_COLORS[tech.category] ?? '#475569'
              return (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    color,
                    background: `${color}14`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {tech.name}
                </span>
              )
            })}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Responsible */}
        <div className="flex items-center gap-1.5" style={{ color: 'var(--foreground-muted)' }}>
          <User size={11} />
          <span className="text-xs truncate">
            {project.responsibleUser
              ? `${project.responsibleUser.firstName} ${project.responsibleUser.lastName}`
              : 'Sin responsable'}
          </span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {project.productionUrl && (
            <a
              href={project.productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded transition-all"
              style={{
                color: '#10b981',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} />
              Ir al sitio
            </a>
          )}
          <Link
            href={`/projects/${project.id}`}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded transition-all ml-auto"
            style={{
              color: 'var(--accent-cyan)',
              background: 'var(--accent-cyan-dim)',
              border: '1px solid rgba(6,182,212,0.2)',
            }}
          >
            <Eye size={11} />
            Ver detalle
          </Link>
        </div>
      </div>
    </div>
  )
}
