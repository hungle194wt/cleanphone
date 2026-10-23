"use client"

import Link from "next/link"
import { Camera, ChevronRight, Clapperboard, FolderOpen, Images, Layers } from "lucide-react"
import { AppHeader, DropOverlay } from "@/components/app-header"
import { StorageRing } from "@/components/storage-ring"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useLibrary } from "@/components/library-provider"
import { REVIEW_ROUTES, type ReviewRoute } from "@/lib/categories"
import { formatBytes } from "@/lib/format"
import { groupsFor, reviewableBytes, summaryFor, type CategoryId } from "@/lib/organize"

const ICONS: Record<CategoryId, typeof Layers> = {
  similar: Layers,
  screenshots: Camera,
  largeVideos: Clapperboard,
  livePhotos: Images,
}

export function Dashboard() {
  const library = useLibrary()
  const { items, organized, phase, notice, dragging, removed } = library
  const totalBytes = items.reduce((sum, item) => sum + item.byteSize, 0)
  const reclaimable = reviewableBytes(organized)
  const fraction = totalBytes > 0 ? Math.min(1, reclaimable / totalBytes) : 0
  const flagged = new Set(
    [...organized.similarGroups, ...organized.screenshotGroups, ...organized.largeVideoGroups].flatMap(
      (group) => group.assets.map((asset) => asset.id),
    ),
  )
  const otherCount = items.filter((item) => !flagged.has(item.id)).length
  const scanning = phase.status === "running"

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader title="CleanPhone" />
      <DropOverlay visible={dragging} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
        {notice ? <Notice /> : null}

        {items.length === 0 && !scanning ? <EmptyImport /> : null}
        {scanning ? <ProgressCard /> : null}

        {items.length > 0 ? (
          <>
            <section
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 sm:gap-5 sm:p-5"
              aria-label={`${formatBytes(reclaimable)} to review out of ${formatBytes(totalBytes)} in this batch`}
            >
              <StorageRing fraction={fraction} />
              <div className="min-w-0">
                <p className="text-[1.65rem] leading-tight font-semibold tracking-tight tabular-nums">
                  {reclaimable === 0 ? "Nothing stands out" : formatBytes(reclaimable)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                  {reclaimable === 0 ? "in this batch" : "to review in this batch"}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {formatBytes(totalBytes)} opened
                  {items.length === 1 ? " · 1 file" : ` · ${items.length} files`}. This ring is the
                  batch you opened, not your phone. Browsers can&apos;t see device storage.
                </p>
              </div>
            </section>

            <div className="px-1">
              <p className="text-sm leading-6 text-muted-foreground">
                {reclaimable === 0
                  ? "No similar extras, screenshots, or videos of 50 MB or more."
                  : "Similar extras, screenshots, and large videos, if you set all of them aside. Removing them here does not delete them from your computer."}
              </p>
              {otherCount > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {otherCount === 1
                    ? "1 file is in the batch but not in a review category."
                    : `${otherCount} files are in the batch but not in a review category.`}
                </p>
              ) : null}
            </div>

            <section className="space-y-2.5">
              <h2 className="px-1 text-lg font-semibold">Library</h2>
              {REVIEW_ROUTES.map((route) => (
                <CategoryCard key={route.slug} route={route} />
              ))}
            </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" className="h-11" onClick={library.openFiles} disabled={scanning}>
                <Images />
                Add photos and videos
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={library.openFolder}
                disabled={scanning}
              >
                <FolderOpen />
                Add a folder
              </Button>
              {removed.length > 0 ? (
                <Button type="button" variant="outline" className="h-11" onClick={library.downloadRemoved}>
                  Download removal list ({removed.length})
                </Button>
              ) : null}
              <ClearBatchButton disabled={scanning} />
            </div>
          </>
        ) : null}

        <p className="mt-auto px-1 pt-2 text-xs leading-5 text-muted-foreground">
          Files stay in this browser tab. Nothing is uploaded. A browser cannot delete local files —
          download the removal list and delete them yourself.
        </p>
      </main>
    </div>
  )
}

function CategoryCard({ route }: { route: ReviewRoute }) {
  const { organized } = useLibrary()
  const summary = summaryFor(organized, route.id)
  const Icon = ICONS[route.id]
  const empty = groupsFor(organized, route.id).length === 0

  return (
    <Link
      href={`/review/${route.slug}`}
      className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3.5 transition active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{route.title}</span>
        <span className="block text-sm text-muted-foreground">{summary.countLabel}</span>
        <span className="mt-0.5 block text-sm font-semibold text-primary tabular-nums">
          {empty ? formatBytes(0) : formatBytes(summary.byteCount)}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}

function EmptyImport() {
  const { openFiles, openFolder, phase } = useLibrary()
  const message = phase.status === "error" ? phase.message : null

  return (
    <section className="rounded-[28px] border border-dashed border-primary/45 bg-card px-5 py-10 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-primary/12 text-primary">
        <Images className="size-7" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">Review a folder of photos</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Drop photos and videos here, or choose a folder. CleanPhone compares them on this device and
        never uploads them.
      </p>
      {message ? <p className="mt-3 text-sm font-medium text-destructive">{message}</p> : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button type="button" className="h-11" onClick={openFiles}>
          Choose photos and videos
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={openFolder}>
          <FolderOpen />
          Choose a folder
        </Button>
      </div>
    </section>
  )
}

function ProgressCard() {
  const { phase, cancelScan } = useLibrary()
  if (phase.status !== "running") return null
  const percent = phase.total === 0 ? 0 : Math.round((phase.completed / phase.total) * 100)

  return (
    <section className="rounded-3xl border border-border bg-card p-4" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Checking files</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {phase.completed} / {phase.total}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">{phase.label}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <Button type="button" variant="outline" className="mt-3 h-10" onClick={cancelScan}>
        Cancel
      </Button>
    </section>
  )
}

function Notice() {
  const { notice, dismissNotice, removed, downloadRemoved } = useLibrary()
  if (!notice) return null
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm" role="status">
      <p>{notice}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {removed.length > 0 ? (
          <Button type="button" size="sm" className="h-9" onClick={downloadRemoved}>
            Download removal list
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={dismissNotice}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function ClearBatchButton({ disabled }: { disabled: boolean }) {
  const { clearBatch } = useLibrary()
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="ghost" className="h-11" disabled={disabled} />}
      >
        Clear batch
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear this batch?</DialogTitle>
          <DialogDescription>
            This forgets the files and the removal list in this tab. Nothing on your computer is deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button type="button" variant="destructive" onClick={clearBatch} />}>
            Clear batch
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
