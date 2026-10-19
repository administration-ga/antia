// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-creation-controller.ts @ ad2e7fdc2 — adaptations : F3c : conférence confiée à l’hôte persistant pour conserver son brouillon à la bascule mobile ; commentaires rapportés au réseau du moteur (« iRéseau » → le réseau, formats du catalogue du moteur).
"use client"

/**
 * useCreationController — l'état d'ouverture des surfaces de CRÉATION, seul.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI UN HOOK À PART, ET PAS `useReseauFeedState`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `useReseauFeedState` ouvre six abonnements Convex et vit une fois par arbre
 * monté. Y loger le booléen d'un composeur ferait re-rendre tout le réseau —
 * pagination, rails, panneaux — à chaque ouverture et à chaque fermeture d'une
 * carte. Ce hook-ci ne porte QUE le format ouvert, et les deux coquilles
 * (bureau et téléphone) l'appellent chacune de leur côté.
 *
 * ⚠️ **Ouvrir ne navigue PAS.** Ni `goToTab`, ni `setView`, ni `setSearchDraft`,
 * ni `router` : c'était tout le défaut de R-01 — les deux gestes de création
 * ne survivaient qu'à la vue nue du fil. Le volet ouvert, la recherche en
 * cours, le mot-clic, la publication ouverte et la hauteur de défilement sont
 * donc INTACTS à l'ouverture comme à l'annulation. Un test le prouve
 * (`use-creation-controller.test.tsx`), parce que rien dans le typage ne
 * l'empêcherait de revenir.
 *
 * Les formats, leurs libellés et la surface de chacun vivent dans le module
 * PUR voisin (`creation-controller.ts`), testé en `node`.
 *
 * ⚠️ **La PUBLICATION fait exception, et c'est R-12.** Son ouverture vit dans
 * `post-draft-store.ts` — un état de MODULE — parce qu'elle doit survivre au
 * remplacement de l'arbre à 959→960→959 : le hook est appelé une fois par
 * coquille (bureau, téléphone), donc un `useState` se perd à la bascule, en
 * même temps que la feuille et le brouillon qu'elle portait. La CONFÉRENCE
 * confie aussi son ouverture et son brouillon à l'hôte persistant. Les autres
 * formats restent locaux.
 */

import { useCallback, useMemo, useState } from "react"
import type { CreationKind } from "./creation-controller"
import { consumeConferenceLaunch, requestConferenceLaunch } from "../iappel/conference-launch-store"
import { postDraftStore, usePostComposerOpen } from "./post-draft-store"

export interface CreationController {
  /** Le format dont la surface est ouverte, ou `null`. */
  open: CreationKind | null
  /** Ouvrir la surface d'un format. Ne touche à AUCUN état de navigation. */
  openCreation: (kind: CreationKind) => void
  /** Refermer la surface ouverte, quelle qu'elle soit. */
  close: () => void
}

export function useCreationController(): CreationController {
  const [local, setLocal] = useState<CreationKind | null>(null)
  const composerOpen = usePostComposerOpen()

  const openCreation = useCallback((kind: CreationKind) => {
    if (kind === "conference") {
      setLocal(null)
      postDraftStore.setComposerOpen(false)
      requestConferenceLaunch({ userIds: [] })
      return
    }
    consumeConferenceLaunch()
    if (kind === "publication") {
      // Une valeur, jamais un ensemble : ouvrir la publication referme ce qui
      // l'était (deux surfaces montées = deux pièges de focus empilés).
      setLocal(null)
      postDraftStore.setComposerOpen(true)
      return
    }
    postDraftStore.setComposerOpen(false)
    setLocal(kind)
  }, [])
  const close = useCallback(() => {
    consumeConferenceLaunch()
    postDraftStore.setComposerOpen(false)
    setLocal(null)
  }, [])

  // La publication L'EMPORTE : elle est la seule dont l'ouverture a traversé
  // le remplacement d'arbre, donc la seule qui puisse être vraie ici alors que
  // l'état local vient de naître.
  const open: CreationKind | null = composerOpen ? "publication" : local

  return useMemo(
    () => ({ open, openCreation, close }),
    [open, openCreation, close]
  )
}
