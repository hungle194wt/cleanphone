"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Info, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function AppHeader({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-1 px-3 sm:px-4">
        {backHref ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Back"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft />
          </Button>
        ) : (
          <span className="mx-2 size-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
        <ThemeToggle />
        <AboutDialog />
      </div>
    </header>
  )
}

function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10"
      aria-label="Switch color theme"
      onClick={() => {
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark"
        document.documentElement.classList.toggle("dark", next === "dark")
        localStorage.setItem("cleanphone-theme", next)
      }}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  )
}

function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="ghost" size="icon" className="size-10" aria-label="About CleanPhone" />}
      >
        <Info />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About this demo</DialogTitle>
          <DialogDescription>
            CleanPhone reviews a batch of photos and videos in the browser. It is a web version of the on-device iOS app, not a copy of any other cleaner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Files stay in this tab. Nothing is uploaded, and there is no account.</p>
          <p>
            Similar photos use a 64-bit difference hash of a small canvas, plus last-modified times within 3 minutes. A group cannot stretch past 15 minutes. Screenshots are flagged by filename or by a PNG that matches a known screen size. Large videos are 50 MB or more.
          </p>
          <p>
            A browser cannot delete files on your computer. Remove from review only drops items from this list. Download the removal list and delete those files yourself.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/80 p-6">
      <div className="w-full max-w-sm rounded-3xl border-2 border-dashed border-primary bg-card px-6 py-8 text-center shadow-lg">
        <p className="text-lg font-semibold">Drop to review</p>
        <p className="mt-1 text-sm text-muted-foreground">Photos and videos stay in this tab. Nothing is uploaded.</p>
      </div>
    </div>
  )
}
