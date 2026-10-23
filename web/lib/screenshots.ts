const SCREENSHOT_NAME =
  /screenshot|screen[\s_-]?shot|screen[\s_-]?capture|截屏|截图|截圖/i

/** Phone and tablet screen sizes, in pixels. Both orientations count. */
const SCREEN_SIZES: ReadonlyArray<readonly [number, number]> = [
  [1170, 2532],
  [1179, 2556],
  [1284, 2778],
  [1290, 2796],
  [1206, 2622],
  [1320, 2868],
  [1125, 2436],
  [1242, 2688],
  [828, 1792],
  [750, 1334],
  [640, 1136],
  [1080, 1920],
  [1080, 2340],
  [1080, 2400],
  [1440, 2560],
  [1440, 3200],
  [2048, 2732],
  [1668, 2388],
  [1640, 2360],
  [1488, 2266],
  [1536, 2048],
  [1620, 2160],
]

const SCREEN_SIZE_KEYS = new Set(
  SCREEN_SIZES.flatMap(([width, height]) => [`${width}x${height}`, `${height}x${width}`]),
)

export function isScreenshotName(path: string): boolean {
  return SCREENSHOT_NAME.test(path)
}

/**
 * A file is a screenshot when its name (or a parent folder) says so,
 * or when a PNG's pixel size is exactly a known screen.
 * A JPEG that merely happens to be 1080×1920 is not flagged.
 */
export function isScreenshotFile(input: {
  name: string
  relativePath?: string
  mimeType?: string
  width: number
  height: number
}): boolean {
  const path = input.relativePath || input.name
  if (isScreenshotName(path) || isScreenshotName(input.name)) return true

  const mime = (input.mimeType ?? "").toLowerCase()
  const lowerName = input.name.toLowerCase()
  const isPng = mime === "image/png" || lowerName.endsWith(".png")
  if (!isPng || input.width < 1 || input.height < 1) return false
  return SCREEN_SIZE_KEYS.has(`${input.width}x${input.height}`)
}
