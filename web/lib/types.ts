export type MediaKind = "photo" | "video"

export type ScannedItem = {
  id: string
  createdAt: number | null
  pixelWidth: number
  pixelHeight: number
  duration: number
  byteSize: number
  isFavorite: boolean
  isBurstRepresentative: boolean
  isScreenshot: boolean
  isLivePhoto: boolean
  kind: MediaKind
  hash: bigint | null
}

export type MediaItem = ScannedItem & {
  name: string
  relativePath: string
  previewUrl: string | null
}

export function pixelCount(item: Pick<ScannedItem, "pixelWidth" | "pixelHeight">): number {
  return item.pixelWidth * item.pixelHeight
}
