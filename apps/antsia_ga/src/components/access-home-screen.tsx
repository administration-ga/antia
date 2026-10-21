"use client"

import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { AppearanceToggle } from "@antsia/social-features/shell/appearance"
import Link from "next/link"
import { type ReactNode, useEffect } from "react"
import { useTranslation } from "react-i18next"

import { SessionProviders } from "@/components/providers"
import { SignInCard } from "@/components/sign-in-screen"
import { DemoEntryLink } from "@/components/demo-embed"
import type { ShopContactContinuation } from "@/lib/shop-contact-continuation"
import { routes } from "@/lib/routes"

const FOOTER_LINK = "inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"

export type AccessHomeScreenProps = {
  intent?: "sign-in" | "sign-up"
  signOutIncomplete?: boolean
  publicPostId?: string
  notificationReference?: string
  shopContact?: ShopContactContinuation
  publicPreview?: ReactNode
}

/** Une même porte responsive pour l'accueil, la connexion et l'inscription. */
export function AccessHomeScreen({ intent = "sign-in", signOutIncomplete = false, publicPostId, notificationReference, shopContact, publicPreview }: AccessHomeScreenProps = {}) {
  const { t, i18n } = useTranslation("antsia")
  const { t: tPublic } = useTranslation("publicNetwork")
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr"

  useEffect(() => { document.documentElement.lang = locale }, [locale])

  function changeLocale(next: "fr" | "en") {
    void i18n.changeLanguage(next)
  }

  return (
    <div className="esp-page-motif relative flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={routes.home()} translate="no" aria-label={`${BRAND_NAME} — ${t("nav.home")}`} className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--ui2-button-radius)] font-display text-foreground text-[26px] font-bold leading-none tracking-[0.06em] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4">{BRAND_NAME}<span aria-hidden="true" className="ml-1.5 inline-block size-[7px] rounded-full bg-[var(--primary-fill)]" /></Link>
          <nav aria-label={tPublic("nav.label")} className="flex items-center justify-end gap-1">
            <Link href={routes.discover()} prefetch={false} className="hidden min-h-11 items-center rounded-[var(--ui2-button-radius)] px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[960px]:inline-flex">{tPublic("nav.discover")}</Link>
            <Link href={`${routes.discover()}#provinces`} prefetch={false} className="hidden min-h-11 items-center rounded-[var(--ui2-button-radius)] px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[960px]:inline-flex">{tPublic("nav.provinces")}</Link>
            <Link href={routes.about()} prefetch={false} className="hidden min-h-11 items-center rounded-[var(--ui2-button-radius)] px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[960px]:inline-flex">{tPublic("nav.about")}</Link>
            <Link href={routes.signIn("sign-up", publicPostId, notificationReference, shopContact)} prefetch={false} className="hidden min-h-11 items-center rounded-[var(--ui2-button-radius)] px-3 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[960px]:inline-flex">{t("access.createAccount")}</Link>
            <Link href={routes.signIn(undefined, publicPostId, notificationReference, shopContact)} prefetch={false} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{tPublic("nav.enter")}</Link>
            {/* Le mode sombre reste accessible avant la connexion (ADR-0027). */}
            <AppearanceToggle />
          </nav>
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className="flex flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <div className="mx-auto grid w-full max-w-[1080px] flex-1 content-start items-start gap-6 px-4 py-8 sm:px-6 sm:py-12 min-[960px]:grid-cols-[minmax(0,1fr)_400px] min-[960px]:content-center min-[960px]:items-center min-[960px]:gap-16 min-[960px]:py-16">
          <header className="antsia-page-header mx-auto max-w-md text-center min-[960px]:mx-0 min-[960px]:max-w-lg min-[960px]:text-left">
            <p className="text-sm font-semibold text-primary">{tPublic("home.eyebrow")}</p>
            <h1 className="antsia-title">{t("access.headline")}</h1>
            <p className="antsia-copy text-muted-foreground">{t("access.lead")}</p>
          </header>
          <div className="mx-auto w-full min-w-0 max-w-[420px]">
            <SessionProviders>
              <SignInCard compact intent={intent} signOutIncomplete={signOutIncomplete} publicPostId={publicPostId} notificationReference={notificationReference} shopContact={shopContact} />
            </SessionProviders>
            <div className="mt-4 text-center">
              <DemoEntryLink />
              <Link href={routes.discover()} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-[var(--ui2-button-radius)] px-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("access.discover")}</Link>
            </div>
          </div>
        </div>
        {publicPreview}
      </main>
      <footer className="border-t border-[color:var(--esp-surface-border)] bg-card px-4 py-4 min-[960px]:py-5">
        <nav aria-label={t("access.footer")} className="mx-auto flex max-w-[1060px] flex-wrap items-center justify-center gap-x-2 min-[960px]:justify-start">
          <Link href={routes.about()} prefetch={false} className={FOOTER_LINK}>{t("access.about")}</Link>
          <Link href={routes.transparency()} prefetch={false} className={FOOTER_LINK}>{tPublic("nav.transparency")}</Link>
          <Link href={routes.legal()} prefetch={false} className={FOOTER_LINK}>{t("access.legal")}</Link>
          <Link href={routes.privacy()} prefetch={false} className={FOOTER_LINK}>{t("access.privacy")}</Link>
          <Link href={routes.dataSettings()} prefetch={false} className={FOOTER_LINK}>{tPublic("nav.data")}</Link>
          <span aria-hidden="true" className="mx-1 text-muted-foreground">·</span>
          {(["fr", "en"] as const).map((language) => <button key={language} type="button" lang={language} aria-pressed={locale === language} onClick={() => changeLocale(language)} className={`${FOOTER_LINK} ${locale === language ? "font-semibold text-foreground" : ""}`}>{t(language === "fr" ? "access.french" : "access.english")}</button>)}
        </nav>
        <p className="mx-auto max-w-[1060px] text-center text-xs text-muted-foreground min-[960px]:text-left">{t("access.signature")}</p>
      </footer>
    </div>
  )
}
