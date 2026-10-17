"use client"

import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { NotificationBell } from "@antsia/social-features/notifications"
import { cn } from "@antsia/ui/lib/cn"
import { Compass, LogOut, MessageCircle, ShieldCheck, UserRound } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"

import { useMemberSession } from "@/components/network-shell"
import { IdentityTools } from "@/components/identity-tools"
import { Button } from "@/components/shared/controls"
import { signOutAndRedirect } from "@/lib/sign-out"
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
  const { t } = useTranslation("antsia")
  const { t: tMember } = useTranslation("memberNetwork")
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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5">
        <Link href={routes.feed()} className="inline-flex min-h-11 items-center rounded-lg px-1 text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {BRAND_NAME}
        </Link>
        <nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-1">
          <Link href={routes.nationalFeed()} className={NAV_LINK} aria-label={tMember("nav.national")}><Compass aria-hidden="true" className="size-4" /><span className="hidden lg:inline">{tMember("nav.national")}</span></Link>
          <Link href={routes.discover()} className={NAV_LINK}>{tMember("nav.discover")}</Link>
          <Link href={routes.moderation()} className={NAV_LINK} aria-label={tMember("nav.moderation")}><ShieldCheck aria-hidden="true" className="size-4" /><span className="hidden lg:inline">{tMember("nav.moderation")}</span></Link>
          <NotificationBell />
          <IdentityTools />
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
              await signOutAndRedirect()
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
      <main id="contenu" tabIndex={-1} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring mx-auto w-full max-w-7xl px-4 py-6 sm:px-5">
        {children}
      </main>
    </div>
  )
}
