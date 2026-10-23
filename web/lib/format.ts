const UNITS = ["bytes", "KB", "MB", "GB", "TB"] as const

/** Binary file sizes (1024). 50 × 1024 × 1024 is "50 MB". */
export function formatBytes(bytes: number): string {
  const value = Math.max(0, bytes)
  if (value < 1024) {
    const rounded = Math.round(value)
    return rounded === 1 ? "1 byte" : `${rounded} bytes`
  }

  let size = value
  let unit = 0
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024
    unit += 1
  }
  const rounded = size >= 100 || Number.isInteger(size) ? Math.round(size) : Math.round(size * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} ${UNITS[unit]}`
}

export function formatDuration(duration: number): string {
  const total = Math.max(0, Math.round(duration))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms))
}

export type StorageSnapshot = {
  totalBytes: number
  availableBytes: number
  freeBytes: number
  usedBytes: number
  usedFraction: number
  isKnown: boolean
}

export function storageSnapshot(totalBytes: number, availableBytes: number): StorageSnapshot {
  const available = Math.max(0, availableBytes)
  const freeBytes = totalBytes > 0 ? Math.min(available, totalBytes) : 0
  const usedBytes = totalBytes > 0 ? Math.max(0, totalBytes - freeBytes) : 0
  const usedFraction = totalBytes > 0 ? Math.min(1, usedBytes / totalBytes) : 0
  return {
    totalBytes,
    availableBytes,
    freeBytes,
    usedBytes,
    usedFraction,
    isKnown: totalBytes > 0,
  }
}
