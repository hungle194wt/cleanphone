import { Suspense } from "react"
import { ReviewScreen } from "@/components/review-screen"

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-muted-foreground">
          Opening review…
        </main>
      }
    >
      <ReviewScreen />
    </Suspense>
  )
}
