"use client"

import { AppearanceControl } from "@antsia/social-features/shell/appearance"
import { ArrowRight, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { MemberPage } from "@/components/member-chrome"
import { DemoEntryLink } from "@/components/demo-embed"
import { useMemberSession } from "@/components/network-shell"
import { Button, buttonClassName } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import { signOutAndRedirect } from "@/lib/sign-out"
import { meEntriesIn, type MeEntry, type MeSection } from "./me-model"

const ENTRY_LINK =
  "flex min-h-11 items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Une liste d'entrées menant à des pages déjà servies (Profil, Paramètres). */
export function EntryList({ entries }: { entries: readonly MeEntry[] }) {
  const { t } = useTranslation("antsia")
  return (
    <ul className="grid gap-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link href={entry.href} className={ENTRY_LINK}>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">{t(entry.labelKey)}</span>
              <span className="text-sm text-muted-foreground">{t(entry.descriptionKey)}</span>
            </span>
            <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * La destination « Profil » des membres (P02) : mon profil public, mes
 * signets, mes actus et ma boutique, mes préférences (mon fil, l'apparence), mes données
 * et mes recours, la modération, la sortie. Sous la coque des membres ; seule
 * « Mes données et mes recours » vit hors de la coque, à dessein (elle reste
 * ouverte à une personne suspendue).
 */
export function MemberMeScreen() {
  const { t } = useTranslation("antsia")
  const { person } = useMemberSession()
  const [signingOut, setSigningOut] = useState(false)
  const handle = person.published && person.handle ? person.handle : null
  const activityTitle = useId()
  const preferencesTitle = useId()
  const accountTitle = useId()
  const titles: Record<MeSection, string> = { activity: activityTitle, preferences: preferencesTitle, account: accountTitle }

  return (
    <MemberPage>
      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t("me.title")}</h1>
            {/* Les paramètres (affichage, thème, langue) à portée dès l'arrivée : au
                téléphone, Profil est leur seul chemin et ses Préférences suivent l'activité. */}
            <Link href={routes.settings()} className={buttonClassName("outline")}>
              <Settings aria-hidden="true" className="size-4" />
              {t("settings.title")}
            </Link>
          </div>
          <p className="text-base text-muted-foreground">{t("me.lead")}</p>
          {handle !== null ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{person.displayName}</span> · @{handle}
            </p>
          ) : null}
        </header>

        <section aria-labelledby={titles.activity} className="flex flex-col gap-4">
          <h2 id={titles.activity} className="text-lg font-semibold">{t("me.activityTitle")}</h2>
          <EntryList entries={meEntriesIn("activity", handle)} />
        </section>

        <section aria-labelledby={titles.preferences} className="flex flex-col gap-4">
          <h2 id={titles.preferences} className="text-lg font-semibold">{t("me.preferencesTitle")}</h2>
          <EntryList entries={meEntriesIn("preferences", handle)} />
          <div className="rounded-xl border border-border bg-card p-2">
            <AppearanceControl />
          </div>
        </section>

        <section aria-labelledby={titles.account} className="flex flex-col gap-4">
          <h2 id={titles.account} className="text-lg font-semibold">{t("me.accountTitle")}</h2>
          <EntryList entries={meEntriesIn("account", handle)} />
          <DemoEntryLink />
          {/* La MÊME sortie que la barre du haut : la porte partagée
              (`signOutEverywhere`), puis une navigation complète. */}
          <Button
            variant="outline"
            pending={signingOut}
            className="self-start"
            onClick={async () => {
              setSigningOut(true)
              await signOutAndRedirect()
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            {t("nav.signOut")}
          </Button>
        </section>
      </div>
    </MemberPage>
  )
}
