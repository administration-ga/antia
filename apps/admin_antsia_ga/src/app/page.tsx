import Link from "next/link"

import { getAppT } from "@/i18n/server"
import { routes } from "@/lib/routes"
import { ConsoleSession } from "@/components/console-session"

/**
 * Accueil provisoire de la console du moteur (PA0). La console — réseaux,
 * équipes, files d'appel, fédération, badges manuels, journal, santé — arrive
 * au prompt PA7, derrière une connexion IDN `loa ≥ 2`.
 */
export default function ConsoleHomePage() {
  const { t } = getAppT()
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("home.eyebrow")}</p>
        <h1 className="text-4xl">{t("home.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("home.lead")}</p>
      </header>
      <ConsoleSession />
      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
        <Link href={routes.health()}>{t("home.healthLink")}</Link>
      </footer>
    </main>
  )
}
