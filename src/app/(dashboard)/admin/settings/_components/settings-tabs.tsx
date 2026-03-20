'use client'

import { useState } from 'react'
import { Building2, Palette, Layers, Languages } from 'lucide-react'
import { IdentityForm } from './identity-form'
import { ThemeForm } from './theme-form'
import { ModulesForm } from './modules-form'
import { TerminologyForm } from './terminology-form'
import type { OrgConfig } from '@/core/config/get-org-config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  config: OrgConfig
}

type TabId = 'identity' | 'theme' | 'modules' | 'terminology'

interface TabDef {
  id: TabId
  label: string
  icon: React.ComponentType<{ size?: number }>
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: TabDef[] = [
  { id: 'identity',    label: 'Identidad',     icon: Building2 },
  { id: 'theme',       label: 'Tema visual',    icon: Palette },
  { id: 'modules',     label: 'Módulos',        icon: Layers },
  { id: 'terminology', label: 'Terminología',   icon: Languages },
]

// ─── Tabs component ───────────────────────────────────────────────────────────

export function SettingsTabs({ config }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('identity')

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div
        className="flex gap-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {TABS.map((tab) => {
          const active = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative"
              style={{
                color: active ? 'var(--accent-cyan)' : 'var(--foreground-muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div
        className="rounded-b p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }}
      >
        {activeTab === 'identity' && (
          <IdentityForm
            currentName={config.name}
            currentTagline={config.tagline}
            currentLogoUrl={config.logoUrl}
            currentFaviconUrl={config.faviconUrl}
          />
        )}
        {activeTab === 'theme' && (
          <ThemeForm
            currentPrimary={config.colors.primary}
            currentSecondary={config.colors.secondary}
            currentAccent={config.colors.accent}
          />
        )}
        {activeTab === 'modules' && (
          <ModulesForm
            development={config.enabledModules.development}
            infrastructure={config.enabledModules.infrastructure}
            support={config.enabledModules.support}
          />
        )}
        {activeTab === 'terminology' && (
          <TerminologyForm
            currentDepartment={config.terminology.department}
            currentProject={config.terminology.project}
          />
        )}
      </div>
    </div>
  )
}
