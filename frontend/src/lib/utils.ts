import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Read the live chart palette from CSS variables (theme-aware). */
export function getChartPalette(): string[] {
  if (typeof window === 'undefined') return CHART_HEX
  const styles = getComputedStyle(document.documentElement)
  const colors = Array.from({ length: 8 }, (_, i) =>
    styles.getPropertyValue(`--chart-${i + 1}`).trim(),
  ).filter(Boolean)
  return colors.length === 8 ? colors : CHART_HEX
}

export const CHART_HEX = [
  '#5B3DF5',
  '#FF6B4A',
  '#C65BCF',
  '#8EA2FF',
  '#8A1F5C',
  '#FF9E85',
  '#3B2A8C',
  '#D9A6F2',
]

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function displayCell(value: unknown, max = 60): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  const s = String(value)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function uniqueId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}