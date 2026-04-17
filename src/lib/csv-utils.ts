export function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function escapeCsv(value: string): string {
  const needsFormulaNeutralization =
    /^[=+\-@]/.test(value) || /^[\t\r]/.test(value) || /^\s+[=+\-@]/.test(value)
  const safeValue = needsFormulaNeutralization ? `'${value}` : value

  if (safeValue.includes('"') || safeValue.includes(',') || safeValue.includes('\n')) {
    return `"${safeValue.replaceAll('"', '""')}"`
  }
  return safeValue
}
