'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import UploadZone from '@/components/UploadZone'
import VideoQueue from '@/components/VideoQueue'
import TranscriptViewer from '@/components/TranscriptViewer'
import { Job, MODELS } from '@/lib/types'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const POLL_INTERVAL = 2000

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('base')
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'offline'>('checking')
  const [downloadingAll, setDownloadingAll] = useState(false)
  const pollerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Check API health ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/`)
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('offline'))
  }, [])

  // ── Poll all job statuses ───────────────────────────────────────────────────
  const pollStatuses = useCallback(async () => {
    if (!jobs.length) return
    try {
      const res = await fetch(`${API}/status`)
      if (!res.ok) return
      const updates: Job[] = await res.json()
      setJobs(prev => {
        const map = new Map(updates.map(u => [u.job_id, u]))
        return prev.map(j => {
          const upd = map.get(j.id)
          if (!upd) return j
          return {
            ...j,
            status: upd.status,
            progress: upd.progress,
            language: upd.language,
            error: upd.error,
          }
        })
      })
    } catch {
      // silent fail
    }
  }, [jobs.length])

  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing')
    if (hasActive) {
      pollerRef.current = setInterval(pollStatuses, POLL_INTERVAL)
    } else {
      if (pollerRef.current) clearInterval(pollerRef.current)
    }
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current)
    }
  }, [jobs, pollStatuses])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFilesUploaded = useCallback((uploaded: { job_id: string; filename: string }[]) => {
    const newJobs: Job[] = uploaded.map(u => ({
      id: u.job_id,
      filename: u.filename,
      status: 'uploaded',
      progress: 0,
      model: selectedModel,
    }))
    setJobs(prev => [...prev, ...newJobs])
  }, [selectedModel])

  const handleStartAll = async () => {
    const pending = jobs.filter(j => j.status === 'uploaded' || j.status === 'error')
    for (const job of pending) {
      try {
        await fetch(`${API}/transcribe/${job.id}?model=${selectedModel}`, { method: 'POST' })
        setJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, status: 'queued', progress: 0, model: selectedModel } : j
        ))
      } catch {
        // ignore
      }
    }
  }

  const handleDelete = async (jobId: string) => {
    try {
      await fetch(`${API}/job/${jobId}`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setJobs(prev => prev.filter(j => j.id !== jobId))
    if (selectedJobId === jobId) setSelectedJobId(null)
  }

  const handleClearAll = async () => {
    try {
      await fetch(`${API}/jobs/all`, { method: 'DELETE' })
    } catch {
      // ignore
    }
    setJobs([])
    setSelectedJobId(null)
  }

  const handleDownloadAll = async () => {
    setDownloadingAll(true)
    try {
      const res = await fetch(`${API}/transcripts/all`)
      if (!res.ok) throw new Error('No completed transcripts')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `all_transcripts_${new Date().toISOString().slice(0, 10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      alert('No completed transcripts to download yet.')
    }
    setDownloadingAll(false)
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const pendingCount = jobs.filter(j => j.status === 'uploaded' || j.status === 'error').length
  const doneCount = jobs.filter(j => j.status === 'done').length
  const processingCount = jobs.filter(j => j.status === 'processing' || j.status === 'queued').length
  const selectedJob = jobs.find(j => j.id === selectedJobId)
  const canStartAll = pendingCount > 0 && processingCount === 0

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,15,0.8)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Logo */}
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-glow)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              WhisperFlow
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -1 }}>
              Offline Video Transcriptor
            </p>
          </div>
        </div>

        {/* API Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 100,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: apiStatus === 'ok' ? 'var(--success)' : apiStatus === 'offline' ? 'var(--error)' : 'var(--warning)',
            boxShadow: apiStatus === 'ok' ? '0 0 6px var(--success-glow)' : undefined,
            animation: apiStatus === 'checking' ? 'pulse-dot 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            {apiStatus === 'ok' ? 'API Online' : apiStatus === 'offline' ? 'API Offline' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* API Offline Banner */}
      {apiStatus === 'offline' && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.2)',
          padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--error)' }}>
            Backend is offline. Start it with: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4 }}>
              cd backend && python -m uvicorn main:app --port 8000
            </code>
          </span>
        </div>
      )}

      {/* Main Layout */}
      <main style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '32px 24px',
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        gap: 24,
        alignItems: 'start',
      }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload zone */}
          <UploadZone
            onFilesUploaded={handleFilesUploaded}
            disabled={apiStatus === 'offline'}
          />

          {/* Model selector + start button */}
          {jobs.length > 0 && (
            <div className="glass animate-in" style={{ padding: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                WHISPER MODEL
              </label>
              <select
                className="select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
                id="model-selector"
              >
                {MODELS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}
                disabled={!canStartAll || apiStatus !== 'ok'}
                onClick={handleStartAll}
                id="btn-start-all"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {processingCount > 0
                  ? `Processing ${processingCount} video${processingCount > 1 ? 's' : ''}...`
                  : `Start Transcription${pendingCount > 1 ? ` (${pendingCount} videos)` : ''}`
                }
              </button>
            </div>
          )}

          {/* Stats */}
          {jobs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Total', value: jobs.length, color: 'var(--text-primary)' },
                { label: 'Done', value: doneCount, color: 'var(--success)' },
                { label: 'Pending', value: pendingCount + processingCount, color: 'var(--warning)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="glass" style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Queue header + actions */}
          {jobs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Video Queue
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: 14 }}>
                  ({jobs.length} file{jobs.length !== 1 ? 's' : ''})
                </span>
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Download ALL */}
                {doneCount > 0 && (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    id="btn-download-all"
                  >
                    {downloadingAll ? (
                      <>
                        <div style={{ width: 12, height: 12, border: '1.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download All ({doneCount})
                      </>
                    )}
                  </button>
                )}
                {/* Clear done */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAll}
                  disabled={processingCount > 0}
                  id="btn-clear-all"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Queue list */}
          {jobs.length > 0 ? (
            <>
              <VideoQueue
                jobs={jobs}
                selectedJobId={selectedJobId}
                onSelect={(id) => {
                  const job = jobs.find(j => j.id === id)
                  if (job?.status === 'done') setSelectedJobId(id)
                }}
                onDelete={handleDelete}
              />

              {/* Transcript viewer */}
              {selectedJobId && (
                <div style={{ marginTop: 8 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                    Transcript
                  </h2>
                  <TranscriptViewer
                    jobId={selectedJobId}
                    filename={selectedJob?.filename}
                  />
                </div>
              )}

              {!selectedJobId && doneCount > 0 && (
                <div className="glass" style={{
                  padding: 20, textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 13,
                }}>
                  👆 Click on a completed video to view its transcript
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="glass" style={{
              padding: '60px 32px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  No videos yet
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>
                  Upload videos using the panel on the left to get started.
                  All transcription happens locally using Whisper — no data leaves your machine.
                </p>
              </div>
              <div style={{
                display: 'flex', gap: 20, marginTop: 8,
                padding: '16px 24px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)', borderRadius: 12,
              }}>
                {[
                  { icon: '🔒', text: '100% Offline' },
                  { icon: '⚡', text: 'GPU Accelerated' },
                  { icon: '📄', text: 'TXT / SRT / VTT' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
