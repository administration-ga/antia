import { cn } from "@antsia/ui/lib/cn"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import Link from "next/link"
import type { ReactNode } from "react"
import { routes } from "@/lib/routes"
import { getPublicLocale } from "@/lib/server-session"
import { getPublicT } from "./public-copy"
import { PublicSignOutButton } from "./public-actions"
import { buttonClassName } from "../shared/button-class"
import { PublicAccountTheme } from "./public-account-theme"

export const PUBLIC_LINK = "inline-flex min-h-11 items-center gap-2 rounded-[var(--ui2-button-radius)] px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
const PUBLIC_DESKTOP_LINK = cn(PUBLIC_LINK, "hidden min-[960px]:inline-flex")
export const PUBLIC_CTA = buttonClassName("primary", "px-5 py-2")

export async function PublicShell({ children, viewer = "anonymous" }: { children: ReactNode; viewer?: "anonymous" | "authenticated" | "refused" | "unavailable" | "handoff" }) {
  const t = getPublicT(await getPublicLocale())
  return <div className="esp-page-motif min-h-dvh bg-background text-foreground">
    <PublicAccountTheme enabled={viewer === "anonymous" || viewer === "authenticated"} />
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 min-[960px]:flex-nowrap">
        <Link href={routes.home()} translate="no" className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--ui2-button-radius)] font-display text-foreground text-[26px] font-bold leading-none tracking-[0.06em] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {BRAND_NAME}<span aria-hidden="true" className="ml-1.5 inline-block size-[7px] rounded-full bg-[var(--primary-fill)]" />
        </Link>
        <nav aria-label={t("nav.label")} className="flex min-w-0 items-center justify-end gap-1">
          <Link href={routes.discover()} prefetch={false} className={PUBLIC_DESKTOP_LINK}>{t("nav.discover")}</Link>
          <Link href={`${routes.discover()}#provinces`} prefetch={false} className={PUBLIC_DESKTOP_LINK}>{t("nav.provinces")}</Link>
          <Link href={routes.about()} prefetch={false} className={PUBLIC_DESKTOP_LINK}>{t("nav.about")}</Link>
          {viewer === "anonymous" ? <Link href={routes.signIn("sign-up")} prefetch={false} className={PUBLIC_DESKTOP_LINK}>{t("nav.createAccount")}</Link> : null}
          <Link href={viewer === "authenticated" ? routes.feed() : routes.signIn()} prefetch={false} className={PUBLIC_CTA}>{t(viewer === "authenticated" ? "nav.myFeed" : "nav.enter")}</Link>
          {viewer === "authenticated" || viewer === "refused" ? <PublicSignOutButton /> : null}
        </nav>
      </div>
    </header>
    <main id="contenu" tabIndex={-1} className="antsia-copy mx-auto w-full min-w-0 max-w-7xl px-4 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-6 sm:py-8">{children}</main>
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
