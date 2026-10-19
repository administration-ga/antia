import Link from "next/link"
import type { Locale } from "@antsia/social-features/i18n"
import { routes } from "@/lib/routes"
import { getPublicT } from "./public-copy"
import { PUBLIC_LINK } from "./public-shell"
import { PublicRetryButton } from "./public-actions"
import { PublicHandoff } from "./public-handoff"

export function PublicStatus({ status, locale, headingLevel = 1 }: { status: "refused" | "unavailable" | "handoff"; locale: Locale; headingLevel?: 1 | 2 }) {
  const t = getPublicT(locale)
  const Heading = headingLevel === 1 ? "h1" : "h2"
  if (status === "handoff") return <section><Heading className="mb-4 text-2xl font-semibold">{t("states.handoff.title")}</Heading><PublicHandoff /></section>
  return <section role={status === "unavailable" ? "alert" : "status"} className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-8">
    <Heading className="text-2xl font-semibold">{t(`states.${status}.title`)}</Heading>
    <p className="mt-3 max-w-xl text-muted-foreground">{t(`states.${status}.body`)}</p>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      {status === "unavailable" ? <PublicRetryButton /> : null}
      <Link href={routes.signIn()} prefetch={false} className={PUBLIC_LINK}>{t("nav.enter")}</Link>
      <Link href={routes.home()} prefetch={false} className={PUBLIC_LINK}>{t("states.home")}</Link>
    </div>
  </section>
}
