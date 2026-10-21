import type { Locale } from "@antsia/social-features/i18n"
import Link from "next/link"
import { routes } from "@/lib/routes"
import { getPublicT } from "./public-copy"

const SECTIONS = { about: ["purpose", "contexts", "trust"], legal: ["publisher", "law", "publication"], privacy: ["controller", "data", "profile", "cookies", "recipients", "retention", "device", "rights"] } as const

export function PublicLegalContent({ kind, locale }: { kind: keyof typeof SECTIONS; locale: Locale }) {
  const t = getPublicT(locale)
  const sectionLink = "flex min-h-11 items-center rounded-[var(--esp-chip-radius)] px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
  const contents = <ul className="grid gap-1">{SECTIONS[kind].map((section) => <li key={section}><a href={`#${kind}-${section}`} className={sectionLink}>{t(`legal.${kind}.${section}.title`)}</a></li>)}{kind !== "about" ? <li><a href={`#${kind}-sources`} className={sectionLink}>{t("legal.sources")}</a></li> : null}</ul>
  return <article className="antsia-page mx-auto min-w-0 max-w-5xl">
    <header className="antsia-page-header max-w-3xl lg:ml-60"><p className="text-sm font-semibold text-primary">{t("legal.eyebrow")}</p><h1 className="antsia-title">{t(`legal.${kind}.title`)}</h1><p className="antsia-copy text-muted-foreground">{t(`legal.${kind}.lead`)}</p></header>
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[216px_minmax(0,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-6">
        <details className="antsia-panel lg:hidden"><summary className="min-h-11 cursor-pointer rounded-[var(--esp-chip-radius)] py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.contents")}</summary><nav aria-label={t("legal.contents")} className="mt-2">{contents}</nav></details>
        <nav aria-label={t("legal.contents")} className="hidden lg:block"><p className="mb-3 px-3 font-semibold">{t("legal.contents")}</p>{contents}</nav>
      </div>
      <div className="antsia-page min-w-0">
        {kind !== "about" ? <p role="status" className="rounded-[var(--esp-media-radius)] bg-muted p-4 text-sm">{t("legal.draft")}</p> : null}
        {SECTIONS[kind].map((section) => <section id={`${kind}-${section}`} key={section} className="antsia-panel scroll-mt-6"><h2 className="antsia-subtitle">{t(`legal.${kind}.${section}.title`)}</h2><p className="antsia-copy mt-3 whitespace-pre-line text-muted-foreground">{t(`legal.${kind}.${section}.body`)}</p></section>)}
        {kind !== "about" ? <section id={`${kind}-sources`} className="antsia-panel scroll-mt-6"><h2 className="antsia-subtitle">{t("legal.sources")}</h2><ul className="mt-3 flex flex-col gap-2 text-sm"><li><a href={routes.apdpvp()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.apdpvp")}</a></li><li><a href={routes.officialJournal()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.journal")}</a></li><li><a href={routes.gdpr()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.gdpr")}</a></li></ul></section> : null}
        <Link href={routes.dataSettings()} prefetch={false} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] font-medium text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("nav.data")}</Link>
      </div>
    </div>
  </article>
}
