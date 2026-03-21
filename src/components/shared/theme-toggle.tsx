'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  // Always start as 'dark' to match SSR — avoids hydration mismatch.
  // The inline script in layout.tsx already applied the correct class to <html>
  // before the first paint, so there's no visual flash even though state lags.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
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
      onClick={toggle}
      className="w-8 h-8 rounded flex items-center justify-center transition-colors"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--foreground-muted)',
      }}
      // Suppress hydration warning: server always renders dark, client updates after mount
      suppressHydrationWarning
      title={mounted
        ? (theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')
        : 'Tema'}
    >
      {/* Use suppressHydrationWarning here too since icon changes after mount */}
      <span suppressHydrationWarning>
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </span>
    </button>
  )
}
