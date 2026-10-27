// File sizes in decimal units (1 kB = 1,000 bytes), as storage services and operating systems
// usually show them.
const UNITS: [number, string][] = [
  [1e12, 'TB'],
  [1e9, 'GB'],
  [1e6, 'MB'],
  [1e3, 'kB'],
]

export function formatFileSize(bytes: number) {
  const unit = UNITS.find(([size]) => bytes >= size)
  if (!unit) {
    return `${String(bytes)} B`
  }
  const [size, name] = unit
  return `${(bytes / size).toFixed(1)} ${name}`
}
