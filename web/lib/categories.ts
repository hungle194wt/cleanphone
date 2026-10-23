import type { CategoryId } from "@/lib/organize"

export type ReviewRoute = {
  slug: string
  id: CategoryId
  title: string
  explanation: string
  emptyTitle: string
  emptyMessage: string
}

export const REVIEW_ROUTES: ReviewRoute[] = [
  {
    slug: "similar",
    id: "similar",
    title: "Similar photos",
    explanation:
      "Photos modified a few minutes apart whose thumbnails still match. Keep is the highest resolution. A browser can't see Favorites or bursts, so those only matter if a future import records them.",
    emptyTitle: "No similar photos",
    emptyMessage:
      "Nothing in this batch was close enough in time and appearance. Screenshots are left out of this list.",
  },
  {
    slug: "screenshots",
    id: "screenshots",
    title: "Screenshots",
    explanation:
      "Files with screenshot in the name, files inside a Screenshots folder, or PNGs that match a phone or tablet screen size. Grouped by month.",
    emptyTitle: "No screenshots",
    emptyMessage: "Name a file Screenshot, drop a Screenshots folder, or add a PNG at a phone screen size.",
  },
  {
    slug: "large-videos",
    id: "largeVideos",
    title: "Large videos",
    explanation: "Videos that use 50 MB or more, grouped by month with the largest first.",
    emptyTitle: "No large videos",
    emptyMessage: "Videos under 50 MB stay out of this list. They still count toward the size of the batch.",
  },
]

export function routeFor(slug: string | undefined): ReviewRoute | undefined {
  return REVIEW_ROUTES.find((route) => route.slug === slug)
}
