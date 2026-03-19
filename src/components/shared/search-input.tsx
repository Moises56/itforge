'use client'

import { useRef, useState, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Component ───────────────────────────────────────────────────────────────

interface SearchInputProps {
  placeholder?: string
  paramName?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({
  placeholder = 'Buscar...',
  paramName = 'q',
  debounceMs = 400,
  className,
}: SearchInputProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [value, setValue] = useState(searchParams.get(paramName) ?? '')

  const pushParams = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (val.trim()) {
        params.set(paramName, val.trim())
      } else {
        params.delete(paramName)
      }
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams, paramName],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setValue(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => pushParams(val), debounceMs)
  }

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {isPending ? (
          <Loader2
            size={13}
            className="animate-spin"
            style={{ color: 'var(--accent-cyan)' }}
          />
        ) : (
          <Search size={13} style={{ color: 'var(--foreground-muted)' }} />
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm rounded outline-none transition-all"
        style={{
          background: 'var(--surface-2)',
          border: `1px solid ${isPending ? 'var(--border-bright)' : 'var(--border)'}`,
          color: 'var(--foreground)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-focus)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = isPending
            ? 'var(--border-bright)'
            : 'var(--border)'
        }}
      />
    </div>
  )
}
