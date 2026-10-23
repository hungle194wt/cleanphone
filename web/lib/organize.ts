import {
  clusters,
  defaultSimilarityOptions,
  type SimilarityOptions,
} from "@/lib/similarity"
import { pixelCount, type ScannedItem } from "@/lib/types"

/** Videos at least this large show up under Large videos. */
export const LARGE_VIDEO_MINIMUM_BYTES = 50 * 1024 * 1024

export type CalendarMode = "utc" | "local"

export type ReviewGroup = {
  id: string
  title: string
  anchorDate: number | null
  footnote: string | null
  assets: ScannedItem[]
  keepID: string | null
}

export type OrganizedLibrary = {
  similarGroups: ReviewGroup[]
  screenshotGroups: ReviewGroup[]
  largeVideoGroups: ReviewGroup[]
  livePhotoGroups: ReviewGroup[]
}

export type CategoryId = "similar" | "screenshots" | "largeVideos" | "livePhotos"

export type CategorySummary = {
  category: CategoryId
  primaryCount: number
  countLabel: string
  byteCount: number
}

export type SelectionMode = "all" | "exceptBest"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function organize(
  items: ScannedItem[],
  options?: {
    calendar?: CalendarMode
    similar?: SimilarityOptions
  },
): OrganizedLibrary {
  const calendar = options?.calendar ?? "local"
  const similarOptions = options?.similar ?? defaultSimilarityOptions
  const byID = new Map(items.map((item) => [item.id, item]))

  const candidates = items.flatMap((item) => {
    if (item.kind !== "photo" || item.isScreenshot || item.hash == null || item.createdAt == null) {
      return []
    }
    return [
      {
        id: item.id,
        hash: item.hash,
        createdAt: item.createdAt,
        pixelCount: pixelCount(item),
        isFavorite: item.isFavorite,
        isBurstRepresentative: item.isBurstRepresentative,
      },
    ]
  })

  const similarGroups = clusters(candidates, similarOptions).flatMap((cluster) => {
    const assets = cluster.memberIDs.flatMap((id) => {
      const asset = byID.get(id)
      return asset ? [asset] : []
    })
    if (assets.length < 2) return []
    const keep = assets.find((asset) => asset.id === cluster.keepID)
    const dates = assets.flatMap((asset) => (asset.createdAt == null ? [] : [asset.createdAt]))
    return [
      {
        id: `similar-${cluster.keepID}`,
        title: `${assets.length} similar`,
        anchorDate: dates.length > 0 ? Math.min(...dates) : null,
        footnote: footnote(keep),
        assets,
        keepID: cluster.keepID,
      },
    ]
  })

  const screenshots = items.filter((item) => item.kind === "photo" && item.isScreenshot)
  const videos = items.filter(
    (item) => item.kind === "video" && item.byteSize >= LARGE_VIDEO_MINIMUM_BYTES,
  )
  const livePhotos = items.filter((item) => item.kind === "photo" && item.isLivePhoto)

  return {
    similarGroups,
    screenshotGroups: monthGroups(screenshots, "screenshots", calendar, "newestFirst"),
    largeVideoGroups: monthGroups(videos, "videos", calendar, "largestFirst"),
    livePhotoGroups: monthGroups(livePhotos, "live", calendar, "newestFirst"),
  }
}

export const emptyLibrary: OrganizedLibrary = {
  similarGroups: [],
  screenshotGroups: [],
  largeVideoGroups: [],
  livePhotoGroups: [],
}

export function groupsFor(library: OrganizedLibrary, category: CategoryId): ReviewGroup[] {
  switch (category) {
    case "similar":
      return library.similarGroups
    case "screenshots":
      return library.screenshotGroups
    case "largeVideos":
      return library.largeVideoGroups
    case "livePhotos":
      return library.livePhotoGroups
  }
}

export function groupBytes(group: ReviewGroup, excludingKeep: boolean): number {
  return group.assets.reduce((sum, asset) => {
    if (excludingKeep && asset.id === group.keepID) return sum
    return sum + asset.byteSize
  }, 0)
}

export function extraCount(group: ReviewGroup): number {
  return group.assets.reduce((sum, asset) => sum + (asset.id !== group.keepID ? 1 : 0), 0)
}

export function similarExtraBytes(library: OrganizedLibrary): number {
  return library.similarGroups.reduce((sum, group) => sum + groupBytes(group, true), 0)
}

export function screenshotBytes(library: OrganizedLibrary): number {
  return library.screenshotGroups.reduce((sum, group) => sum + groupBytes(group, false), 0)
}

export function largeVideoBytes(library: OrganizedLibrary): number {
  return library.largeVideoGroups.reduce((sum, group) => sum + groupBytes(group, false), 0)
}

export function livePhotoBytes(library: OrganizedLibrary): number {
  return library.livePhotoGroups.reduce((sum, group) => sum + groupBytes(group, false), 0)
}

/** Similar extras, every screenshot, and every large video. Live Photos are separate. */
export function reviewableBytes(library: OrganizedLibrary): number {
  return similarExtraBytes(library) + screenshotBytes(library) + largeVideoBytes(library)
}

