"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { formatBytes } from "@/lib/format"
import { organize, type OrganizedLibrary } from "@/lib/organize"
import {
  downloadRemovalList,
  type RemovedEntry,
} from "@/lib/removalList"
import {
  filesFromDataTransfer,
  filesFromList,
  inspectFiles,
  mediaId,
  mediaKind,
  type ImportedFile,
} from "@/lib/scan"
import type { MediaItem } from "@/lib/types"

export type ScanPhase =
  | { status: "idle" }
  | { status: "running"; completed: number; total: number; label: string }
  | { status: "ready" }
  | { status: "error"; message: string }

type LibraryContextValue = {
  items: MediaItem[]
  removed: RemovedEntry[]
  phase: ScanPhase
  notice: string | null
  dragging: boolean
  organized: OrganizedLibrary
  openFiles: () => void
  openFolder: () => void
  clearBatch: () => void
  removeItems: (ids: string[]) => RemovedEntry[]
  dismissNotice: () => void
  cancelScan: () => void
  downloadRemoved: () => void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [removed, setRemoved] = useState<RemovedEntry[]>([])
  const [phase, setPhase] = useState<ScanPhase>({ status: "idle" })
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const itemsRef = useRef(items)
  const removedRef = useRef(removed)
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)

  const organized = useMemo(() => organize(items, { calendar: "local" }), [items])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    removedRef.current = removed
  }, [removed])

  const importFiles = useCallback(async (imported: ImportedFile[]) => {
    if (runningRef.current) {
      setNotice("Wait for the current check to finish, then add more files.")
      return
    }

    const existing = new Set(itemsRef.current.map((item) => item.id))
    const fresh = imported.filter((input) => !existing.has(mediaId(input.file, input.relativePath)))
    const media = fresh.filter((input) => mediaKind(input.file.name, input.file.type) != null)

    if (media.length === 0) {
      if (itemsRef.current.length === 0) {
        setPhase({
          status: "error",
          message: "No photos or videos were in that selection.",
        })
      }
      setNotice(
        imported.length === 0
          ? "Nothing was added."
          : "Those files are already in this batch, or none of them are photos or videos.",
      )
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    runningRef.current = true
    setNotice(null)
    setPhase({ status: "running", completed: 0, total: media.length, label: "Starting" })

    try {
      const found = await inspectFiles(
        media,
        (progress) => setPhase({ status: "running", ...progress }),
        controller.signal,
      )
      const seen = new Set(itemsRef.current.map((item) => item.id))
      const next = [...itemsRef.current]
      for (const item of found) {
        if (seen.has(item.id)) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
          continue
        }
        seen.add(item.id)
        next.push(item)
      }
      itemsRef.current = next
      setItems(next)
      setPhase({ status: "ready" })
      if (found.length === 0) {
        setNotice("Those files could not be read as photos or videos.")
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("Check cancelled. Files already in the batch were kept.")
        setPhase(itemsRef.current.length > 0 ? { status: "ready" } : { status: "idle" })
        return
      }
      setPhase({
        status: "error",
        message: error instanceof Error ? error.message : "The files could not be read.",
      })
    } finally {
      runningRef.current = false
      abortRef.current = null
    }
  }, [])

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearBatch = useCallback(() => {
    abortRef.current?.abort()
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    itemsRef.current = []
    removedRef.current = []
    setItems([])
    setRemoved([])
    setNotice(null)
    setPhase({ status: "idle" })
  }, [])

  const removeItems = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    const staying: MediaItem[] = []
    const removedNow: RemovedEntry[] = []
    const removedAt = Date.now()
    for (const item of itemsRef.current) {
      if (!idSet.has(item.id)) {
        staying.push(item)
        continue
      }
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      removedNow.push({
        id: item.id,
        name: item.name,
        relativePath: item.relativePath,
        byteSize: item.byteSize,
        removedAt,
      })
    }
    const nextRemoved = [...removedRef.current, ...removedNow]
    itemsRef.current = staying
    removedRef.current = nextRemoved
    setItems(staying)
    setRemoved(nextRemoved)
    const bytes = removedNow.reduce((sum, entry) => sum + entry.byteSize, 0)
    setNotice(
      removedNow.length === 0
        ? "Nothing was selected."
        : `Removed ${removedNow.length} ${removedNow.length === 1 ? "file" : "files"} (${formatBytes(bytes)}) from this review. They are still on your computer.`,
    )
    return nextRemoved
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])
  const downloadRemoved = useCallback(() => downloadRemovalList(removedRef.current), [])
  const openFiles = useCallback(() => fileInputRef.current?.click(), [])
  const openFolder = useCallback(() => folderInputRef.current?.click(), [])

  useEffect(() => {
    const folder = folderInputRef.current
    folder?.setAttribute("webkitdirectory", "")
    folder?.setAttribute("directory", "")
  }, [])

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy"
      if (!draggingRef.current) {
        draggingRef.current = true
        setDragging(true)
      }
    }
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null && draggingRef.current) {
        draggingRef.current = false
        setDragging(false)
      }
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      draggingRef.current = false
      setDragging(false)
      const data = event.dataTransfer
      void filesFromDataTransfer(data).then((files) => importFiles(files))
    }
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [importFiles])

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [])

  const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files
    if (list && list.length > 0) void importFiles(filesFromList(list))
    event.target.value = ""
  }

  const value: LibraryContextValue = {
    items,
    removed,
    phase,
    notice,
    dragging,
    organized,
    openFiles,
    openFolder,
    clearBatch,
    removeItems,
    dismissNotice,
    cancelScan,
    downloadRemoved,
  }

  return (
    <LibraryContext.Provider value={value}>
      {children}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v,.webm"
        multiple
        className="sr-only"
        onChange={onInput}
      />
      <input ref={folderInputRef} type="file" multiple className="sr-only" onChange={onInput} />
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext)
  if (!value) throw new Error("useLibrary must be used within LibraryProvider")
  return value
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types
  if (!types) return false
  return [...types].includes("Files")
}
