"use client"

import { AppearanceToggle } from "@antsia/social-features/shell/appearance"
import { icomProHref } from "@antsia/social-features/features/messagerie/icom-space"
import { cn } from "@antsia/ui/lib/cn"
import { ArrowLeft, House, LayoutGrid, MessageCircle, ShoppingBag, CalendarCheck, UsersRound, UserRound, BriefcaseBusiness, Handshake, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { routes, type SpecializedShopRoute } from "@/lib/routes"
import { useSpecializedNavigation } from "./specialized-navigation"

const NAV_ITEM = "flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-[var(--ui2-button-radius)] px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-[var(--role-commerce-fill)] aria-[current=page]:text-[color:var(--role-commerce-on)] min-[1200px]:justify-start"

/** Une navigation métier : barre basse téléphone, rail tablette et bureau. */
export function SpecializedPage({ space, children }: { space: SpecializedShopRoute; children: ReactNode }) {
  const { t } = useTranslation("specializedSpaces")
  const provider = space.provider === true || space.section === "service"
  const links = provider ? [
    { id: "providerHome", href: routes.provider(space.handle), icon: House },
    { id: "services", href: routes.providerCatalog(space.handle), icon: LayoutGrid },
    { id: "requests", href: routes.serviceRequests(), icon: CalendarCheck },
    { id: "social", href: routes.page(space.handle), icon: UsersRound },
  ] as const : [
    { id: "home", href: routes.storefront(space.handle), icon: House },
    { id: "catalog", href: routes.shopCatalog(space.handle), icon: LayoutGrid },
    { id: "cart", href: routes.cart(), icon: ShoppingBag },
    { id: "social", href: routes.page(space.handle), icon: UsersRound },
  ] as const
  return <SpecializedFrame kind={provider ? "provider" : "shop"} label={t(provider ? "serviceSpace" : "shopSpace")} links={links.map(link => ({ ...link, label: t(`nav.${link.id}`) }))}>{children}</SpecializedFrame>
}

export function SpecializedProfessionalPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation("specializedSpaces")
  const links = [
    { id: "directory", label: t("professionalNav.directory"), href: routes.professionals(), icon: UsersRound },
    { id: "profile", label: t("professionalNav.profile"), href: routes.professionalEditor(), icon: UserRound },
    { id: "collaborations", label: t("professionalNav.collaborations"), href: routes.professionalCollaborations(), icon: Handshake },
    { id: "activities", label: t("professionalNav.activities"), href: routes.myShops(), icon: BriefcaseBusiness },
  ]
  return <SpecializedFrame kind="professional" label={t("professionalSpace")} links={links}>{children}</SpecializedFrame>
}

export function SpecializedEditorialPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation("specializedSpaces")
  const pathname = usePathname()
  const match = /^\/redaction\/([A-Za-z0-9_-]{1,128})(?:\/(?:configuration|equipe))?$/u.exec(pathname)
  const pageId = match?.[1] === "articles" ? null : match?.[1]
  const links = pageId ? [
    { id: "desk", label: t("editorialNav.desk"), href: routes.mediaDesk(pageId), icon: LayoutGrid },
    { id: "config", label: t("editorialNav.config"), href: routes.mediaConfig(pageId), icon: BriefcaseBusiness },
    { id: "team", label: t("editorialNav.team"), href: routes.mediaTeam(pageId), icon: UsersRound },
    { id: "media", label: t("editorialNav.media"), href: routes.mediaHome(), icon: House },
  ] : [
    { id: "media", label: t("editorialNav.media"), href: routes.mediaHome(), icon: House },
    { id: "discover", label: t("editorialNav.discover"), href: routes.press(), icon: LayoutGrid },
    { id: "activities", label: t("editorialNav.activities"), href: routes.myShops(), icon: BriefcaseBusiness },
    { id: "messages", label: t("messages"), href: icomProHref(routes.messages()), icon: MessageCircle },
  ]
  return <SpecializedFrame kind="media" label={t("editorialSpace")} links={links}>{children}</SpecializedFrame>
}

type SpaceLink = { id: string; label: string; href: string; icon: LucideIcon }
/** Même coque responsive ; les destinations restent explicites pour chaque spécialité. */
function SpecializedFrame({ kind, label, links, children }: { kind: "shop" | "provider" | "professional" | "media"; label: string; links: readonly SpaceLink[]; children: ReactNode }) {
  const { t } = useTranslation("specializedSpaces")
  const pathname = usePathname()
  const back = useSpecializedNavigation()
  return <div className="min-h-dvh bg-background text-foreground" data-specialized-space={kind}>
    <header className="sticky top-0 z-30 border-b border-[color:var(--esp-surface-border)] bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-6">
        <Link href={back.href} scroll={false} onClick={back.prepareReturn} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ui2-button-radius)] px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4 shrink-0" aria-hidden="true" />{t("returnToAntsia")}</Link>
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:inline">{label}</span>
        <div className="flex items-center gap-1"><Link href={icomProHref(routes.messages())} aria-label={t("messages")} className={NAV_ITEM}><MessageCircle aria-hidden="true" className="size-5" /></Link><AppearanceToggle /></div>
      </div>
    </header>
    <div className="mx-auto w-full max-w-[1440px] min-[768px]:grid min-[768px]:grid-cols-[96px_minmax(0,1fr)] min-[1200px]:grid-cols-[208px_minmax(0,1fr)]">
      <nav aria-label={t("navigation")} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-[color:var(--esp-surface-border)] bg-card/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur min-[768px]:sticky min-[768px]:inset-auto min-[768px]:top-20 min-[768px]:flex min-[768px]:h-fit min-[768px]:flex-col min-[768px]:self-start min-[768px]:border-0 min-[768px]:bg-transparent min-[768px]:p-3 min-[768px]:backdrop-blur-none">
        {links.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} aria-label={label} aria-current={pathname === href.split("?")[0] ? "page" : undefined} className={cn(NAV_ITEM, "flex-col gap-1 min-[1200px]:flex-row min-[1200px]:gap-3")}><Icon aria-hidden="true" className="size-5 shrink-0" /><span className="text-xs min-[768px]:sr-only min-[1200px]:not-sr-only min-[1200px]:text-sm">{label}</span></Link>)}
      </nav>
      <main id="contenu" tabIndex={-1} className="min-w-0 px-3 py-5 pb-[calc(112px+env(safe-area-inset-bottom,0px))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:px-6 min-[768px]:pb-8 min-[1200px]:px-8">{children}</main>
    </div>
  </div>
}
