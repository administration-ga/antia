import Link from "next/link"

import { getAppT } from "@/i18n/server"
import { routes } from "@/lib/routes"

const BADGES = ["official", "verified", "publicAgent", "community"] as const

/**
 * Vitrine provisoire d'antia.ga (PA0). La vitrine complète — entrée, réseaux,
 * compteurs MATÉRIALISÉS, textes légaux — arrive au prompt PA8, après la passe
 * de direction artistique. Aucun chiffre, aucun audit, aucun hébergement n'est
 * affirmé ici (cliquet `public-communication`).
 */
export default function HomePage() {
  const { t, tSocial } = getAppT()
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("home.eyebrow")}</p>
        <h1 className="text-4xl sm:text-5xl">{t("home.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("home.lead")}</p>
      </header>

      <section aria-labelledby="badges-title" className="flex flex-col gap-3">
        <h2 id="badges-title" className="text-xl">
          {t("home.badgesTitle")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {BADGES.map((badge) => (
            <li key={badge} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground">
              {tSocial(`badges.${badge}`)}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="networks-title" className="flex flex-col gap-3">
        <h2 id="networks-title" className="text-xl">
          {t("home.networksTitle")}
        </h2>
        <ul className="flex flex-col gap-3">
          <li className="rounded-xl bg-card p-4 text-card-foreground">{t("home.networks.diaspora")}</li>
          <li className="rounded-xl bg-card p-4 text-card-foreground">{t("home.networks.administration")}</li>
        </ul>
      </section>

      <footer className="flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>{t("home.status")}</p>
        <Link href={routes.health()}>{t("home.healthLink")}</Link>
      </footer>
    </main>
  )
}
