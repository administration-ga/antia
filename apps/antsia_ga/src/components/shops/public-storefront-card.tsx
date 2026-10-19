import type { Locale } from "@antsia/social-features/i18n"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { PUBLIC_LINK } from "@/components/public/public-shell"
import { getAppT } from "@/i18n/server"
import type { PublicStorefront } from "@/lib/public-shops-data"
import { routes } from "@/lib/routes"

/** SSR : identité et catalogue admis ; aucun état privé du lecteur. */
export function PublicStorefrontCard({ storefront, locale, catalog }: { storefront: PublicStorefront; locale: Locale; catalog?: ReactNode }) {
  const { t } = getAppT(locale)
  const details = [
    { key: "specialty", value: storefront.specialty },
    { key: "serviceArea", value: storefront.serviceArea },
    { key: "hours", value: storefront.hours },
  ] as const

  return <article className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
    {storefront.bannerUrl ? <Image unoptimized src={storefront.bannerUrl} width={1200} height={400} alt="" loading="lazy" className="max-h-64 w-full object-cover" /> : null}
    <div className="flex flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium text-primary">{t("shops:publicStorefront.title", { name: storefront.name })}</p>
        <div className="flex items-start gap-4">
          {storefront.logoUrl ? <Image unoptimized src={storefront.logoUrl} width={72} height={72} alt="" loading="lazy" className="size-18 shrink-0 rounded-2xl object-contain" /> : <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl font-semibold">{storefront.name.slice(0, 1)}</span>}
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="break-words text-3xl font-semibold tracking-tight">{storefront.name}</h1>
            <p className="break-all text-sm text-muted-foreground">@{storefront.handle}</p>
            <p className="text-sm font-medium">{t(`shops:badges.${storefront.badge}`)}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t(`shops:models.${storefront.model}`)}</p>
        <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground">{t("shops:publicStorefront.origin", { name: storefront.origin.name })}</p>
        <p className="text-xs text-muted-foreground">{t("shops:publicStorefront.publicAudience")}</p>
      </header>

      <section aria-labelledby="public-storefront-about" className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 id="public-storefront-about" className="text-xl font-semibold">{t("shops:storefront.about")}</h2>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{storefront.description ?? t("shops:publicStorefront.descriptionFallback", { name: storefront.name })}</p>
        {details.some((detail) => detail.value) ? <dl className="grid gap-4 sm:grid-cols-2">
          {details.map((detail) => detail.value ? <div key={detail.key} className="min-w-0">
            <dt className="text-sm font-semibold">{t(`shops:storefront.${detail.key}`)}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{detail.value}</dd>
          </div> : null)}
        </dl> : null}
      </section>

      {catalog}
      <Link href={routes.storefront(storefront.handle)} prefetch={false} className={`${PUBLIC_LINK} self-start`}>{t("shops:publicStorefront.memberLink")}</Link>
    </div>
  </article>
}
