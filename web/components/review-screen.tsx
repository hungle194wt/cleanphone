"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { AppHeader, DropOverlay } from "@/components/app-header"
import { useLibrary } from "@/components/library-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { routeFor } from "@/lib/categories"
import { formatBytes, formatDuration, formatWhen } from "@/lib/format"
import {
  extraCount,
  groupBytes,
  groupsFor,
  selectionIds,
  summaryFor,
  type ReviewGroup,
} from "@/lib/organize"
import { downloadRemovalList } from "@/lib/removalList"
import type { MediaItem } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ReviewScreen() {
  const params = useParams<{ category: string }>()
  const slug = Array.isArray(params.category) ? params.category[0] : params.category
  const route = routeFor(slug)
  const library = useLibrary()
  const groups = useMemo(
    () => (route ? groupsFor(library.organized, route.id) : []),
    [library.organized, route],
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [downloadToo, setDownloadToo] = useState(true)

  const visibleIds = useMemo(
    () => new Set(groups.flatMap((group) => group.assets.map((asset) => asset.id))),
    [groups],
  )
  const activeSelection = useMemo(() => {
    const next = new Set<string>()
    for (const id of selected) {
      if (visibleIds.has(id)) next.add(id)
    }
    return next
  }, [selected, visibleIds])

  const byId = useMemo(() => new Map(library.items.map((item) => [item.id, item])), [library.items])
  const selectedItems = library.items.filter((item) => activeSelection.has(item.id))
  const selectedBytes = selectedItems.reduce((sum, item) => sum + item.byteSize, 0)

  if (!route) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader title="Review" backHref="/" />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-sm text-muted-foreground">That review list doesn&apos;t exist.</p>
        </main>
      </div>
    )
  }

  const summary = summaryFor(library.organized, route.id)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(group: ReviewGroup) {
    const ids = group.assets.filter((asset) => asset.id !== group.keepID).map((asset) => asset.id)
    setSelected((current) => {
      const next = new Set(current)
      const allOn = ids.length > 0 && ids.every((id) => next.has(id))
      for (const id of ids) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  function confirmRemove() {
    const nextRemoved = library.removeItems([...activeSelection])
    setSelected(new Set())
    setConfirmOpen(false)
    if (downloadToo) downloadRemovalList(nextRemoved)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader title={route.title} backHref="/" />
      <DropOverlay visible={library.dragging} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
        {library.notice ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm" role="status">
            <p>{library.notice}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {library.removed.length > 0 ? (
                <Button type="button" size="sm" className="h-9" onClick={library.downloadRemoved}>
                  Download removal list
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={library.dismissNotice}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
        <p className="text-sm leading-6 text-muted-foreground">{route.explanation}</p>
        <p className="rounded-2xl border border-border bg-card px-3.5 py-3 text-sm leading-6 text-muted-foreground">
          Browsers can&apos;t delete files on your computer. Removing a file only takes it out of this
          review and adds it to a list you can download.
        </p>

        {groups.length === 0 ? (
          <section className="rounded-3xl border border-border bg-card px-5 py-10 text-center">
            <h2 className="text-lg font-semibold">{route.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{route.emptyMessage}</p>
          </section>
        ) : (
          <>
            <p className="px-1 text-sm font-semibold text-primary tabular-nums">
              {summary.countLabel} · {formatBytes(summary.byteCount)}
            </p>
            <div className="flex flex-wrap gap-2">
              {route.id === "similar" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => setSelected(selectionIds(groups, "exceptBest"))}
                >
                  Select all except best
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setSelected(selectionIds(groups, "all"))}
              >
                Select all
              </Button>
              <Button type="button" variant="ghost" className="h-10" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </div>
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                byId={byId}
                selected={activeSelection}
                onToggle={toggle}
                onToggleGroup={() => toggleGroup(group)}
              />
            ))}
          </>
        )}
      </main>

      <div className="sticky bottom-0 z-20 mt-auto border-t border-border bg-background/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="font-medium tabular-nums">
              {activeSelection.size === 0
                ? "Nothing selected"
                : `${activeSelection.size} selected · ${formatBytes(selectedBytes)}`}
            </p>
            <p className="text-xs text-muted-foreground">Still on your computer until you delete them yourself.</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="h-11 shrink-0"
            disabled={activeSelection.size === 0}
            onClick={() => {
              setDownloadToo(true)
              setConfirmOpen(true)
            }}
          >
            Remove from review
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from this review?</DialogTitle>
            <DialogDescription>
              {activeSelection.size === 1 ? "1 file" : `${activeSelection.size} files`} (
              {formatBytes(selectedBytes)}) will leave this list. A browser cannot delete them from
              your computer.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm leading-5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={downloadToo}
              onChange={(event) => setDownloadToo(event.target.checked)}
            />
            Download a text list of every file removed in this tab, so you can delete them in Finder,
            Files, or Explorer.
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRemove}>
              Remove from review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GroupCard({
  group,
  byId,
  selected,
  onToggle,
  onToggleGroup,
}: {
  group: ReviewGroup
  byId: Map<string, MediaItem>
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleGroup: () => void
}) {
  const targetIds = group.assets.filter((asset) => asset.id !== group.keepID).map((asset) => asset.id)
  const allOn = targetIds.length > 0 && targetIds.every((id) => selected.has(id))
  const sizeLabel = group.keepID
    ? `${formatBytes(groupBytes(group, true))} in extras`
    : formatBytes(groupBytes(group, false))

  return (
    <section className="rounded-3xl border border-border bg-card p-3 sm:p-3.5">
      <div className="flex items-start gap-3 px-1 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{group.title}</h2>
          {group.anchorDate != null ? (
            <p className="text-xs text-muted-foreground">{formatWhen(group.anchorDate)}</p>
          ) : null}
          {group.footnote ? <p className="text-xs text-muted-foreground">{group.footnote}</p> : null}
          {group.keepID ? (
            <p className="text-xs text-muted-foreground">
              {extraCount(group)} {extraCount(group) === 1 ? "extra" : "extras"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-xs font-semibold text-primary tabular-nums">{sizeLabel}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            disabled={targetIds.length === 0}
            onClick={onToggleGroup}
          >
            {allOn ? "Clear" : group.keepID ? "Select extras" : "Select all"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
        {group.assets.map((asset) => {
          const media = byId.get(asset.id)
          if (!media) return null
          return (
            <Thumb
              key={asset.id}
              item={media}
              selected={selected.has(asset.id)}
              isKeep={asset.id === group.keepID}
              onToggle={() => onToggle(asset.id)}
            />
          )
        })}
      </div>
    </section>
  )
}

function Thumb({
  item,
  selected,
  isKeep,
  onToggle,
}: {
  item: MediaItem
  selected: boolean
  isKeep: boolean
  onToggle: () => void
}) {
  const [broken, setBroken] = useState(false)
  const showPreview = Boolean(item.previewUrl) && !broken

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${item.name}${isKeep ? ", suggested keep" : ""}`}
      className={cn(
        "relative aspect-square overflow-hidden rounded-xl bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring",
        selected && "ring-2 ring-primary",
      )}
    >
      {showPreview && item.kind === "video" ? (
        <video
          src={item.previewUrl ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
      {showPreview && item.kind === "photo" ? (
        // Object URLs from the local file picker cannot go through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.previewUrl ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
      {!showPreview ? (
        <span className="grid size-full place-items-center px-2 text-center text-[11px] text-muted-foreground">
          {item.name}
        </span>
      ) : null}
      {isKeep ? (
        <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          Keep
        </span>
      ) : null}
      <span
        className={cn(
          "absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border text-[11px] font-semibold",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/80 bg-black/35 text-transparent",
        )}
        aria-hidden
      >
        ✓
      </span>
      {item.kind === "video" && item.duration > 0 ? (
        <span className="absolute right-1.5 bottom-7 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
          {formatDuration(item.duration)}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pt-5 pb-1 text-[11px] leading-tight text-white">
        <span className="block truncate">{item.name}</span>
        <span className="tabular-nums opacity-90">{formatBytes(item.byteSize)}</span>
      </span>
    </button>
  )
}
