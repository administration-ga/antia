// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-profile-onboarding.ts @ ad2e7fdc2 — adaptations : le rattrapage ne publie plus rien (invariant 7) — il crée la PERSONNE absente par `people.persons.ensureMyPerson` (sur soi, sans réseau) au lieu de `reseauPersonnel.people.ensureMyProfile`, après lecture de `people.persons.getMyPerson` ; décision lue dans `shouldEnsureMyPerson` (ex-`shouldEnsurePublishedProfile`), champ rendu `ensurePending` (ex-`autoPublishPending`) ; API exportée gardée (`useProfileOnboardingAccount`, `resetProfileEnsureGuard`) ; historique du compte plateforme du socle retiré des commentaires.
"use client"

/**
 * `useProfileOnboardingAccount` — la création de la PERSONNE quand la session
 * arrive avant elle, et ce qu'elle apprend à l'écran pendant qu'elle court.
 *
 * ── Ce que ce hook ne fait PAS ───────────────────────────────────────────
 * Il ne publie rien. Rien n'est publié d'office (invariant 7) : la personne
 * naît sans identifiant, sans nom et sans adhésion, et c'est elle qui publie
 * son profil. L'application crée d'ordinaire la personne dès la session
 * ouverte ; ce hook est le filet des surfaces montées avant elle.
 *
 * La décision — « faut-il créer ? » — vit dans `profile-onboarding.ts`
 * (`shouldEnsureMyPerson`, module pur, testé) ; ici, rien que du câblage.
 *
 * ⚠️ Le verrou d'appel est au niveau du MODULE, pas du composant : plusieurs
 * surfaces consomment l'onboarding (le fil, la carte de profil, le fil
 * mobile, la carte d'édition) et peuvent être montées ensemble. Un `useRef`
 * par composant lancerait autant de créations pour un seul manque. La
 * mutation est de toute façon idempotente — le verrou évite le bruit, il ne
 * porte aucune correction.
 */

import { api } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useMutation } from "convex/react"
import { useEffect, useState } from "react"
import {
  shouldEnsureMyPerson,
  type ProfileOnboardingAccount,
} from "./profile-onboarding"

/** Une seule création par chargement d'application (cf. l'en-tête). */
let ensureAttempted = false

/** Remet le verrou — pour les tests d'un futur harnais de composant. */
export function resetProfileEnsureGuard(): void {
  ensureAttempted = false
}

export function useProfileOnboardingAccount(): ProfileOnboardingAccount {
  const ensureMyPerson = useMutation(api.modules.people.persons.ensureMyPerson)
  const person = useAuthenticatedConvexQuery(
    api.modules.people.persons.getMyPerson,
    {},
  )
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (
      !shouldEnsureMyPerson({
        profile: person.data,
        attempted: ensureAttempted,
      })
    ) {
      return
    }
    ensureAttempted = true
    setPending(true)
    void ensureMyPerson({})
      .catch(() => {
        // Un échec n'a rien à dire à l'écran : l'étape « publier » reprend sa
        // place et la personne garde la main.
      })
      .finally(() => setPending(false))
  }, [person.data, ensureMyPerson])

  return { ensurePending: pending }
}
