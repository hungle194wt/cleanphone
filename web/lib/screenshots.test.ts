import { describe, expect, it } from "vitest"
import { isScreenshotFile } from "@/lib/screenshots"

describe("screenshot detection", () => {
  it("matches screenshot filenames and folders", () => {
    expect(isScreenshotFile({ name: "Screenshot 2024.png", width: 10, height: 10 })).toBe(true)
    expect(isScreenshotFile({ name: "Screen-Shot-1.png", width: 10, height: 10 })).toBe(true)
    expect(isScreenshotFile({ name: "screen capture.jpg", width: 10, height: 10 })).toBe(true)
    expect(isScreenshotFile({ name: "截图.png", width: 10, height: 10 })).toBe(true)
    expect(
      isScreenshotFile({
        name: "IMG_0001.JPG",
        relativePath: "DCIM/Screenshots/IMG_0001.JPG",
        width: 10,
        height: 10,
      }),
    ).toBe(true)
  })

  it("flags a PNG whose pixels match a known screen", () => {
    expect(
      isScreenshotFile({
        name: "photo.png",
        mimeType: "image/png",
        width: 1170,
        height: 2532,
      }),
    ).toBe(true)
    expect(
      isScreenshotFile({
        name: "photo.png",
        width: 2532,
        height: 1170,
      }),
    ).toBe(true)
  })

  it("does not flag a JPEG just because the dimensions match a screen", () => {
    expect(
      isScreenshotFile({
        name: "photo.jpg",
        mimeType: "image/jpeg",
        width: 1170,
        height: 2532,
      }),
    ).toBe(false)
    expect(
      isScreenshotFile({
        name: "IMG_0001.jpg",
        width: 4000,
        height: 3000,
      }),
    ).toBe(false)
    expect(isScreenshotFile({ name: "screen.jpg", width: 100, height: 100 })).toBe(false)
  })
})
