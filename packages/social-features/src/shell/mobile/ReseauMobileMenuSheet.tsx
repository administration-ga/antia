// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/ReseauMobileMenuSheet.tsx @ ad2e7fdc2 — adaptations : RÉÉCRIT — le menu du RÉSEAU seul, ouvert par le bouton fixe « Menu » de la barre basse : sans la section « Espace agent » ni les attributions de modules personnels (`personal-nav`, `use-personal-modules` retirés) ; entrées bâties sur des DESTINATIONS résolues ici depuis la table des routes injectée (`useRoutes()` : page réseau, statuts, mon profil quand il est publié — `people.persons.getMyPerson` —, réglages tant que l'application les sert) et passées à `reseauMobileMenuSections` ; drapeaux des volets dérivés des volets SERVIS (`isServedReseauTab` : « Conférences » attend le module `live`) ; plus de `TooltipProvider` (aucune infobulle dans ce menu) ; libellés par l'i18n (titre et croix traduits, entrées et sections par leurs clés) ; ouverture des statuts reconnue sur la base `stories()` au lieu d'un chemin de l'espace ; gabarit de la feuille inchangé.
"use client"

/**
 * ReseauMobileMenuSheet — le menu principal du réseau au téléphone.
 *
 * Ce que le menu PORTE — quelles entrées, dans quel ordre, sans doublon et
 * sans lien vers la page courante — vit dans `reseau-mobile-tabs.ts`
 * (`reseauMobileMenuSections`), où c'est vérifiable. Ici, le rendu seul, et
 * la résolution des destinations : l'application seule sait ses adresses.
 *
 * ⚠️ Les volets n'y figurent PAS : ils défilent déjà dans la barre basse, à
 * droite du bouton « Menu » qui ouvre cette feuille. La feuille porte ce que
 * la barre ne porte pas — les statuts, mon profil, les réglages.
 *
 * ⚠️ `Sheet` de `@antia/ui/sheet`, `side="bottom"`, `max-h-[82dvh]`, coins
 * hauts arrondis, encoche ajoutée au rembourrage bas et bouton de fermeture
 * porté à 44 px : la feuille s'ouvre depuis la place du pouce.
 */

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useRoutes } from "@antia/api/network"
import { Link } from "@antia/api/routing"
import { Icon } from "@antia/ui"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@antia/ui/sheet"
import { useTranslation } from "react-i18next"

import { markStoriesOpenedFromApp } from "../../features/stories/stories-entry"
import { isServedReseauTab } from "../reseau-menu"
import { reseauMobileMenuSections, type ReseauMenuDestinations } from "./reseau-mobile-tabs"

export interface ReseauMobileMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReseauMobileMenuSheet({ open, onOpenChange }: ReseauMobileMenuSheetProps) {
  const { t } = useTranslation("reseau")
  const routes = useRoutes()
  // Ma fiche (sur moi-même : sans réseau). Un profil n'est une destination
  // que PUBLIÉ : sans identifiant public, il n'a pas d'adresse.
  const myPerson = useAuthenticatedConvexQuery(api.modules.people.persons.getMyPerson, {})
  const handle = myPerson.data?.published === true ? (myPerson.data.handle ?? null) : null

  const destinations: ReseauMenuDestinations = {
    home: routes.home(),
    stories: routes.stories(),
    profile: handle !== null ? routes.profile(handle) : null,
    settings: routes.settings?.() ?? null,
  }
  // Un volet que la page ne sert pas n'a pas d'entrée : le drapeau la RETIRE.
  const sections = reseauMobileMenuSections(destinations, {
    pages: isServedReseauTab("pages"),
    directs: isServedReseauTab("conferences"),
    evenements: isServedReseauTab("evenements"),
    enregistrements: isServedReseauTab("enregistrements"),
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t("reseauMobileMenuSheet.close")}
        className="max-h-[82dvh] overflow-y-auto rounded-t-2xl border-border/60 bg-secondary px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] [&_[data-slot=sheet-close]]:!size-11"
      >
        <SheetHeader className="px-0 pt-2 pb-1">
          <SheetTitle>{t("reseauMobileMenuSheet.title")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <section key={section.labelKey} aria-labelledby={`rm-menu-section-${sectionIndex}`}>
              <p
                id={`rm-menu-section-${sectionIndex}`}
                className="mb-1 px-2 text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase"
              >
                {t(section.labelKey)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.items.map((item) => (
                  <Link
                    key={item.url}
                    href={item.url}
                    // Fermer AU CLIC : la feuille survivrait à la navigation
                    // (même arbre monté) et masquerait la page demandée.
                    onClick={() => {
                      if (item.url === destinations.stories) markStoriesOpenedFromApp()
                      onOpenChange(false)
                    }}
                    className="flex min-h-[68px] min-w-11 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted p-3 text-muted-foreground hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary focus-visible:outline-none"
                  >
                    <span aria-hidden="true">
                      <Icon name={item.icon} size={20} />
                    </span>
                    <span className="text-center text-[11px] leading-tight font-medium">{t(item.labelKey)}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
