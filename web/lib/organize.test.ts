import { describe, expect, it } from "vitest"
import {
  emptyLibrary,
  LARGE_VIDEO_MINIMUM_BYTES,
  livePhotoBytes,
  organize,
  reviewableBytes,
  selectionIds,
  similarExtraBytes,
  summaryFor,
  type ReviewGroup,
} from "@/lib/organize"
import type { ScannedItem } from "@/lib/types"

function date(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

function photo(
  id: string,
  createdAt: number | null,
  bytes: number,
  options?: {
    pixels?: number
    hash?: bigint | null
    favorite?: boolean
    burst?: boolean
    screenshot?: boolean
    live?: boolean
  },
): ScannedItem {
  const pixels = options?.pixels ?? 100
  return {
    id,
    createdAt,
    pixelWidth: pixels,
    pixelHeight: 1,
    duration: 0,
    byteSize: bytes,
    isFavorite: options?.favorite ?? false,
    isBurstRepresentative: options?.burst ?? false,
    isScreenshot: options?.screenshot ?? false,
    isLivePhoto: options?.live ?? false,
    kind: "photo",
    hash: options && "hash" in options ? (options.hash ?? null) : null,
  }
}

function video(id: string, createdAt: number | null, bytes: number, duration = 30): ScannedItem {
  return {
    id,
    createdAt,
    pixelWidth: 1920,
    pixelHeight: 1080,
    duration,
    byteSize: bytes,
    isFavorite: false,
    isBurstRepresentative: false,
    isScreenshot: false,
    isLivePhoto: false,
    kind: "video",
    hash: null,
  }
}

describe("library organizer", () => {
  it("splits categories and counts reviewable bytes", () => {
    const moment = date(2024, 5, 1, 12, 0, 0)
    const library = organize(
      [
        photo("small", moment, 100, { pixels: 10, hash: 0n }),
        photo("large", moment + 30_000, 400, { pixels: 99, hash: 0n }),
        photo("s-may", moment, 50, { hash: 0n, screenshot: true }),
        photo("s-march", date(2024, 3, 2, 8, 0, 0), 70, { screenshot: true }),
        video("v-small", moment, LARGE_VIDEO_MINIMUM_BYTES - 1),
        video("v-big", date(2024, 8, 1, 1, 0, 0), LARGE_VIDEO_MINIMUM_BYTES, 40),
        video("v-bigger", date(2024, 8, 2, 1, 0, 0), LARGE_VIDEO_MINIMUM_BYTES + 10, 80),
        photo("live", date(2024, 1, 4, 1, 0, 0), 80, { hash: 7n, live: true }),
        photo("undated", null, 15, { hash: 0n }),
        photo("unhashed", moment, 15, { hash: null }),
      ],
      { calendar: "utc" },
    )

    expect(library.similarGroups).toHaveLength(1)
    expect(library.similarGroups[0].title).toBe("2 similar")
    expect(library.similarGroups[0].keepID).toBe("large")
    expect(library.similarGroups[0].footnote).toBe("Keep is the highest resolution")
    expect(library.similarGroups[0].assets.map((asset) => asset.id)).toEqual(["small", "large"])
    expect(similarExtraBytes(library)).toBe(100)

    expect(library.screenshotGroups.map((group) => group.title)).toEqual(["May 2024", "March 2024"])
    expect(library.screenshotGroups[0].assets.map((asset) => asset.id)).toEqual(["s-may"])
    expect(library.screenshotGroups.reduce((sum, group) => sum + group.assets.reduce((inner, asset) => inner + asset.byteSize, 0), 0)).toBe(120)

    expect(library.largeVideoGroups.map((group) => group.title)).toEqual(["August 2024"])
    expect(library.largeVideoGroups[0].assets.map((asset) => asset.id)).toEqual(["v-bigger", "v-big"])
    expect(
      library.largeVideoGroups[0].assets.reduce((sum, asset) => sum + asset.byteSize, 0),
    ).toBe(LARGE_VIDEO_MINIMUM_BYTES * 2 + 10)

    expect(library.livePhotoGroups.map((group) => group.title)).toEqual(["January 2024"])
    expect(livePhotoBytes(library)).toBe(80)
    expect(reviewableBytes(library)).toBe(100 + 120 + LARGE_VIDEO_MINIMUM_BYTES * 2 + 10)

    expect(summaryFor(library, "similar").countLabel).toBe("1 group · 1 extra")
    expect(summaryFor(library, "screenshots").countLabel).toBe("2 screenshots")
    expect(summaryFor(library, "largeVideos").countLabel).toBe("2 over 50 MB")
    expect(summaryFor(library, "livePhotos").countLabel).toBe("1 Live Photo")
  })

  it("explains favorite and burst keeps", () => {
    const moment = date(2024, 7, 1, 9, 0, 0)
    const favoriteLibrary = organize(
      [
        photo("big", moment, 10, { pixels: 500, hash: 1n }),
        photo("fav", moment + 4000, 10, { pixels: 5, hash: 1n, favorite: true }),
      ],
      { calendar: "utc" },
    )
    expect(favoriteLibrary.similarGroups[0]?.keepID).toBe("fav")
    expect(favoriteLibrary.similarGroups[0]?.footnote).toBe("Keep is a favorite")

    const burstLibrary = organize(
      [
        photo("big", moment, 10, { pixels: 500, hash: 1n }),
        photo("rep", moment + 4000, 10, { pixels: 5, hash: 1n, burst: true }),
      ],
      { calendar: "utc" },
    )
    expect(burstLibrary.similarGroups[0]?.keepID).toBe("rep")
    expect(burstLibrary.similarGroups[0]?.footnote).toBe("Keep is the burst photo")
  })

  it("can list live photos as similar without double counting the keep", () => {
    const moment = date(2024, 4, 2, 10, 0, 0)
    const library = organize(
      [
        photo("p1", moment, 30, { pixels: 10, hash: 0n, live: true }),
        photo("p2", moment + 5000, 90, { pixels: 20, hash: 0n, live: true }),
      ],
      { calendar: "utc" },
    )
    expect(library.similarGroups[0]?.keepID).toBe("p2")
    expect(similarExtraBytes(library)).toBe(30)
    expect(livePhotoBytes(library)).toBe(120)
    expect(reviewableBytes(library)).toBe(30)
    expect(library.livePhotoGroups.flatMap((group) => group.assets.map((asset) => asset.id)).sort()).toEqual([
      "p1",
      "p2",
    ])
  })

  it("sorts screenshots in a month newest first", () => {
    const library = organize(
      [
        photo("older", date(2024, 6, 1, 8, 0, 0), 500, { screenshot: true }),
        photo("newer", date(2024, 6, 20, 8, 0, 0), 5, { screenshot: true }),
      ],
      { calendar: "utc" },
    )
    expect(library.screenshotGroups.map((group) => group.title)).toEqual(["June 2024"])
    expect(library.screenshotGroups[0].assets.map((asset) => asset.id)).toEqual(["newer", "older"])
  })

  it("puts the unknown date section last", () => {
    const library = organize(
      [
        photo("unknown", null, 2, { screenshot: true }),
        photo("dated", date(2024, 2, 1, 0, 0, 0), 1, { screenshot: true }),
      ],
      { calendar: "utc" },
    )
    expect(library.screenshotGroups.map((group) => group.title)).toEqual(["February 2024", "Date unknown"])
    expect(library.screenshotGroups[1].assets.map((asset) => asset.id)).toEqual(["unknown"])
  })

  it("starts empty", () => {
    const library = organize([], { calendar: "utc" })
    expect(library).toEqual(emptyLibrary)
    expect(reviewableBytes(library)).toBe(0)
    expect(summaryFor(library, "similar").countLabel).toBe("None found")
    expect(summaryFor(library, "screenshots").countLabel).toBe("None found")
    expect(summaryFor(library, "largeVideos").countLabel).toBe("None over 50 MB")
    expect(summaryFor(library, "livePhotos").countLabel).toBe("None found")
  })

  it("skips the keep when selecting extras", () => {
    const keep = photo("keep", date(2024, 1, 1, 0, 0, 0), 10)
    const extra = photo("extra", date(2024, 1, 1, 0, 1, 0), 20)
    const similar: ReviewGroup = {
      id: "similar-keep",
      title: "2 similar",
      anchorDate: keep.createdAt,
      footnote: null,
      assets: [keep, extra],
      keepID: keep.id,
    }
    const month: ReviewGroup = {
      id: "screenshots-2024-01",
      title: "January 2024",
      anchorDate: null,
      footnote: null,
      assets: [keep, extra],
      keepID: null,
    }

    expect(selectionIds([similar], "exceptBest")).toEqual(new Set(["extra"]))
    expect(selectionIds([similar], "all")).toEqual(new Set(["keep", "extra"]))
    expect(selectionIds([month], "exceptBest")).toEqual(new Set(["keep", "extra"]))
    expect(selectionIds([similar, month], "exceptBest")).toEqual(new Set(["keep", "extra"]))
  })
})
