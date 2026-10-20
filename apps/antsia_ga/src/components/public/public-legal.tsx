import type { Locale } from "@antsia/social-features/i18n"
import Link from "next/link"
import { routes } from "@/lib/routes"
import { getPublicT } from "./public-copy"

const SECTIONS = { about: ["purpose", "contexts", "trust"], legal: ["publisher", "law", "publication"], privacy: ["profile", "cookies", "rights"] } as const

export function PublicLegalContent({ kind, locale }: { kind: keyof typeof SECTIONS; locale: Locale }) {
  const t = getPublicT(locale)
  return <article className="mx-auto flex max-w-3xl flex-col gap-8">
    <header><p className="text-sm font-medium text-primary">{t("legal.eyebrow")}</p><h1 className="mt-3 text-4xl font-semibold">{t(`legal.${kind}.title`)}</h1><p className="mt-4 leading-relaxed text-muted-foreground">{t(`legal.${kind}.lead`)}</p></header>
    {kind !== "about" ? <p role="status" className="rounded-[var(--ui2-card-radius)] border border-transparent bg-muted p-[var(--esp-card-padding,16px)] text-sm">{t("legal.draft")}</p> : null}
    {SECTIONS[kind].map((section) => <section key={section}><h2 className="text-xl font-semibold">{t(`legal.${kind}.${section}.title`)}</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{t(`legal.${kind}.${section}.body`)}</p></section>)}
    {kind !== "about" ? <section className="border-t border-border pt-6"><h2 className="text-xl font-semibold">{t("legal.sources")}</h2><ul className="mt-3 flex flex-col gap-2 text-sm"><li><a href={routes.apdpvp()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.apdpvp")}</a></li><li><a href={routes.officialJournal()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.journal")}</a></li><li><a href={routes.gdpr()} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("legal.gdpr")}</a></li></ul></section> : null}
    <Link href={routes.dataSettings()} prefetch={false} className="inline-flex min-h-11 items-center rounded-[var(--ui2-button-radius)] font-medium text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("nav.data")}</Link>
  </article>
}
