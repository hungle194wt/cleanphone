import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Geist } from "next/font/google"
import { LibraryProvider } from "@/components/library-provider"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const themeBoot = `(function(){try{var s=localStorage.getItem("cleanphone-theme");var d=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`

export const metadata: Metadata = {
  title: "CleanPhone",
  description:
    "Review similar photos, screenshots, and large videos in the browser. Files stay on your computer.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f6" },
    { media: "(prefers-color-scheme: dark)", color: "#101414" },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <LibraryProvider>{children}</LibraryProvider>
      </body>
    </html>
  )
}
