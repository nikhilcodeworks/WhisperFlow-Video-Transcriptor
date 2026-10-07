'use client'

import { useState, useCallback, useRef } from 'react'

const ACCEPTED = '.mp4,.mkv,.avi,.mov,.webm,.mp3,.wav,.m4a,.flac,.ogg'
const ACCEPTED_LABEL = 'MP4, MKV, AVI, MOV, WEBM, MP3, WAV, M4A, FLAC, OGG'
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface UploadZoneProps {
  onFilesUploaded: (jobs: { job_id: string; filename: string }[]) => void
  disabled?: boolean
}

export default function UploadZone({ onFilesUploaded, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ name: string; done: boolean }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    setUploadProgress(files.map(f => ({ name: f.name, done: false })))

    const results: { job_id: string; filename: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch(`${API}/upload`, { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          results.push({ job_id: data.job_id, filename: data.filename })
        }
      } catch {
        // ignore individual upload errors
      }
      setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p))
    }

    setUploading(false)
    setUploadProgress([])
    if (results.length) onFilesUploaded(results)
    if (fileRef.current) fileRef.current.value = ''
  }, [onFilesUploaded])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || uploading) return
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [disabled, uploading, handleFiles])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  return (
    <div
      className="glass"
      onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        padding: '40px 24px',
        textAlign: 'center',
        cursor: disabled || uploading ? 'not-allowed' : 'pointer',
        border: dragging
          ? '2px dashed var(--accent)'
          : '2px dashed var(--border)',
        background: dragging ? 'rgba(99,102,241,0.07)' : undefined,
        transition: 'all 0.25s ease',
        opacity: disabled ? 0.6 : 1,
      }}
      onClick={() => !disabled && !uploading && fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED}
        style={{ display: 'none' }}
        onChange={onInputChange}
        disabled={disabled || uploading}
        id="file-upload"
      />

      {/* Icon */}
      <div style={{
        width: 64, height: 64, margin: '0 auto 16px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.25s',
        transform: dragging ? 'scale(1.1)' : 'scale(1)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>

      {uploading ? (
        <div>
          <p style={{ color: 'var(--accent-light)', fontWeight: 600, marginBottom: 16 }}>
            Uploading files...
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320, margin: '0 auto' }}>
            {uploadProgress.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                padding: '8px 12px',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: p.done ? 'var(--success)' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: p.done ? 'none' : 'pulse-dot 1s infinite',
                }}>
                  {p.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>
            {dragging ? 'Drop videos here!' : 'Drag & drop videos here'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            or <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>click to browse</span>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Supports: {ACCEPTED_LABEL}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
            Multiple files supported • Transcribed one by one
          </p>
        </>
      )}
    </div>
  )
}
