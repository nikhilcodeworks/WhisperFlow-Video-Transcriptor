import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WhisperFlow — Offline Video Transcriptor',
  description: 'Transcribe multiple videos offline using OpenAI Whisper. No internet required after setup.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
