"use client"

import { BRAND_NAME } from "@antia/social-contracts/brand"
import { NotificationBell } from "@antia/social-features/notifications"
import { cn } from "@antia/ui/lib/cn"
import { LogOut, MessageCircle, UserRound } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { useMemberSession } from "@/components/network-shell"
import { Button } from "@/components/shared/controls"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

const NAV_LINK =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * La barre du haut des pages de membre : la marque (retour au fil), la cloche
 * du réseau, la messagerie, mon profil et la déconnexion.
 *
 * Au téléphone, le fil a sa propre coquille (en-tête et barre basse du
 * moteur) : la page du fil la masque sous 960 px (`onMobile="hidden"`, même
 * seuil que la bascule de `ReseauAgentPage`). Les pages de profil, de page et
 * d'album n'ont qu'elle.
 */
export function MemberTopBar({ onMobile = "visible" }: { onMobile?: "visible" | "hidden" }) {
  const { t } = useTranslation("antia")
  const { person } = useMemberSession()
  const [signingOut, setSigningOut] = useState(false)
  const myHandle = person.published && person.handle ? person.handle : null

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur",
        onMobile === "hidden" && "hidden min-[960px]:block",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-5">
        <Link href={routes.feed()} className="text-lg font-semibold tracking-tight">
          {BRAND_NAME}
        </Link>
        <nav aria-label={t("nav.label")} className="flex items-center gap-1">
          <NotificationBell />
          <Link href={routes.messages()} className={NAV_LINK} aria-label={t("nav.messages")}>
            <MessageCircle aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t("nav.messages")}</span>
          </Link>
          {myHandle ? (
            <Link href={routes.profile(myHandle)} className={NAV_LINK} aria-label={t("nav.myProfile")}>
              <UserRound aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">@{myHandle}</span>
            </Link>
          ) : null}
          <Button
            variant="ghost"
            pending={signingOut}
            aria-label={t("nav.signOut")}
            className="px-3"
            onClick={async () => {
              setSigningOut(true)
              await authClient.signOut()
              window.location.assign(routes.home())
            }}
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t("nav.signOut")}</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** Une page de membre hors du fil (profil, page, album) : la barre du haut, puis le contenu. */
export function MemberPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <MemberTopBar />
      <main id="contenu" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5">
        {children}
      </main>
    </div>
  )
}
