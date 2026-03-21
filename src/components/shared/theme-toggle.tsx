'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme]   = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Sync with the class the beforeInteractive script applied
    const actual = document.documentElement.classList.contains('light') ? 'light' : 'dark'
    setTheme(actual)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('itforge-theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
  }

  return (
    <button
      onClick={mounted ? toggle : undefined}
      className="w-8 h-8 rounded flex items-center justify-center transition-colors"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--foreground-muted)',
      }}
      aria-label="Cambiar tema"
    >
      {/*
       * Render nothing until mounted.
       * Server and client initial render are identical (no icon) so there
       * is no hydration mismatch. After mount, the icon appears instantly.
       */}
      {mounted && (theme === 'dark' ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />)}
    </button>
  )
}
