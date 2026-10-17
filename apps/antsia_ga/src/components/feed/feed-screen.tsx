"use client"

import { ReseauAgentPage } from "@antsia/social-features/reseau-personnel"

import { MemberTopBar } from "@/components/member-chrome"

/**
 * Le fil : la PAGE RÉSEAU du moteur (volets, rails, iCom, statuts), qui choisit
 * elle-même entre l'arbre du bureau et la coquille du téléphone (≤ 959 px).
 *
 * Au bureau, ses colonnes défilent chacune pour soi : elle vit dans un
 * conteneur de hauteur DÉFINIE, sous la barre du haut. Au téléphone, la
 * coquille du moteur porte son en-tête et sa barre basse, et c'est le document
 * qui défile (l'unique scroller) : ni hauteur figée, ni barre du haut.
 */
export function FeedScreen() {
  return (
    <div className="flex min-h-dvh flex-col bg-background min-[960px]:h-dvh">
      <MemberTopBar onMobile="hidden" />
      {/* La page porte son propre `<main>` (le volet ouvert) : cette enveloppe
          n'est que la cible du lien d'évitement. */}
      <div id="contenu" tabIndex={-1} className="flex flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring min-[960px]:min-h-0">
        <ReseauAgentPage />
      </div>
    </div>
  )
}
