import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { prisma } from '@/lib/prisma'
import {
  Plus, Server, ChevronRight, Key,
  CheckCircle, Wrench, PowerOff, Package,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Servidores' }

// ─── Constants ────────────────────────────────────────────────────────────────

const OS_META: Record<string, { label: string; short: string; color: string }> = {
  WINDOWS_SERVER: { label: 'Windows Server', short: 'WIN', color: '#3b82f6' },
  UBUNTU:         { label: 'Ubuntu',          short: 'UBU', color: '#e95420' },
  CENTOS:         { label: 'CentOS',           short: 'CNT', color: '#932279' },
  DEBIAN:         { label: 'Debian',           short: 'DEB', color: '#d70a53' },
  RHEL:           { label: 'RHEL',             short: 'RHL', color: '#cc0000' },
  OTHER:          { label: 'Otro',             short: 'OTR', color: '#6b7280' },
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  PHYSICAL:  { label: 'Físico',       color: 'var(--foreground-muted)' },
  VIRTUAL:   { label: 'Virtual',      color: 'var(--accent-cyan)'      },
  CONTAINER: { label: 'Contenedor',   color: 'var(--status-purple)'    },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ACTIVE:         { label: 'Activo',       color: 'var(--status-green)',  bg: 'rgba(16,185,129,0.08)',  icon: <CheckCircle size={10} /> },
  MAINTENANCE:    { label: 'Mantenim.',    color: 'var(--status-amber)',  bg: 'rgba(245,158,11,0.08)',  icon: <Wrench size={10} />      },
  INACTIVE:       { label: 'Inactivo',     color: 'var(--status-red)',    bg: 'rgba(239,68,68,0.08)',   icon: <PowerOff size={10} />    },
  DECOMMISSIONED: { label: 'Decomis.',     color: 'var(--foreground-dim)',bg: 'var(--surface-2)',       icon: <PowerOff size={10} />    },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ q?: string; os?: string; type?: string; status?: string; group?: string }>

export default async function ServersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()

  const canView = await resolvePermission(user.id, 'infrastructure.servers', 'view')
  if (!canView) redirect('/infrastructure')

  const canCreate = await resolvePermission(user.id, 'infrastructure.servers', 'create')
  const params    = await searchParams

  const [servers, groups] = await Promise.all([
    prisma.server.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt:      null,
        ...(params.os     && { os:     params.os     as never }),
        ...(params.type   && { type:   params.type   as never }),
        ...(params.status && { status: params.status as never }),
        ...(params.group  && { groupId: params.group }),
        ...(params.q && {
          OR: [
            { hostname:    { contains: params.q, mode: 'insensitive' } },
            { displayName: { contains: params.q, mode: 'insensitive' } },
            { ip:          { contains: params.q, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        group:    { select: { id: true, name: true } },
        _count:   { select: { services: true, credentials: { where: { deletedAt: null } } } },
      },
      orderBy: [{ group: { sortOrder: 'asc' } }, { hostname: 'asc' }],
    }),
    prisma.serverGroup.findMany({
      where:   { organizationId: user.organizationId },
      orderBy: { sortOrder: 'asc' },
      select:  { id: true, name: true, _count: { select: { servers: { where: { deletedAt: null } } } } },
    }),
  ])

  // Group servers by their ServerGroup for tree view
  const ungrouped = servers.filter((s) => !s.groupId)
  const byGroup   = new Map<string, typeof servers>()
  for (const srv of servers.filter((s) => s.groupId)) {
    const arr = byGroup.get(srv.groupId!) ?? []
    arr.push(srv)
    byGroup.set(srv.groupId!, arr)
  }

  const hasFilters = !!(params.q || params.os || params.type || params.status || params.group)

  function ServerRow({ srv }: { srv: typeof servers[0] }) {
    const os     = OS_META[srv.os]     ?? OS_META.OTHER!
    const type   = TYPE_META[srv.type] ?? TYPE_META.PHYSICAL!
    const status = STATUS_META[srv.status] ?? STATUS_META.INACTIVE!

    return (
      <div
        className="px-5 py-3.5 flex items-center gap-4 transition-colors hover:bg-white/[0.02] group border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* OS badge */}
        <span
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 w-8 text-center"
          style={{
            background: `${os.color}18`, color: os.color,
            border: `1px solid ${os.color}30`, fontFamily: 'var(--font-jetbrains)',
          }}
        >
          {os.short}
        </span>

        {/* Name + IP */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/infrastructure/servers/${srv.id}`}
            className="block text-sm font-medium truncate group-hover:text-[var(--accent-cyan)] transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            {srv.displayName ?? srv.hostname}
          </Link>
          <span
            className="text-[10px] font-mono"
            style={{ color: 'var(--foreground-dim)', fontFamily: 'var(--font-jetbrains)' }}
          >
            {srv.hostname} · {srv.ip}
          </span>
        </div>

        {/* Type */}
        <span className="text-[10px] font-medium hidden sm:block" style={{ color: type.color }}>
          {type.label}
        </span>

        {/* Services */}
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
          <Package size={11} />
          {srv._count.services}
        </span>

        {/* Creds */}
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--foreground-muted)' }}>
          <Key size={11} />
          {srv._count.credentials}
        </span>

        {/* Status */}
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shrink-0"
          style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}30` }}
        >
          {status.icon}
          {status.label}
        </span>

        {/* Link */}
        <Link
          href={`/infrastructure/servers/${srv.id}`}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-all shrink-0"
          style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          Ver <ChevronRight size={10} />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Servidores
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {servers.length} servidor{servers.length !== 1 ? 'es' : ''} registrado{servers.length !== 1 ? 's' : ''}
            {hasFilters && ' (filtrado)'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/infrastructure/servers/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={15} />
            Nuevo Servidor
          </Link>
        )}
      </div>

      <div className="flex gap-5">

        {/* Sidebar: Groups */}
        <div className="w-52 shrink-0 space-y-1">
          <div
            className="rounded p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p
              className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] px-1 mb-2"
              style={{ color: 'var(--foreground-dim)' }}
            >
              Grupos
            </p>

            <Link
              href="/infrastructure/servers"
              className="flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium mb-1"
              style={{
                background: !params.group ? 'var(--accent-glow)' : 'transparent',
                color:      !params.group ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
              }}
            >
              <span>Todos</span>
              <span style={{ color: 'var(--foreground-dim)' }}>{servers.length}</span>
            </Link>

            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/infrastructure/servers?group=${g.id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium mb-0.5"
                style={{
                  background: params.group === g.id ? 'var(--accent-glow)' : 'transparent',
                  color:      params.group === g.id ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                }}
              >
                <span className="truncate">{g.name}</span>
                <span style={{ color: 'var(--foreground-dim)' }}>{g._count.servers}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">

          {/* Filters */}
          <form method="get" className="flex flex-wrap gap-2 mb-4">
            {params.group && <input type="hidden" name="group" value={params.group} />}
            <input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Buscar hostname o IP..."
              className="px-3 py-1.5 rounded text-sm flex-1 min-w-[180px] outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            <select
              name="os"
              defaultValue={params.os ?? ''}
              className="px-3 py-1.5 rounded text-sm cursor-pointer outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Todos los OS</option>
              {Object.entries(OS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={params.type ?? ''}
              className="px-3 py-1.5 rounded text-sm cursor-pointer outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={params.status ?? ''}
              className="px-3 py-1.5 rounded text-sm cursor-pointer outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Filtrar
            </button>
            {hasFilters && (
              <Link
                href="/infrastructure/servers"
                className="px-3 py-1.5 rounded text-sm"
                style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
              >
                Limpiar
              </Link>
            )}
          </form>

          {/* Server list */}
          {servers.length === 0 ? (
            <div
              className="rounded p-12 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Server size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--foreground-muted)' }} />
              <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
                {hasFilters ? 'Sin resultados para los filtros seleccionados' : 'No hay servidores registrados aún'}
              </p>
              {!hasFilters && canCreate && (
                <Link
                  href="/infrastructure/servers/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Plus size={14} /> Registrar primer servidor
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouped view */}
              {!params.group && groups.length > 0 ? (
                <>
                  {groups.map((g) => {
                    const groupServers = byGroup.get(g.id) ?? []
                    if (groupServers.length === 0) return null
                    return (
                      <div
                        key={g.id}
                        className="rounded overflow-hidden"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        <div
                          className="px-5 py-3 flex items-center gap-2"
                          style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
                        >
                          <Server size={13} style={{ color: 'var(--accent-cyan)' }} />
                          <span
                            className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
                            style={{ color: 'var(--foreground-muted)' }}
                          >
                            {g.name}
                          </span>
                          <span
                            className="text-[10px] ml-2 px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)' }}
                          >
                            {groupServers.length}
                          </span>
                        </div>
                        {groupServers.map((srv) => <ServerRow key={srv.id} srv={srv} />)}
                      </div>
                    )
                  })}
                  {ungrouped.length > 0 && (
                    <div
                      className="rounded overflow-hidden"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="px-5 py-3 flex items-center gap-2"
                        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
                      >
                        <span
                          className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em]"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          Sin grupo
                        </span>
                      </div>
                      {ungrouped.map((srv) => <ServerRow key={srv.id} srv={srv} />)}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="rounded overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {servers.map((srv) => <ServerRow key={srv.id} srv={srv} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
