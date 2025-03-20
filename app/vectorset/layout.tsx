import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Vector Sets Browser - Vector Set',
  description: 'Vector Set Explorer and Visualization',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
}

export default function VectorSetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 