import { describe, expect, it } from "vitest"
import {
  clusters,
  type SimilarityCandidate,
  type SimilarityOptions,
} from "@/lib/similarity"

const origin = 1_700_000_000_000

function candidate(
  id: string,
  hash: bigint,
  seconds: number,
  pixels = 100,
  favorite = false,
  burst = false,
): SimilarityCandidate {
  return {
    id,
    hash,
    createdAt: origin + seconds * 1000,
    pixelCount: pixels,
    isFavorite: favorite,
    isBurstRepresentative: burst,
  }
}

const strict: SimilarityOptions = {
  maxDistance: 8,
  comparisonWindow: 180,
  maxGroupSpan: 900,
  maxComparisonsPerPhoto: 40,
}

describe("similarity clusters", () => {
  it("returns nothing for empty and singleton inputs", () => {
    expect(clusters([])).toEqual([])
    expect(clusters([candidate("only", 0n, 0)])).toEqual([])
  })

  it("keeps the higher resolution photo", () => {
    const grouped = clusters([
      candidate("small", 0n, 0, 100),
      candidate("large", 0n, 12, 4000),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].keepID).toBe("large")
    expect(grouped[0].memberIDs).toEqual(["small", "large"])
  })

  it("lets a favorite beat resolution and burst", () => {
    const grouped = clusters([
      candidate("big", 0n, 0, 9000),
      candidate("rep", 0n, 5, 8000, false, true),
      candidate("fav", 0n, 9, 10, true),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].keepID).toBe("fav")
  })

  it("lets a burst representative beat resolution", () => {
    const grouped = clusters([
      candidate("big", 4n, 0, 9000),
      candidate("rep", 4n, 3, 20, false, true),
    ])
    expect(grouped[0].keepID).toBe("rep")
  })

  it("keeps the earlier photo when quality ties", () => {
    const grouped = clusters([
      candidate("later", 0n, 20, 100),
      candidate("earlier", 0n, 5, 100),
    ])
    expect(grouped[0].keepID).toBe("earlier")
    expect(grouped[0].memberIDs).toEqual(["earlier", "later"])
  })

  it("breaks remaining ties with the identifier", () => {
    const grouped = clusters([
      candidate("b", 0n, 10, 100),
      candidate("a", 0n, 10, 100),
    ])
    expect(grouped[0].keepID).toBe("a")
    expect(grouped[0].memberIDs).toEqual(["a", "b"])
  })

  it("separates matches outside the time window", () => {
    expect(clusters([candidate("a", 0n, 0), candidate("b", 0n, 181)])).toEqual([])
    expect(clusters([candidate("a", 0n, 0), candidate("b", 0n, 180)])).toHaveLength(1)
  })

  it("uses the Hamming threshold", () => {
    expect(
      clusters([candidate("a", 0n, 0), candidate("b", 0xffn, 8)], strict),
    ).toHaveLength(1)
    expect(clusters([candidate("a", 0n, 0), candidate("b", 0x1ffn, 8)], strict)).toEqual([])
  })

  it("chains photos that stay inside the span", () => {
    const grouped = clusters(
      [candidate("c", 0n, 200), candidate("a", 0n, 0), candidate("b", 0n, 100)],
      { maxDistance: 8, comparisonWindow: 150, maxGroupSpan: 1000, maxComparisonsPerPhoto: 40 },
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0].memberIDs).toEqual(["a", "b", "c"])
  })

  it("splits a chain that would exceed the span", () => {
    const grouped = clusters(
      [candidate("a", 0n, 0), candidate("b", 0n, 80), candidate("c", 0n, 160)],
      { maxDistance: 8, comparisonWindow: 100, maxGroupSpan: 150, maxComparisonsPerPhoto: 40 },
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0].memberIDs).toEqual(["a", "b"])
  })

  it("lists the newest cluster first", () => {
    const grouped = clusters([
      candidate("e1", 0n, 0, 10),
      candidate("e2", 0n, 10, 20),
      candidate("l1", 0n, 5000, 10),
      candidate("l2", 0n, 5010, 30),
    ])
    expect(grouped.map((cluster) => cluster.memberIDs)).toEqual([
      ["l1", "l2"],
      ["e1", "e2"],
    ])
    expect(grouped.map((cluster) => cluster.keepID)).toEqual(["l2", "e2"])
  })

  it("still chains a burst when each photo has a comparison cap", () => {
    const items = [candidate("fav", 0n, 0, 1, true)]
    for (let index = 0; index < 120; index++) {
      items.push(candidate(`p${index}`, 0n, 0, 50 + index))
    }
    const grouped = clusters(items)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].memberIDs).toHaveLength(121)
    expect(grouped[0].keepID).toBe("fav")
  })
})
