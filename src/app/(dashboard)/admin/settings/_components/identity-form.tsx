'use client'

import { useTransition, useState, useRef } from 'react'
import { Building2, Upload, CheckCircle, AlertCircle, ImageIcon } from 'lucide-react'
import { updateOrganizationIdentity, uploadLogo, uploadFavicon } from '@/modules/system/actions/settings'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentName: string
  currentTagline: string
  currentLogoUrl: string | null
  currentFaviconUrl: string | null
}

// ─── Feedback banner ─────────────────────────────────────────────────────────

function Feedback({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded text-sm"
      style={{
        background: type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color: type === 'success' ? 'var(--status-green)' : 'var(--status-red)',
      }}
    >
      {type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {message}
    </div>
  )
}

// ─── Image Upload Box ─────────────────────────────────────────────────────────

function ImageUpload({
  label,
  hint,
  currentUrl,
  inputName,
  acceptedFormats,
  onSubmit,
  pending,
}: {
  label: string
  hint: string
  currentUrl: string | null
  inputName: string
  acceptedFormats: string
  onSubmit: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  pending: boolean
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [localPending, setLocalPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    setFeedback(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const formData = new FormData(formRef.current)
    setLocalPending(true)
    setFeedback(null)
    const result = await onSubmit(formData)
    setLocalPending(false)
    if (result.success) {
      setFeedback({ type: 'success', message: 'Imagen actualizada correctamente' })
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Error al subir imagen' })
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{hint}</p>
      </div>

      {/* Preview */}
      <div
        className="w-24 h-24 rounded flex items-center justify-center overflow-hidden"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-bright)' }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="w-full h-full object-contain" />
        ) : (
          <ImageIcon size={28} style={{ color: 'var(--foreground-dim)' }} />
        )}
      </div>

      {/* Upload form */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          name={inputName}
          accept={acceptedFormats}
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-bright)',
              color: 'var(--foreground-muted)',
            }}
          >
            <Upload size={12} />
            Seleccionar
          </button>
          <button
            type="submit"
            disabled={localPending || pending}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: '#fff',
            }}
          >
            {localPending ? 'Subiendo...' : 'Guardar'}
          </button>
        </div>
        {feedback && <Feedback {...feedback} />}
      </form>
    </div>
  )
}

// ─── Main Form ─────────────────────────────────────────────────────────────────

export function IdentityForm({ currentName, currentTagline, currentLogoUrl, currentFaviconUrl }: Props) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(currentName)
  const [tagline, setTagline] = useState(currentTagline)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const result = await updateOrganizationIdentity({ name, tagline })
      if (result.success) {
        setFeedback({ type: 'success', message: 'Identidad actualizada correctamente' })
      } else {
        setFeedback({ type: 'error', message: result.error })
      }
    })
  }

  const handleLogoUpload = async (formData: FormData) => {
    const result = await uploadLogo(formData)
    return { success: result.success, error: !result.success ? result.error : undefined }
  }

  const handleFaviconUpload = async (formData: FormData) => {
    const result = await uploadFavicon(formData)
    return { success: result.success, error: !result.success ? result.error : undefined }
  }

  return (
    <div className="space-y-8">
      {/* Name + Tagline */}
      <form onSubmit={handleIdentitySubmit} className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={15} style={{ color: 'var(--accent-cyan)' }} />
          <h3 className="text-sm font-heading font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>
            Datos de la organización
          </h3>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
            Nombre de la institución / empresa
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Municipalidad de..."
            className="w-full px-3 py-2 rounded text-sm font-mono outline-none transition-colors"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-bright)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        {/* Tagline */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
            Descripción corta (tagline)
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Portfolio TI"
            className="w-full px-3 py-2 rounded text-sm font-mono outline-none transition-colors"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-bright)',
              color: 'var(--foreground)',
            }}
          />
          <p className="text-xs" style={{ color: 'var(--foreground-dim)' }}>
            Aparece debajo del nombre en el sidebar.
          </p>
        </div>

        {feedback && <Feedback {...feedback} />}

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {pending ? 'Guardando...' : 'Guardar identidad'}
        </button>
      </form>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Logo + Favicon uploads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <ImageUpload
          label="Logotipo"
          hint="PNG, SVG, WEBP. Máx. 2 MB. Se muestra en el sidebar."
          currentUrl={currentLogoUrl}
          inputName="logo"
          acceptedFormats="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          onSubmit={handleLogoUpload}
          pending={pending}
        />
        <ImageUpload
          label="Favicon"
          hint="PNG, ICO, SVG. Máx. 1 MB. Aparece en la pestaña del navegador."
          currentUrl={currentFaviconUrl}
          inputName="favicon"
          acceptedFormats="image/png,image/x-icon,image/svg+xml,image/jpeg"
          onSubmit={handleFaviconUpload}
          pending={pending}
        />
      </div>
    </div>
  )
}
