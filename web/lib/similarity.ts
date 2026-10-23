import { hammingDistance } from "@/lib/perceptualHash"

export type SimilarityCandidate = {
  id: string
  hash: bigint
  /** Capture time, or the file's lastModified time, in milliseconds. */
  createdAt: number
  pixelCount: number
  isFavorite: boolean
  isBurstRepresentative: boolean
}

export type SimilarityCluster = {
  memberIDs: string[]
  keepID: string
}

export type SimilarityOptions = {
  maxDistance: number
  /** Seconds. Photos further apart than this are not compared. */
  comparisonWindow: number
  /** Seconds. A group wider than this is not joined. */
  maxGroupSpan: number
  maxComparisonsPerPhoto: number
}

export const defaultSimilarityOptions: SimilarityOptions = {
  maxDistance: 8,
  comparisonWindow: 180,
  maxGroupSpan: 900,
  maxComparisonsPerPhoto: 40,
}

/**
 * Groups near-duplicate photos.
 * The photo to keep is chosen in this order: favorite, burst representative,
 * higher pixel count, earlier capture, then id.
 */
export function clusters(
  items: SimilarityCandidate[],
  options: SimilarityOptions = defaultSimilarityOptions,
): SimilarityCluster[] {
  const sorted = [...items].sort((lhs, rhs) => {
    if (lhs.createdAt !== rhs.createdAt) return lhs.createdAt - rhs.createdAt
    return lhs.id < rhs.id ? -1 : lhs.id > rhs.id ? 1 : 0
  })
  const count = sorted.length
  if (count < 2) return []

  const unionFind = new UnionFind(sorted.map((item) => item.createdAt))
  const comparisonCap = Math.max(1, options.maxComparisonsPerPhoto)

  for (let index = 0; index < count; index++) {
    let other = index + 1
    let compared = 0
    while (other < count && compared < comparisonCap) {
      const gapSeconds = (sorted[other].createdAt - sorted[index].createdAt) / 1000
      if (gapSeconds > options.comparisonWindow) break
      const distance = hammingDistance(sorted[index].hash, sorted[other].hash)
      if (distance <= options.maxDistance) {
        unionFind.union(index, other, options.maxGroupSpan)
      }
      compared += 1
      other += 1
    }
  }

  const buckets = new Map<number, SimilarityCandidate[]>()
  for (let index = 0; index < count; index++) {
    const root = unionFind.find(index)
    const list = buckets.get(root)
    if (list) list.push(sorted[index])
    else buckets.set(root, [sorted[index]])
  }

  const ranked: { cluster: SimilarityCluster; earliest: number }[] = []
  for (const members of buckets.values()) {
    if (members.length < 2) continue
    const keep = members.reduce((best, item) => (isWorse(best, item) ? item : best))
    const ordered = [...members].sort((lhs, rhs) => {
      if (lhs.createdAt !== rhs.createdAt) return lhs.createdAt - rhs.createdAt
      return lhs.id < rhs.id ? -1 : lhs.id > rhs.id ? 1 : 0
    })
    ranked.push({
      cluster: { memberIDs: ordered.map((item) => item.id), keepID: keep.id },
      earliest: ordered[0].createdAt,
    })
  }

  ranked.sort((lhs, rhs) => {
    if (lhs.earliest !== rhs.earliest) return rhs.earliest - lhs.earliest
    return lhs.cluster.keepID < rhs.cluster.keepID
      ? -1
      : lhs.cluster.keepID > rhs.cluster.keepID
        ? 1
        : 0
  })
  return ranked.map((entry) => entry.cluster)
}

/** Whether `lhs` is a worse photo to keep than `rhs`. */
export function isWorse(lhs: SimilarityCandidate, rhs: SimilarityCandidate): boolean {
  if (lhs.isFavorite !== rhs.isFavorite) return rhs.isFavorite
  if (lhs.isBurstRepresentative !== rhs.isBurstRepresentative) return rhs.isBurstRepresentative
  if (lhs.pixelCount !== rhs.pixelCount) return lhs.pixelCount < rhs.pixelCount
  if (lhs.createdAt !== rhs.createdAt) return lhs.createdAt > rhs.createdAt
  return lhs.id > rhs.id
}

class UnionFind {
  private parent: number[]
  private rank: number[]
  private minimumDate: number[]
  private maximumDate: number[]

  constructor(dates: number[]) {
    this.parent = dates.map((_, index) => index)
    this.rank = dates.map(() => 0)
    this.minimumDate = [...dates]
    this.maximumDate = [...dates]
  }

  find(index: number): number {
    let current = index
    while (this.parent[current] !== current) {
      this.parent[current] = this.parent[this.parent[current]]
      current = this.parent[current]
    }
    return current
  }

  /** Joins two sets when the combined capture span stays within `maxSpan` seconds. */
  union(lhs: number, rhs: number, maxSpan: number): boolean {
    const leftRoot = this.find(lhs)
    const rightRoot = this.find(rhs)
    if (leftRoot === rightRoot) return true

    const lower = Math.min(this.minimumDate[leftRoot], this.minimumDate[rightRoot])
    const upper = Math.max(this.maximumDate[leftRoot], this.maximumDate[rightRoot])
    if ((upper - lower) / 1000 > maxSpan) return false

    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      this.parent[leftRoot] = rightRoot
      this.minimumDate[rightRoot] = lower
      this.maximumDate[rightRoot] = upper
    } else if (this.rank[leftRoot] > this.rank[rightRoot]) {
      this.parent[rightRoot] = leftRoot
      this.minimumDate[leftRoot] = lower
      this.maximumDate[leftRoot] = upper
    } else {
      this.parent[rightRoot] = leftRoot
      this.rank[leftRoot] += 1
      this.minimumDate[leftRoot] = lower
      this.maximumDate[leftRoot] = upper
    }
    return true
  }
}
