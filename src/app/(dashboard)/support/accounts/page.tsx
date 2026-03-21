import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { Plus, User, ShieldAlert } from 'lucide-react'

export const metadata: Metadata = { title: 'Cuentas de Usuario' }

const TYPE_LABELS: Record<string, string> = {
  DOMAIN_AD: 'Dominio AD', EMAIL: 'Correo', VPN: 'VPN', SYSTEM_ACCESS: 'Acceso sistema', OTHER: 'Otro',
}
const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE:   { label: 'Activa',         color: 'var(--status-green)' },
  DISABLED: { label: 'Deshabilitada',  color: 'var(--status-amber)' },
  EXPIRED:  { label: 'Expirada',       color: 'var(--status-red)'   },
}

export default async function AccountsPage() {
  const user     = await getCurrentUser()
  const accounts = await prisma.userAccount.findMany({
    where:   { organizationId: user.organizationId },
    include: { department: { select: { name: true } } },
    orderBy: { fullName: 'asc' },
  })

  const now = new Date()
  const expired = accounts.filter(a =>
    a.status === 'ACTIVE' && a.expirationDate && a.expirationDate < now
  ).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Cuentas de Usuario
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            {accounts.length} cuentas registradas{expired > 0 ? ` · ${expired} por expirar` : ''}
          </p>
        </div>
        <Link href="/support/accounts/new"
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={15} /> Nueva Cuenta
        </Link>
      </div>

      {expired > 0 && (
        <div className="flex items-center gap-3 p-4 rounded"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <ShieldAlert size={16} style={{ color: 'var(--status-red)' }} />
          <p className="text-sm" style={{ color: 'var(--status-red)' }}>
            {expired} cuenta{expired !== 1 ? 's' : ''} con fecha de expiración vencida
          </p>
        </div>
      )}

      <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {accounts.length === 0 ? (
          <div className="py-16 text-center" style={{ background: 'var(--surface)' }}>
            <User size={24} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--foreground-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--foreground-dim)' }}>No hay cuentas registradas.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'Usuario', 'Dominio', 'Tipo', 'Dependencia', 'Estado', 'Expira'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-heading font-semibold uppercase tracking-[0.12em]"
                      style={{ color: 'var(--foreground-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const sm = STATUS_META[a.status] ?? STATUS_META['ACTIVE']!
                const isExpiredWarn = a.status === 'ACTIVE' && a.expirationDate && a.expirationDate < now
                return (
                  <tr key={a.id} className="hover:bg-white/[0.01] transition-colors"
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--foreground)' }}>{a.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.username}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-dim)' }}>{a.domain ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{TYPE_LABELS[a.accountType] ?? a.accountType}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--foreground-muted)' }}>{a.department?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: isExpiredWarn ? 'var(--status-red)' : sm.color }}>
                        {isExpiredWarn ? 'Expirada' : sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: isExpiredWarn ? 'var(--status-red)' : 'var(--foreground-dim)' }}>
                      {a.expirationDate ? new Intl.DateTimeFormat('es').format(a.expirationDate) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
