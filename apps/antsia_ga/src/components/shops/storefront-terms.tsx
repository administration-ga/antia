import { parseCommerceStorefrontTerms } from "@antsia/social-domain/commerce/storefrontTerms"

/** Même contenu public pour membre et anonyme ; l'absence n'est jamais une gratuité. */
export function StorefrontTerms({ value, locale, t }: { value: unknown; locale: string; t: (key: string, options?: Record<string, unknown>) => string }) {
  const terms = parseCommerceStorefrontTerms(value)
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "XAF", currencyDisplay: "code", maximumFractionDigits: 0 }).format(amount)
  return <section aria-labelledby="storefront-terms-title" className="grid min-w-0 gap-4 rounded-[var(--ui2-card-radius)] border border-border bg-card p-[var(--esp-card-padding,16px)] text-card-foreground [overflow-wrap:anywhere]">
    <h2 id="storefront-terms-title" className="antsia-subtitle">{t("storefrontTerms.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("storefrontTerms.declared")}</p>
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div><dt className="font-medium">{t("storefrontTerms.pickup")}</dt><dd>{terms?.pickup ? <ul>{terms.pickup.points.map(point => <li key={point.establishmentRef}>{point.label}</li>)}</ul> : t("storefrontTerms.unknown")}</dd></div>
      <div><dt className="font-medium">{t("storefrontTerms.delivery")}</dt><dd>{terms?.delivery ? <div className="grid gap-1"><p>{terms.delivery.label}</p><p>{terms.delivery.localities.join(" · ")}</p><p>{money(terms.delivery.fee.amount)}</p>{terms.delivery.leadTimeDays === undefined ? null : <p>{t("storefrontTerms.leadTime", { count: terms.delivery.leadTimeDays })}</p>}</div> : t("storefrontTerms.unknown")}</dd></div>
      <div><dt className="font-medium">{t("storefrontTerms.fees")}</dt><dd>{terms?.fees ? <ul>{terms.fees.map((fee, index) => <li key={`${fee.kind}:${index}`}>{fee.label} · {money(fee.amount.amount)}</li>)}</ul> : t("storefrontTerms.unknown")}</dd></div>
      <div><dt className="font-medium">{t("storefrontTerms.returns")}</dt><dd className="whitespace-pre-wrap">{terms?.returns?.summary ?? t("storefrontTerms.unknown")}</dd></div>
      <div><dt className="font-medium">{t("storefrontTerms.warranty")}</dt><dd className="whitespace-pre-wrap">{terms?.warranty?.summary ?? t("storefrontTerms.unknown")}</dd></div>
    </dl>
    {terms ? <p className="text-xs text-muted-foreground">{t("storefrontTerms.updated", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Africa/Libreville" }).format(terms.publishedAt) })}</p> : null}
  </section>
}
