"use client"

import { useNetwork } from "@antsia/api/network"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import type { CreationKind } from "@antsia/social-features/features/reseau-personnel/creation-controller"
import { useCreationController } from "@antsia/social-features/features/reseau-personnel/use-creation-controller"
import { NotificationBell } from "@antsia/social-features/notifications"
import { AppearanceToggle } from "@antsia/social-features/shell/appearance"
import { PostComposerSheet, ReseauMenuRail, ReseauMobileTabBar } from "@antsia/social-features/reseau-personnel"
import { StoryCreateSheet } from "@antsia/social-features/stories"
import { cn } from "@antsia/ui/lib/cn"
import { DESKTOP_ONLY_CLASS, useIsReseauMobile } from "@antsia/ui/overlay"
import { Compass, LogOut, MessageCircle, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { type ReactNode, Suspense, useState } from "react"
import { useTranslation } from "react-i18next"

import { useMemberSession } from "@/components/network-shell"
import { IdentityTools } from "@/components/identity-tools"
import { Button } from "@/components/shared/controls"
import { signOutAndRedirect } from "@/lib/sign-out"
import { isLiveSessionPath, memberDestinationFor, routes } from "@/lib/routes"

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
 *
 * Sous la navigation par destinations (P02, déclarée par `NetworkShell`), la
 * barre ne garde que la marque (retour au fil), la cloche, l'identité et la
 * déconnexion : Découvrir, Messages et Profil sont des destinations du rail
 * (bureau) et de la barre basse (téléphone) ; « Mon fil », le fil national et
 * la modération se rangent sous elles (pages Découvrir et Profil). Sans cette
 * navigation, ses liens d'avant restent à l'identique — c'est le retour arrière.
 */
export function MemberTopBar({ onMobile = "visible" }: { onMobile?: "visible" | "hidden" }) {
  const { t } = useTranslation("antsia")
  const { t: tMember } = useTranslation("memberNetwork")
  const { person } = useMemberSession()
  const destinations = useNetwork().navigation === "destinations"
  const [signingOut, setSigningOut] = useState(false)
  const myHandle = person.published && person.handle ? person.handle : null
  /* Sous les destinations, ce qui reste n'est plus une navigation mais les
     outils de la session : pas de second repère « navigation » à l'écran. */
  const Tools = destinations ? "div" : "nav"

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
        <Tools aria-label={destinations ? t("nav.sessionTools") : t("nav.label")} role={destinations ? "group" : undefined} className="flex flex-wrap items-center gap-1">
          {destinations ? null : (
            <>
              <Link href={routes.feedPreferences()} className={NAV_LINK}><SlidersHorizontal aria-hidden="true" className="size-4" />{t("feedPreferences.title")}</Link>
              <Link href={routes.nationalFeed()} className={NAV_LINK} aria-label={tMember("nav.national")}><Compass aria-hidden="true" className="size-4" /><span className="hidden lg:inline">{tMember("nav.national")}</span></Link>
              <Link href={routes.discover()} className={NAV_LINK}>{tMember("nav.discover")}</Link>
              <Link href={routes.moderation()} className={NAV_LINK} aria-label={tMember("nav.moderation")}><ShieldCheck aria-hidden="true" className="size-4" /><span className="hidden lg:inline">{tMember("nav.moderation")}</span></Link>
            </>
          )}
          <AppearanceToggle />
          <NotificationBell />
          <IdentityTools />
          {destinations ? null : (
            <Link href={routes.messages()} className={NAV_LINK} aria-label={t("nav.messages")}>
              <MessageCircle aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{t("nav.messages")}</span>
            </Link>
          )}
          {myHandle && !destinations ? (
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
        </Tools>
      </div>
    </header>
  )
}

/** Une page de membre hors du fil (profil, page, album) : la barre du haut, puis le contenu. */
export function MemberPage({ children }: { children: ReactNode }) {
  const destinations = useNetwork().navigation === "destinations"
  if (destinations) return <DestinationsMemberPage>{children}</DestinationsMemberPage>
  return (
    <div className="esp-page-motif min-h-dvh bg-background">
      <MemberTopBar />
      <main id="contenu" tabIndex={-1} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring mx-auto w-full max-w-7xl px-4 py-6 sm:px-5">
        {children}
      </main>
    </div>
  )
}

/**
 * Une page de membre sous la navigation par DESTINATIONS (P02) : les cinq
 * destinations y sont les mêmes que sur le fil — rail à gauche au bureau
 * (≥ 960 px), barre basse au téléphone — et « Créer » y ouvre les MÊMES
 * surfaces (publication, actu ; la conférence passe par l'hôte persistant de
 * la coque), montées UNE fois pour la page.
 *
 * ⚠️ Rien de la couche de communication n'est monté ici : elle vit dans
 * `NetworkShell`, une fois pour toutes les pages de membre — changer de page
 * ne recrée ni l'appel, ni la présence.
 *
 * ⚠️ Un seul des deux arbres de navigation est monté (`useIsReseauMobile`) :
 * deux cartes « Créer » montées ensemble seraient deux pièges de focus. La
 * colonne du rail existe dès le premier rendu au bureau (CSS) : le contenu ne
 * saute pas quand le rail arrive.
 *
 * ⚠️ Les pages de DIRECT (`isLiveSessionPath`) gardent l'écran entier : ni rail,
 * ni barre sur leurs commandes — même règle que les vues immersives du fil.
 */
function DestinationsMemberPage({ children }: { children: ReactNode }) {
  const { person } = useMemberSession()
  const pathname = usePathname()
  const mobile = useIsReseauMobile()
  /* Le MÊME contrôleur que le fil : ouvrir une surface ne touche à aucun état
     de navigation, et le brouillon de publication vit dans son magasin de
     module (il survit au changement de page comme à la bascule 959/960). */
  const creation = useCreationController()
  const handle = person.published && person.handle ? person.handle : null
  const withNavigation = !isLiveSessionPath(pathname)

  return (
    <div className="esp-page-motif min-h-dvh bg-background">
      <MemberTopBar />
      <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-5", withNavigation && "min-[960px]:grid min-[960px]:grid-cols-[minmax(200px,248px)_minmax(0,1fr)] min-[960px]:gap-6")}>
        {withNavigation ? (
          <div className={cn(DESKTOP_ONLY_CLASS, "sticky top-16 max-h-[calc(100dvh-4rem)] self-start overflow-y-auto py-6")}>
            {mobile === false ? (
              <Suspense fallback={null}>
                <MemberDestinationsRail onCreate={creation.openCreation} />
              </Suspense>
            ) : null}
          </div>
        ) : null}
        <main
          id="contenu"
          tabIndex={-1}
          className={cn(
            "min-w-0 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
            // La barre basse est FIXE : le bas de page lui laisse sa place (barre, gouttière, encoche).
            withNavigation && "max-[959px]:pb-[calc(6rem+env(safe-area-inset-bottom,0px))]",
          )}
        >
          {children}
        </main>
      </div>
      {withNavigation && mobile === true ? (
        <Suspense fallback={null}>
          <MemberDestinationsBar handle={handle} onCreate={creation.openCreation} />
        </Suspense>
      ) : null}
      <PostComposerSheet open={creation.open === "publication"} onClose={creation.close} />
      <StoryCreateSheet open={creation.open === "actu"} onClose={creation.close} onPublished={creation.close} />
    </div>
  )
}

/**
 * La destination d'une page qu'antsia.ga seule sait ranger (fil filtré, mes
 * préférences, modération) ; `undefined` laisse la coque la déduire.
 * `useSearchParams` impose sa frontière Suspense : elle vit chez l'appelant.
 */
function useMemberDestination() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return memberDestinationFor(pathname, searchParams)
}

/** Le rail du bureau : le MÊME que sur le fil, volets en liens (aucun volet ouvert ici). */
function MemberDestinationsRail({ onCreate }: { onCreate: (kind: CreationKind) => void }) {
  return <ReseauMenuRail activeTab={null} onCreate={onCreate} current={useMemberDestination()} />
}

/** La barre basse du téléphone : la MÊME que sur le fil. */
function MemberDestinationsBar({ handle, onCreate }: { handle: string | null; onCreate: (kind: CreationKind) => void }) {
  return <ReseauMobileTabBar active={null} badges={{}} handle={handle} onCreate={onCreate} current={useMemberDestination()} />
}
