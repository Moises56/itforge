import type { Metadata } from 'next'
import { Settings, ShieldOff } from 'lucide-react'
import { getCurrentUser } from '@/core/auth/get-current-user'
import { resolvePermission } from '@/core/permissions/resolve'
import { getOrgConfig } from '@/core/config/get-org-config'
import { SettingsTabs } from './_components/settings-tabs'

export const metadata: Metadata = { title: 'Configuración del sistema' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  const canEdit = await resolvePermission(user.id, 'system.config', 'edit')

  if (!canEdit) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <ShieldOff size={40} className="mx-auto" style={{ color: 'var(--foreground-dim)' }} />
        <h2 className="text-xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
          Acceso denegado
        </h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          No tienes permiso para editar la configuración del sistema.
          Contacta al administrador si crees que esto es un error.
        </p>
      </div>
    )
  }

  const config = await getOrgConfig()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-bright)' }}
        >
          <Settings size={18} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--foreground)' }}>
            Configuración del sistema
          </h1>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Identidad, tema visual, módulos habilitados y terminología de{' '}
            <span style={{ color: 'var(--accent-cyan)' }}>{config.name}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <SettingsTabs config={config} />
    </div>
  )
}
