import { describe, expect, it } from "vitest"
import { formatBytes, formatDuration, storageSnapshot } from "@/lib/format"
import { removalListDocument, type RemovedEntry } from "@/lib/removalList"

describe("formatting", () => {
  it("formats binary file sizes", () => {
    expect(formatBytes(0)).toBe("0 bytes")
    expect(formatBytes(1)).toBe("1 byte")
    expect(formatBytes(1024)).toBe("1 KB")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB")
  })

  it("formats durations like a clock", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(65)).toBe("1:05")
    expect(formatDuration(3661)).toBe("1:01:01")
    expect(formatDuration(-5)).toBe("0:00")
  })

  it("clamps used and free space", () => {
    const snapshot = storageSnapshot(100, 40)
    expect(snapshot.freeBytes).toBe(40)
    expect(snapshot.usedBytes).toBe(60)
    expect(snapshot.usedFraction).toBeCloseTo(0.6)
    expect(snapshot.isKnown).toBe(true)

    const oversized = storageSnapshot(100, 250)
    expect(oversized.freeBytes).toBe(100)
    expect(oversized.usedBytes).toBe(0)
    expect(oversized.usedFraction).toBeCloseTo(0)

    const empty = storageSnapshot(0, 0)
    expect(empty.isKnown).toBe(false)
    expect(empty.usedFraction).toBeCloseTo(0)
    expect(storageSnapshot(0, 20).freeBytes).toBe(0)
  })

  it("writes a removal list that says the files are still on disk", () => {
    const entries: RemovedEntry[] = [
      {
        id: "1",
        name: "a.jpg",
        relativePath: "Photos/a.jpg",
        byteSize: 2048,
        removedAt: 0,
      },
    ]
    const text = removalListDocument(entries, new Date("2026-10-23T08:41:00.000Z"))
    expect(text).toContain("A browser cannot delete these files.")
    expect(text).toContain("Photos/a.jpg\t2048")
    expect(text).toContain("2026-10-23T08:41:00.000Z")
  })
})