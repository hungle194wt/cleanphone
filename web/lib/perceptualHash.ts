/** 64-bit difference hash. Bit 0 is the top-left comparison and the least significant bit. */
export const SAMPLE_WIDTH = 9
export const SAMPLE_HEIGHT = 8

export function dHash(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): bigint | null {
  if (width < 2 || height < 1 || pixels.length < width * height) {
    return null
  }

  let bits = 0n
  let bit = 0
  for (let y = 0; y < SAMPLE_HEIGHT; y++) {
    const sourceY = Math.min(Math.floor((y * height) / SAMPLE_HEIGHT), height - 1)
    const row = sourceY * width
    for (let x = 0; x < SAMPLE_WIDTH - 1; x++) {
      const sourceX = Math.min(Math.floor((x * width) / SAMPLE_WIDTH), width - 1)
      const nextX = Math.min(Math.floor(((x + 1) * width) / SAMPLE_WIDTH), width - 1)
      if (pixels[row + sourceX] > pixels[row + nextX]) {
        bits |= 1n << BigInt(bit)
      }
      bit += 1
    }
  }
  return bits
}

export function hammingDistance(lhs: bigint, rhs: bigint): number {
  let value = lhs ^ rhs
  let count = 0
  while (value > 0n) {
    count += Number(value & 1n)
    value >>= 1n
  }
  return count
}
