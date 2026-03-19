'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Trash2, Download, FileText, Image as ImageIcon,
  File, Plus, X, Loader2, Check, AlertTriangle,
} from 'lucide-react'
import {
  uploadDocument,
  deleteDocument,
  getDocumentDownloadUrl,
} from '@/modules/development/actions/documents'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentItem = {
  id: string
  title: string
  type: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  uploadedBy: { firstName: string; lastName: string } | null
}

interface Props {
  projectId: string
  documents: DocumentItem[]
  canEdit: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'SCREENSHOT',           label: 'Captura de pantalla' },
  { value: 'TECHNICAL_DOC',        label: 'Documentación técnica' },
  { value: 'USER_MANUAL',          label: 'Manual de usuario' },
  { value: 'ARCHITECTURE_DIAGRAM', label: 'Diagrama de arquitectura' },
  { value: 'CONFIG_FILE',          label: 'Archivo de configuración' },
  { value: 'OTHER',                label: 'Otro' },
]

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map(d => [d.value, d.label]),
)

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_EXT = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.txt', '.csv', '.zip',
]

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diffMs / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 2)    return 'ahora'
  if (mins < 60)   return `hace ${mins}m`
  if (hours < 24)  return `hace ${hours}h`
  if (days < 7)    return `hace ${days}d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function getFileIcon(mimeType: string | null): React.ReactNode {
  if (!mimeType) return <File size={18} />
  if (mimeType.startsWith('image/'))       return <ImageIcon size={18} style={{ color: '#a78bfa' }} />
  if (mimeType === 'application/pdf')      return <FileText size={18} style={{ color: '#ef4444' }} />
  if (mimeType.includes('word'))           return <FileText size={18} style={{ color: '#3b82f6' }} />
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
                                           return <FileText size={18} style={{ color: '#10b981' }} />
  return <File size={18} style={{ color: 'var(--foreground-muted)' }} />
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls  = 'w-full px-2.5 py-2 rounded text-xs outline-none transition-all focus:ring-1'
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }
const labelStyle: React.CSSProperties = { color: 'var(--foreground-muted)' }

// ─── Upload area ──────────────────────────────────────────────────────────────

function UploadArea({
  projectId,
  onSuccess,
  onCancel,
}: {
  projectId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [title, setTitle]           = useState('')
  const [docType, setDocType]       = useState('OTHER')
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((f: File): string | null => {
    if (f.size > MAX_SIZE)   return 'El archivo supera el límite de 50 MB'
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) return `Extensión no permitida: ${ext}`
    return null
  }, [])

  const handleFilePick = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const f = files[0]!
    const err = validateFile(f)
    if (err) { setError(err); return }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFilePick(e.dataTransfer.files)
  }

  const handleUpload = () => {
    if (!file || !title.trim()) { setError('Completa el título y selecciona un archivo'); return }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file',      file)
      fd.append('projectId', projectId)
      fd.append('title',     title.trim())
      fd.append('type',      docType)
      const result = await uploadDocument(fd)
      if (!result.success) { setError(result.error); return }
      onSuccess()
    })
  }

  return (
    <div
      className="rounded p-4 space-y-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--foreground-muted)' }}>
        Subir documento
      </p>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          <AlertTriangle size={11} />
          {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded cursor-pointer transition-all flex flex-col items-center justify-center gap-2 py-8"
        style={{
          border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--border-bright)'}`,
          background: isDragging ? 'var(--accent-cyan-dim)' : 'var(--surface)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXT.join(',')}
          className="hidden"
          onChange={(e) => handleFilePick(e.target.files)}
        />
        {file ? (
          <>
            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'var(--accent-glow)' }}>
              {getFileIcon(file.type)}
            </div>
            <p className="text-sm font-medium text-center truncate max-w-xs" style={{ color: 'var(--foreground)' }}>
              {file.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {formatBytes(file.size)}
            </p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
              <Upload size={18} style={{ color: isDragging ? 'var(--accent-cyan)' : 'var(--foreground-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: isDragging ? 'var(--accent-cyan)' : 'var(--foreground)' }}>
              {isDragging ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para seleccionar'}
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--foreground-dim)' }}>
              PDF, Word, Excel, imágenes, ZIP · Máx 50 MB
            </p>
          </>
        )}
      </div>

      {/* Metadata */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre descriptivo del documento"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium mb-1" style={labelStyle}>Tipo *</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className={`${inputCls} cursor-pointer`}
            style={inputStyle}
          >
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleUpload}
          disabled={isPending || !file || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {isPending ? 'Subiendo...' : 'Subir archivo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-xs font-medium"
          style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          Cancelar
        </button>
        {file && (
          <button
            type="button"
            onClick={() => { setFile(null); setTitle(''); setError(null) }}
            className="ml-auto p-1.5 rounded text-xs"
            style={{ color: 'var(--foreground-dim)' }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  projectId,
  onDelete,
  canEdit,
}: {
  doc: DocumentItem
  projectId: string
  onDelete: () => void
  canEdit: boolean
}) {
  const [isDownloading, startTransition] = useTransition()
  const [dlError, setDlError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDownload = () => {
    setDlError(null)
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(doc.id, projectId)
      if (!result.success) { setDlError(result.error); return }
      // Open presigned URL in new tab
      window.open(result.data.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div
      className="rounded"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* File icon */}
        <div
          className="w-9 h-9 rounded flex items-center justify-center shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {getFileIcon(doc.mimeType)}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {doc.title}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}
            >
              {DOC_TYPE_LABELS[doc.type] ?? doc.type}
            </span>
            {doc.fileSize && (
              <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>
                {formatBytes(doc.fileSize)}
              </span>
            )}
            <span className="text-[10px]" style={{ color: 'var(--foreground-dim)' }}>
              {formatRelative(doc.createdAt)}
              {doc.uploadedBy && ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all disabled:opacity-50"
            style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            Descargar
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Eliminar"
              className="p-1.5 rounded transition-all"
              style={{ color: 'var(--status-red)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {dlError && (
        <div className="px-4 pb-3 text-xs" style={{ color: 'var(--status-red)' }}>
          {dlError}
        </div>
      )}

      {confirmDelete && (
        <div
          className="flex items-center justify-between px-4 py-2 border-t gap-3"
          style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.04)' }}
        >
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            ¿Eliminar este documento permanentemente?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ background: 'var(--status-red)', color: '#fff' }}
            >
              <Trash2 size={11} />
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded text-xs font-medium"
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

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentsTab({ projectId, documents, canEdit }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = (docId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await deleteDocument(docId, projectId)
      if (!result.success) setError(result.error)
      else router.refresh()
    })
  }

  // Group by type
  const byType: Record<string, DocumentItem[]> = {}
  for (const doc of documents) {
    if (!byType[doc.type]) byType[doc.type] = []
    byType[doc.type]!.push(doc)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--status-red)' }}>
          {error}
        </div>
      )}

      {documents.length === 0 && !uploading && (
        <div
          className="rounded p-8 text-center"
          style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-bright)' }}
        >
          <FileText size={28} className="mx-auto mb-2" style={{ color: 'var(--foreground-dim)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Sin documentación
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--foreground-dim)' }}>
            Sube manuales, diagramas, capturas y archivos de configuración
          </p>
        </div>
      )}

      {/* Documents grouped by type */}
      {Object.entries(byType).map(([type, docs]) => (
        <div key={type} className="space-y-2">
          <p
            className="text-[10px] font-heading font-semibold uppercase tracking-widest"
            style={{ color: 'var(--foreground-dim)' }}
          >
            {DOC_TYPE_LABELS[type] ?? type}
          </p>
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              projectId={projectId}
              onDelete={() => handleDelete(doc.id)}
              canEdit={canEdit}
            />
          ))}
        </div>
      ))}

      {/* Upload form / button */}
      {canEdit && (
        <>
          {uploading ? (
            <UploadArea
              projectId={projectId}
              onSuccess={() => { setUploading(false); router.refresh() }}
              onCancel={() => setUploading(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setUploading(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{ color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', border: '1px solid rgba(6,182,212,0.2)' }}
            >
              <Plus size={12} />
              Subir documento
            </button>
          )}
        </>
      )}
    </div>
  )
}
