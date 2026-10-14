import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { getAppT } from "@/i18n/server"

import "./globals.css"

export function generateMetadata(): Metadata {
  const { t } = getAppT()
  return {
    title: t("meta.title"),
    description: t("meta.description"),
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = getAppT()
  return (
    <html lang={locale} data-charte="antia" suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2"
        >
          {t("skipToContent")}
        </a>
        {children}
      </body>
    </html>
  )
}
