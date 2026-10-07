'use client'

import { Job } from '@/lib/types'

interface VideoQueueProps {
  jobs: Job[]
  selectedJobId: string | null
  onSelect: (jobId: string) => void
  onDelete: (jobId: string) => void
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const icons: Record<string, string> = {
    uploaded: '○',
    queued: '◐',
    processing: '◑',
    done: '●',
    error: '✕',
  }
  return (
    <span className={`badge badge-${status}`}>
      <span style={{ fontSize: 9 }}>{icons[status] || '?'}</span>
      {status}
    </span>
  )
}

function ProgressBar({ progress, status }: { progress: number; status: Job['status'] }) {
  if (status !== 'processing' && status !== 'done' && status !== 'queued') return null

  const displayProgress = status === 'done' ? 100 : progress
  const showAnimation = status === 'processing'

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {status === 'processing' ? 'Transcribing...' : status === 'queued' ? 'Waiting in queue...' : 'Complete'}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: status === 'done' ? 'var(--success)' : 'var(--accent-light)'
        }}>
          {status === 'queued' ? '—' : `${displayProgress}%`}
        </span>
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: status === 'queued' ? '0%' : `${displayProgress}%`,
            background: status === 'done'
              ? 'linear-gradient(90deg, var(--success) 0%, #10b981 100%)'
              : 'linear-gradient(90deg, var(--accent) 0%, var(--processing) 100%)',
            boxShadow: status === 'done' ? '0 0 10px var(--success-glow)' : undefined,
          }}

        />
      </div>
    </div>
  )
}

export default function VideoQueue({ jobs, selectedJobId, onSelect, onDelete }: VideoQueueProps) {
  if (!jobs.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {jobs.map((job, idx) => (
        <div
          key={job.id}
          className="glass animate-in"
          style={{
            padding: '14px 16px',
            cursor: 'pointer',
            border: selectedJobId === job.id
              ? '1px solid var(--accent)'
              : '1px solid var(--border)',
            background: selectedJobId === job.id
              ? 'rgba(99,102,241,0.08)'
              : undefined,
            transition: 'all 0.2s ease',
            animationDelay: `${idx * 0.05}s`,
            position: 'relative',
          }}
          onClick={() => onSelect(job.id)}
          onMouseEnter={e => {
            if (selectedJobId !== job.id) {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'
            }
          }}
          onMouseLeave={e => {
            if (selectedJobId !== job.id) {
              (e.currentTarget as HTMLElement).style.background = ''
            }
          }}
        >
          {/* Processing pulse indicator */}
          {job.status === 'processing' && (
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--processing)',
              boxShadow: '0 0 6px var(--processing)',
              animation: 'pulse-dot 1s infinite',
            }} />
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Filename */}
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 5,
              }}>
                <span style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  marginRight: 6, fontWeight: 400
                }}>#{idx + 1}</span>
                {job.filename}
              </div>

              {/* Status row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge status={job.status} />
                {job.model && (
                  <span style={{
                    fontSize: 10, color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '1px 7px', borderRadius: 5, fontWeight: 500,
                  }}>
                    whisper/{job.model}
                  </span>
                )}
                {job.language && job.status === 'done' && (
                  <span style={{
                    fontSize: 10, color: 'var(--success)',
                    background: 'rgba(34,197,94,0.1)',
                    padding: '1px 7px', borderRadius: 5, fontWeight: 500,
                  }}>
                    🌐 {job.language}
                  </span>
                )}
              </div>

              {/* Error message */}
              {job.status === 'error' && job.error && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 6, lineHeight: 1.4 }}>
                  ⚠ {job.error}
                </p>
              )}
            </div>

            {/* Delete button */}
            {job.status !== 'processing' && (
              <button
                className="btn btn-danger btn-sm"
                style={{ flexShrink: 0, padding: '4px 10px' }}
                onClick={(e) => { e.stopPropagation(); onDelete(job.id) }}
                title="Delete job"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            )}
          </div>

          {/* Progress bar */}
          <ProgressBar progress={job.progress} status={job.status} />
        </div>
      ))}
    </div>
  )
}
