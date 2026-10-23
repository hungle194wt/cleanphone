import { describe, expect, it } from "vitest"
import { dHash, hammingDistance } from "@/lib/perceptualHash"

describe("dHash", () => {
  it("hashes identical pixels to zero", () => {
    const pixels = new Array<number>(9 * 8).fill(40)
    expect(dHash(pixels, 9, 8)).toBe(0n)
    expect(hammingDistance(0n, 0n)).toBe(0)
  })

  it("sets odd bits for an alternating row", () => {
    const pixels = new Array<number>(9 * 8).fill(0)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 9; x++) {
        pixels[y * 9 + x] = x % 2 === 0 ? 10 : 20
      }
    }
    expect(dHash(pixels, 9, 8)).toBe(0xaaaaaaaaaaaaaaaan)
  })

  it("sets the high bit from the last comparison", () => {
    const pixels = new Array<number>(9 * 8).fill(0)
    pixels[7 * 9 + 7] = 20
    pixels[7 * 9 + 8] = 10
    expect(dHash(pixels, 9, 8)).toBe(1n << 63n)
  })

  it("samples a larger buffer onto the same grid", () => {
    const small = new Array<number>(9 * 8).fill(0)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 9; x++) {
        small[y * 9 + x] = (x * 17 + y * 3) % 256
      }
    }

    const large = new Array<number>(18 * 16).fill(0)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 9; x++) {
        large[2 * y * 18 + 2 * x] = small[y * 9 + x]
      }
    }

    expect(dHash(large, 18, 16)).toBe(dHash(small, 9, 8))
  })

  it("rejects unusable buffers", () => {
    expect(dHash([1, 2, 3], 9, 8)).toBeNull()
    expect(dHash([1, 2], 1, 2)).toBeNull()
    expect(dHash([], 0, 0)).toBeNull()
  })

  it("counts Hamming distance", () => {
    expect(hammingDistance(0n, (1n << 64n) - 1n)).toBe(64)
    expect(hammingDistance(0n, 0xffn)).toBe(8)
    expect(hammingDistance(0n, 0x1ffn)).toBe(9)
    expect(hammingDistance(0xabcn, 0x123n)).toBe(hammingDistance(0x123n, 0xabcn))
  })
})
