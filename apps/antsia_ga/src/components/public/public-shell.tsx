import { BRAND_NAME } from "@antsia/social-contracts/brand"
import Link from "next/link"
import type { ReactNode } from "react"
import { routes } from "@/lib/routes"
import { getPublicLocale } from "@/lib/server-session"
import { getPublicT } from "./public-copy"
import { PublicSignOutButton } from "./public-actions"

export const PUBLIC_LINK = "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
export const PUBLIC_CTA = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"

export async function PublicShell({ children, viewer = "anonymous" }: { children: ReactNode; viewer?: "anonymous" | "authenticated" | "refused" | "unavailable" | "handoff" }) {
  const t = getPublicT(await getPublicLocale())
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
        <Link href={routes.home()} className="inline-flex min-h-11 items-center gap-3 rounded-lg font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">{BRAND_NAME[0]}</span><span>{BRAND_NAME}</span>
        </Link>
        <nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-1">
          <Link href={routes.discover()} prefetch={false} className={PUBLIC_LINK}>{t("nav.discover")}</Link>
          <Link href={routes.transparency()} prefetch={false} className={`${PUBLIC_LINK} hidden sm:inline-flex`}>{t("nav.transparency")}</Link>
          <Link href={viewer === "authenticated" ? routes.feed() : routes.signIn()} prefetch={false} className={PUBLIC_CTA}>{t(viewer === "authenticated" ? "nav.myFeed" : "nav.enter")}</Link>
          {viewer === "authenticated" || viewer === "refused" ? <PublicSignOutButton /> : null}
        </nav>
      </div>
    </header>
    <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-6 sm:py-12">{children}</main>
    <footer className="border-t border-border">
      <nav aria-label={t("nav.footer")} className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 text-muted-foreground sm:px-6">
        <Link href={routes.home()} className={PUBLIC_LINK}>{BRAND_NAME}</Link>
        <Link href={routes.about()} className={PUBLIC_LINK}>{t("nav.about")}</Link>
        <Link href={routes.legal()} className={PUBLIC_LINK}>{t("nav.legal")}</Link>
        <Link href={routes.privacy()} className={PUBLIC_LINK}>{t("nav.privacy")}</Link>
        <Link href={routes.transparency()} className={PUBLIC_LINK}>{t("nav.transparency")}</Link>
        <Link href={routes.dataSettings()} className={PUBLIC_LINK}>{t("nav.data")}</Link>
      </nav>
    </footer>
  </div>
}
