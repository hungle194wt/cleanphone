import { dHash } from "@/lib/perceptualHash"
import { isScreenshotFile } from "@/lib/screenshots"
import type { MediaItem, MediaKind } from "@/lib/types"

export type ImportedFile = {
  file: File
  relativePath: string
}

export type ScanProgress = {
  completed: number
  total: number
  label: string
}

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "avif",
  "tif",
  "tiff",
])

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv", "qt"])

export function mediaId(file: File, relativePath: string): string {
  return `${relativePath}\u0000${file.size}\u0000${file.lastModified}`
}

export function mediaKind(name: string, mimeType: string): MediaKind | null {
  const mime = mimeType.toLowerCase()
  if (mime.startsWith("image/")) return "photo"
  if (mime.startsWith("video/")) return "video"
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
  if (IMAGE_EXTENSIONS.has(extension)) return "photo"
  if (VIDEO_EXTENSIONS.has(extension)) return "video"
  return null
}

export function filesFromList(list: FileList | File[]): ImportedFile[] {
  return [...list].map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }))
}

export async function filesFromDataTransfer(data: DataTransfer): Promise<ImportedFile[]> {
  const entries = [...data.items]
    .map((item) => {
      const getter = (
        item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }
      ).webkitGetAsEntry
      return getter?.call(item) ?? null
    })
    .filter((entry): entry is FileSystemEntry => entry != null)

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((entry) => readEntry(entry)))
    return nested.flat()
  }

  return filesFromList(data.files)
}

export async function inspectFiles(
  files: ImportedFile[],
  onProgress: (progress: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const total = files.length
  let completed = 0
  onProgress({ completed: 0, total, label: total === 0 ? "Nothing to check" : "Starting" })

  const inspected = await mapPool(files, 4, async (input) => {
    if (signal?.aborted) return null
    const item = await inspectOne(input)
    if (signal?.aborted) {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return null
    }
    completed += 1
    onProgress({
      completed,
      total,
      label: item ? item.name : input.file.name,
    })
    return item
  })

  if (signal?.aborted) {
    for (const item of inspected) {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    throw new DOMException("The scan was cancelled.", "AbortError")
  }

  return inspected.filter((item): item is MediaItem => item != null)
}

async function inspectOne(input: ImportedFile): Promise<MediaItem | null> {
  const { file, relativePath } = input
  const kind = mediaKind(file.name, file.type)
  if (!kind) return null

  const base = {
    id: mediaId(file, relativePath),
    createdAt: file.lastModified > 0 ? file.lastModified : null,
    byteSize: file.size,
    isFavorite: false,
    isBurstRepresentative: false,
    isLivePhoto: false,
    name: file.name,
    relativePath,
    kind,
  }

  if (kind === "video") {
    const duration = await videoDuration(file)
    return {
      ...base,
      pixelWidth: 0,
      pixelHeight: 0,
      duration,
      isScreenshot: false,
      hash: null,
      previewUrl: URL.createObjectURL(file),
    }
  }

  const previewUrl = URL.createObjectURL(file)
  try {
    const measured = await measurePhoto(file)
    const screenshot = isScreenshotFile({
      name: file.name,
      relativePath,
      mimeType: file.type,
      width: measured.width,
      height: measured.height,
    })
    return {
      ...base,
      pixelWidth: measured.width,
      pixelHeight: measured.height,
      duration: 0,
      isScreenshot: screenshot,
      hash: screenshot ? null : measured.hash,
      previewUrl,
    }
  } catch {
    return {
      ...base,
      pixelWidth: 0,
      pixelHeight: 0,
      duration: 0,
      isScreenshot: isScreenshotFile({
        name: file.name,
        relativePath,
        mimeType: file.type,
        width: 0,
        height: 0,
      }),
      hash: null,
      previewUrl,
    }
  }
}

async function measurePhoto(file: File): Promise<{
  width: number
  height: number
  hash: bigint | null
}> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const width = bitmap.width
    const height = bitmap.height
    const maxEdge = 64
    const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
    const sampleWidth = Math.max(1, Math.round(width * scale))
    const sampleHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return { width, height, hash: null }
    context.imageSmoothingEnabled = true
    context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight)
    const data = context.getImageData(0, 0, sampleWidth, sampleHeight).data
    const pixels = new Uint8Array(sampleWidth * sampleHeight)
    for (let index = 0; index < pixels.length; index++) {
      const offset = index * 4
      const luma = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
      pixels[index] = Math.max(0, Math.min(255, Math.round(luma)))
    }
    return { width, height, hash: dHash(pixels, sampleWidth, sampleHeight) }
  } finally {
    bitmap.close()
  }
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    const finish = (value: number) => {
      window.clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(0), 4000)
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) ? video.duration : 0)
    }
    video.onerror = () => finish(0)
    video.src = url
  })
}

async function readEntry(entry: FileSystemEntry): Promise<ImportedFile[]> {
  if (entry.name.startsWith(".")) return []
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    const full = entry.fullPath?.replace(/^\/+/, "")
    return [{ file, relativePath: full || file.name }]
  }
  if (!entry.isDirectory) return []
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  const children = await readAll(reader)
  const nested = await Promise.all(children.map((child) => readEntry(child)))
  return nested.flat()
}

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all)
        else {
          all.push(...batch)
          next()
        }
      }, reject)
    }
    next()
  })
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}
