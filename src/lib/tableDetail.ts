export interface DetailField {
  label: string
  value: string
  href?: string
}

export function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate()
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return String(value)
}

export function buildDetailFields(
  data: Record<string, unknown>,
  schema: Array<{ key: string; label: string; hrefKey?: string }>,
): DetailField[] {
  return schema
    .map(({ key, label, hrefKey }) => {
      const raw = data[key]
      const value = formatDetailValue(raw)
      const href = hrefKey && data[hrefKey] ? String(data[hrefKey]) : undefined
      return { label, value, href }
    })
    .filter(f => f.value !== '—')
}
