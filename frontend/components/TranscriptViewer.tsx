'use client'

import { useState } from 'react'
import { TranscriptData } from '@/lib/types'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface TranscriptViewerProps {
  jobId: string | null
  filename?: string
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TranscriptViewer({ jobId, filename }: TranscriptViewerProps) {
  const [data, setData] = useState<TranscriptData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'segments'>('text')
  const [prevJobId, setPrevJobId] = useState<string | null>(null)

  if (jobId !== prevJobId) {
    setPrevJobId(jobId)
    setData(null)
    if (jobId) {
      setLoading(true)
      fetch(`${API}/transcript/${jobId}?fmt=text`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }

  const handleCopy = () => {
    if (data?.text) {
      navigator.clipboard.writeText(data.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = async (fmt: 'text' | 'srt' | 'vtt') => {
    if (!jobId) return
    const res = await fetch(`${API}/transcript/${jobId}?fmt=${fmt}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const base = (filename || 'transcript').replace(/\.[^.]+$/, '')
    const ext = fmt === 'text' ? 'txt' : fmt
    a.download = `${base}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!jobId) {
    return (
      <div className="glass" style={{
        padding: '48px 24px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        minHeight: 200, justifyContent: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Select a completed video to view its transcript
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="glass" style={{
        padding: 32, textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        minHeight: 200,
      }}>
        <div style={{
          width: 18, height: 18, border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading transcript...</span>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="glass animate-in" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
            {filename}
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data.language && (
              <span style={{ fontSize: 11, color: 'var(--success)', background: 'rgba(34,197,94,0.1)', padding: '1px 7px', borderRadius: 5 }}>
                🌐 {data.language}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {data.segments?.length || 0} segments
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy} id="btn-copy">
            {copied ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</>
            )}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('text')} id="btn-dl-txt">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            TXT
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('srt')} id="btn-dl-srt">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            SRT
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('vtt')} id="btn-dl-vtt">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            VTT
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        {(['text', 'segments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {tab === 'text' ? 'Full Text' : 'Segments'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxHeight: 380, overflowY: 'auto' }}>
        {activeTab === 'text' ? (
          <p style={{
            fontSize: 14, lineHeight: 1.8,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}>
            {data.text || '(No text returned)'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.segments?.map((seg, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '80px 1fr',
                gap: 12, padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 600, paddingTop: 2 }}>
                  {formatTimestamp(seg.start)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {seg.text.trim()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
