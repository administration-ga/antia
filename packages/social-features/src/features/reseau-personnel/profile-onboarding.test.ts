// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/profile-onboarding.test.ts @ ad2e7fdc2 — adaptations : facettes de la personne du moteur (`published`, `private`) au lieu de l'identifiant provisoire ; rien n'est publié d'office (invariant 7) — les cas `choose_handle` deviennent « une personne qui n'a pas publié doit publier » et « un profil retiré redemande la publication, même hors connexion » ; le rattrapage crée la PERSONNE (`shouldEnsureMyPerson`, `ensurePending`) ; textes lus dans les locales françaises (`t` réel) ; drapeau de rôle résiduel gardé sans l'histoire du compte plateforme du socle ; cas neuf : une création en cours ne masque pas l'état d'une personne connue ; cas retirés : les six de `profileNetworkStatus` (état du dossier iProfil, retiré avec `MonProfilPage`, son seul lecteur).
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  profileOnboardingCopy,
  profileOnboardingIsUrgent,
  profileOnboardingStep,
  shouldEnsureMyPerson,
  type ProfileOnboardingAccount,
} from "./profile-onboarding"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

describe("profileOnboardingStep — plusieurs surfaces, une seule règle", () => {
  it("sans personne, il faut publier", () => {
    expect(profileOnboardingStep(null)).toEqual({ kind: "publish" })
    expect(profileOnboardingStep(undefined)).toEqual({ kind: "publish" })
  })

  it("une personne qui n'a pas publié doit PUBLIER — rien ne l'a fait pour elle", () => {
    // Le moteur ne publie rien d'office : la personne existe, son profil non.
    const step = profileOnboardingStep({ published: false, private: false })
    expect(step).toEqual({ kind: "publish" })
    expect(profileOnboardingCopy(step, t)?.title).toBe("Vous n'êtes pas encore trouvable")
  })

  it("un profil retiré redemande la publication, même s'il était hors connexion", () => {
    // Le retrait laisse le mode privé en place : ce n'est pas un profil hors
    // connexion, c'est un profil absent.
    expect(
      profileOnboardingStep({ published: false, private: true }),
    ).toEqual({ kind: "publish" })
  })

  it("hors connexion : un état qui se voit, sans presser", () => {
    const step = profileOnboardingStep({ published: true, private: true })
    expect(step).toEqual({ kind: "private" })
    expect(profileOnboardingIsUrgent(step)).toBe(false)
    expect(profileOnboardingCopy(step, t)?.title).toBe("Votre profil est hors connexion")
  })

  it("réglé : plus rien à demander", () => {
    const step = profileOnboardingStep({ published: true, private: false })
    expect(step).toEqual({ kind: "settled" })
    expect(profileOnboardingCopy(step, t)).toBeNull()
    expect(profileOnboardingIsUrgent(step)).toBe(false)
  })

  it("l'étape qui appelle un geste est urgente", () => {
    expect(profileOnboardingIsUrgent({ kind: "publish" })).toBe(true)
  })
})

describe("aucun RÔLE ne décide d'une existence sociale", () => {
  /**
   * Un drapeau de rôle résiduel (`isPlatformAccount` au socle) ne doit rien
   * changer : la règle ne lit que la personne et sa création. Ce test échoue
   * au premier retour en arrière.
   */
  const drapeauResiduel = {
    isPlatformAccount: true,
  } as unknown as ProfileOnboardingAccount

  it("un drapeau de rôle résiduel ne change RIEN — sans personne, on publie", () => {
    expect(profileOnboardingStep(null, drapeauResiduel)).toEqual({
      kind: "publish",
    })
  })

  it("un drapeau de rôle résiduel ne change RIEN — publié, rien à demander", () => {
    expect(
      profileOnboardingStep({ published: true, private: false }, drapeauResiduel),
    ).toEqual({ kind: "settled" })
  })

  it("tout compte reçoit la MÊME proposition de publier", () => {
    const step = profileOnboardingStep(
      { published: false, private: false },
      drapeauResiduel,
    )
    expect(profileOnboardingCopy(step, t)?.action).toBe("Publier mon profil")
    expect(profileOnboardingIsUrgent(step)).toBe(true)
  })
})

describe("le COMPTE prime sur l'absence de personne", () => {
  it("création en cours : on n'annonce pas un manque qu'on est en train de combler", () => {
    // Entre le constat de l'absence de personne et la réponse
    // d'`ensureMyPerson`, faire clignoter « Vous n'êtes pas encore
    // trouvable » annoncerait un état qui n'aura pas duré deux secondes.
    expect(profileOnboardingStep(null, { ensurePending: true })).toEqual({
      kind: "settled",
    })
  })

  it("la création terminée sans personne laisse le geste de PUBLIER", () => {
    expect(profileOnboardingStep(null, { ensurePending: false })).toEqual({
      kind: "publish",
    })
  })

  it("une création en cours ne masque pas l'état d'une personne CONNUE", () => {
    // Le drapeau ne vaut que pour une personne absente : une personne qui
    // existe et n'a pas publié reste à publier.
    expect(
      profileOnboardingStep({ published: false, private: false }, { ensurePending: true }),
    ).toEqual({ kind: "publish" })
  })
})

describe("shouldEnsureMyPerson — deux faits, et aucun rôle", () => {
  it("crée dès que le manque est CONSTATÉ", () => {
    expect(shouldEnsureMyPerson({ profile: null, attempted: false })).toBe(true)
  })

  it("ne crée pas un manque qu'on n'a pas constaté", () => {
    // `undefined` = le serveur n'a pas répondu. Appeler ici dirait à l'écran
    // qu'on crée, avant même de savoir qu'il y a quelque chose à créer.
    expect(shouldEnsureMyPerson({ profile: undefined, attempted: false })).toBe(false)
  })

  it("ne crée pas deux fois dans le même chargement", () => {
    expect(shouldEnsureMyPerson({ profile: null, attempted: true })).toBe(false)
  })

  it("ne crée rien quand la personne est là — publiée ou non", () => {
    // Créer la personne n'est jamais publier : une personne qui n'a pas
    // publié n'est pas « rattrapée ».
    expect(
      shouldEnsureMyPerson({
        profile: { published: false, private: false },
        attempted: false,
      }),
    ).toBe(false)
  })

  it("la création part pour TOUT compte sans personne — aucun rôle n'en dispense", () => {
    // Le serveur sait dire non tout seul ; un saut côté client laisserait la
    // carte de profil sans identité à rendre.
    expect(shouldEnsureMyPerson({ profile: null, attempted: false })).toBe(true)
  })
})
