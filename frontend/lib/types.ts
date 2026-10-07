export type JobStatus = 'uploaded' | 'queued' | 'processing' | 'done' | 'error'

export interface Job {
  id: string
  filename: string
  status: JobStatus
  progress: number
  model: string
  language?: string | null
  error?: string | null
}

export interface TranscriptSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface TranscriptData {
  job_id: string
  filename: string
  language: string
  text: string
  segments: TranscriptSegment[]
}

export const MODELS = [
  { value: 'tiny',   label: 'Tiny (~150MB)', desc: 'Fastest, lowest accuracy' },
  { value: 'base',   label: 'Base (~290MB)', desc: 'Good balance (recommended)' },
  { value: 'small',  label: 'Small (~970MB)', desc: 'Better accuracy' },
  { value: 'medium', label: 'Medium (~3GB)', desc: 'High accuracy' },
  { value: 'large',  label: 'Large (~6GB)', desc: 'Best accuracy, slowest' },
]