export function summaryFor(library: OrganizedLibrary, category: CategoryId): CategorySummary {
  switch (category) {
    case "similar": {
      const extras = library.similarGroups.reduce((sum, group) => sum + extraCount(group), 0)
      const count = library.similarGroups.length
      const countLabel =
        count === 0
          ? "None found"
          : `${count} ${count === 1 ? "group" : "groups"} · ${extras} ${extras === 1 ? "extra" : "extras"}`
      return {
        category,
        primaryCount: extras,
        countLabel,
        byteCount: similarExtraBytes(library),
      }
    }
    case "screenshots": {
      const count = library.screenshotGroups.reduce((sum, group) => sum + group.assets.length, 0)
      return {
        category,
        primaryCount: count,
        countLabel: count === 0 ? "None found" : `${count} ${count === 1 ? "screenshot" : "screenshots"}`,
        byteCount: screenshotBytes(library),
      }
    }
    case "largeVideos": {
      const count = library.largeVideoGroups.reduce((sum, group) => sum + group.assets.length, 0)
      return {
        category,
        primaryCount: count,
        countLabel: count === 0 ? "None over 50 MB" : `${count} over 50 MB`,
        byteCount: largeVideoBytes(library),
      }
    }
    case "livePhotos": {
      const count = library.livePhotoGroups.reduce((sum, group) => sum + group.assets.length, 0)
      return {
        category,
        primaryCount: count,
        countLabel: count === 0 ? "None found" : `${count} ${count === 1 ? "Live Photo" : "Live Photos"}`,
        byteCount: livePhotoBytes(library),
      }
    }
  }
}

export function selectionIds(groups: ReviewGroup[], mode: SelectionMode): Set<string> {
  const selected = new Set<string>()
  for (const group of groups) {
    for (const asset of group.assets) {
      if (mode === "all" || asset.id !== group.keepID) {
        selected.add(asset.id)
      }
    }
  }
  return selected
}

function footnote(keep: ScannedItem | undefined): string {
  if (keep?.isFavorite) return "Keep is a favorite"
  if (keep?.isBurstRepresentative) return "Keep is the burst photo"
  return "Keep is the highest resolution"
}

type AssetSort = "newestFirst" | "largestFirst"

function monthGroups(
  items: ScannedItem[],
  prefix: string,
  calendar: CalendarMode,
  sort: AssetSort,
): ReviewGroup[] {
  const order: string[] = []
  const buckets = new Map<string, { year: number; month: number; assets: ScannedItem[] }>()
  const unknown: ScannedItem[] = []

  for (const item of items) {
    if (item.createdAt == null) {
      unknown.push(item)
      continue
    }
    const { year, month } = yearMonth(item.createdAt, calendar)
    const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
    const bucket = buckets.get(key)
    if (!bucket) {
      buckets.set(key, { year, month, assets: [item] })
      order.push(key)
    } else {
      bucket.assets.push(item)
    }
  }

  const groups: ReviewGroup[] = []
  for (const key of order) {
    const bucket = buckets.get(key)
    if (!bucket || bucket.assets.length === 0) continue
    groups.push({
      id: `${prefix}-${key}`,
      title: monthTitle(bucket.year, bucket.month),
      anchorDate: null,
      footnote: null,
      assets: sorted(bucket.assets, sort),
      keepID: null,
    })
  }

  groups.sort((lhs, rhs) => (lhs.id < rhs.id ? 1 : lhs.id > rhs.id ? -1 : 0))

  if (unknown.length > 0) {
    groups.push({
      id: `${prefix}-unknown`,
      title: "Date unknown",
      anchorDate: null,
      footnote: null,
      assets: sorted(unknown, sort),
      keepID: null,
    })
  }
  return groups
}

function sorted(assets: ScannedItem[], sort: AssetSort): ScannedItem[] {
  const copy = [...assets]
  if (sort === "newestFirst") {
    copy.sort((lhs, rhs) => {
      const left = lhs.createdAt ?? Number.NEGATIVE_INFINITY
      const right = rhs.createdAt ?? Number.NEGATIVE_INFINITY
      if (left !== right) return right - left
      return lhs.id < rhs.id ? -1 : lhs.id > rhs.id ? 1 : 0
    })
    return copy
  }
  copy.sort((lhs, rhs) => {
    if (lhs.byteSize !== rhs.byteSize) return rhs.byteSize - lhs.byteSize
    const left = lhs.createdAt ?? Number.NEGATIVE_INFINITY
    const right = rhs.createdAt ?? Number.NEGATIVE_INFINITY
    if (left !== right) return right - left
    return lhs.id < rhs.id ? -1 : lhs.id > rhs.id ? 1 : 0
  })
  return copy
}

function yearMonth(ms: number, calendar: CalendarMode): { year: number; month: number } {
  const date = new Date(ms)
  if (calendar === "utc") {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

function monthTitle(year: number, month: number): string {
  if (month < 1 || month > 12) return "Unknown date"
  return `${MONTHS[month - 1]} ${year}`
}
