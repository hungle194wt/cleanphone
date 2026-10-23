export type RemovedEntry = {
  id: string
  name: string
  relativePath: string
  byteSize: number
  removedAt: number
}

export function removalListDocument(entries: RemovedEntry[], generatedAt = new Date()): string {
  const lines = [
    "CleanPhone removal list",
    `Generated: ${generatedAt.toISOString()}`,
    "",
    "A browser cannot delete these files. They are still on your computer.",
    "Delete them yourself in Finder, Files, or Explorer.",
    "",
  ]

  if (entries.length === 0) {
    lines.push("No files have been removed from this review.")
    return `${lines.join("\n")}\n`
  }

  const total = entries.reduce((sum, entry) => sum + entry.byteSize, 0)
  lines.push(`Files: ${entries.length}`)
  lines.push(`Total bytes: ${total}`)
  lines.push("")
  lines.push("path\tbytes")
  for (const entry of entries) {
    const path = entry.relativePath || entry.name
    lines.push(`${path}\t${entry.byteSize}`)
  }
  return `${lines.join("\n")}\n`
}

export function downloadRemovalList(entries: RemovedEntry[]): void {
  const blob = new Blob([removalListDocument(entries)], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "cleanphone-removal-list.txt"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
