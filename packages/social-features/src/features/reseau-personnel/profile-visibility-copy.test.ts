// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/profile-visibility-copy.test.ts @ ad2e7fdc2 — adaptations : copie RÉÉCRITE sur les règles du moteur, lue par `visibilityFacts(t)` / `visibilityActions(t)` / `visibilityAction(id, t)` avec un `t` réel (fr, et en pour la parité) ; identifiants des faits du moteur ; le cas « le profil de découverte existe D'OFFICE » est INVERSÉ (invariant 7 : rien n'est publié d'office) ; le cas de la photo devient « rien n'est repris du compte, une photo ne rejoint le profil que par un geste » ; cliquets source sur `iprofil-sections`, `ProfilProfessionnelSection` et `MonReseauCard` retirés avec ces fichiers (dossier administratif, carte orpheline) ; cas neufs : aucune trace du vocabulaire du socle (poste, agent, collègue, administration, iProfil) dans la copie, et la copie anglaise existe pour chaque fait et chaque geste.
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import frProfil from "../../i18n/locales/fr/reseau.profil.json"
import enProfil from "../../i18n/locales/en/reseau.profil.json"
import { profileOnboardingCopy } from "./profile-onboarding"
import {
  VISIBILITY_ACTION_IDS,
  VISIBILITY_FACT_IDS,
  visibilityAction,
  visibilityActions,
  visibilityFacts,
} from "./profile-visibility-copy"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8")
}

/** Tous les textes d'un sous-arbre de locale, à plat. */
function texts(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (value && typeof value === "object") return Object.values(value).flatMap(texts)
  return []
}

describe("visibilityFacts — trois faits, jamais mélangés (X-07)", () => {
  it("porte exactement les trois faits, dans l'ordre du plus privé au plus public", () => {
    expect(visibilityFacts(t).map((fact) => fact.id)).toEqual([
      "compte_non_repris",
      "publication_choisie",
      "reste_par_geste",
    ])
    expect([...VISIBILITY_FACT_IDS]).toEqual(visibilityFacts(t).map((fact) => fact.id))
  })

  it("donne à chacun un titre et un corps distincts", () => {
    const facts = visibilityFacts(t)
    const titres = new Set(facts.map((fact) => fact.title))
    const corps = new Set(facts.map((fact) => fact.body))
    expect(titres.size).toBe(facts.length)
    expect(corps.size).toBe(facts.length)
    for (const fact of facts) {
      expect(fact.title.length).toBeGreaterThan(0)
      expect(fact.body.length).toBeGreaterThan(0)
    }
  })

  it("rien n'est repris du compte : une photo ne rejoint le profil que par un geste", () => {
    const facts = visibilityFacts(t)
    for (const fact of facts) {
      expect(fact.body).not.toContain("ni votre photo")
    }
    const compte = facts.find((fact) => fact.id === "compte_non_repris")
    expect(compte?.body).toContain("jamais repris")
    expect(compte?.body).toContain("photo")
    const geste = facts.find((fact) => fact.id === "reste_par_geste")
    expect(geste?.body).toContain("Photo")
  })

  it("ne promet aucune publication d'office : le profil existe parce qu'on le publie (invariant 7)", () => {
    const facts = visibilityFacts(t)
    for (const fact of facts) {
      expect(`${fact.title} ${fact.body}`).not.toContain("d'office")
    }
    const publication = facts.find((fact) => fact.id === "publication_choisie")
    expect(publication?.title).toContain("si vous le publiez")
    expect(publication?.body).toContain("identifiant")
    expect(publication?.body).toContain("membres du réseau")
  })
})

describe("visibilityActions — conséquence ET réversibilité", () => {
  it("couvre les cinq gestes, sans en confondre deux", () => {
    expect([...VISIBILITY_ACTION_IDS]).toEqual([
      "hors_connexion",
      "retrait",
      "sourdine",
      "masquer",
      "bloquer",
    ])
    const actions = visibilityActions(t)
    expect(Object.keys(actions)).toEqual([...VISIBILITY_ACTION_IDS])
    // « Hors connexion » (setMyProfilePrivacy) et « retrait » (dépublication)
    // sont deux boutons DISTINCTS de ProfilePublicationCard : les dire d'une
    // seule voix ferait promettre à l'un ce que seul l'autre fait.
    expect(actions.hors_connexion.consequence).not.toBe(
      actions.retrait.consequence,
    )
  })

  it("chaque action porte son libellé, sa conséquence et sa réversibilité", () => {
    for (const id of VISIBILITY_ACTION_IDS) {
      const action = visibilityAction(id, t)
      expect(action.id).toBe(id)
      expect(action.label.length).toBeGreaterThan(0)
      expect(action.consequence.length).toBeGreaterThan(0)
      expect(action.reversibilite.length).toBeGreaterThan(0)
    }
  })

  it("le rappel d'onboarding parle de « hors connexion » avec la MÊME voix", () => {
    const copy = profileOnboardingCopy({ kind: "private" }, t)
    const offline = visibilityAction("hors_connexion", t)
    expect(copy).not.toBeNull()
    expect(copy?.body).toContain(offline.consequence)
    expect(copy?.body).toContain(offline.reversibilite)
  })

  it("la copie anglaise existe pour chaque fait et chaque geste", () => {
    const fr = visibilityFacts(t)
    const en = visibilityFacts(tEn)
    expect(en.map((fact) => fact.id)).toEqual(fr.map((fact) => fact.id))
    en.forEach((fact, index) => {
      expect(fact.title.length).toBeGreaterThan(0)
      expect(fact.title).not.toBe(fr[index]?.title)
    })
    for (const id of VISIBILITY_ACTION_IDS) {
      const action = visibilityAction(id, tEn)
      expect(action.label).not.toBe(visibilityAction(id, t).label)
      expect(action.reversibilite.length).toBeGreaterThan(0)
    }
  })
})

describe("cliquet de COPIE — aucune promesse que le moteur ne tient pas", () => {
  it("aucune trace du vocabulaire de l'espace agent du socle", () => {
    // Le poste « joignable dans l'annuaire », les « agents » et les
    // « collègues » décrivaient l'espace du socle : le moteur n'en a aucun.
    const fr = texts(frProfil.profileVisibilityCopy)
    expect(fr.length).toBeGreaterThan(0)
    for (const text of fr) {
      expect(text).not.toMatch(/\bpostes?\b|\bagents?\b|collègue|administration|iProfil/i)
    }
    for (const text of texts(enProfil.profileVisibilityCopy)) {
      expect(text).not.toMatch(/\bagents?\b|colleague|administration|iProfil/i)
    }
  })
})

describe("cliquet SOURCE — la surface lit la copie au lieu de la réécrire", () => {
  it("ProfilReseauSection n'affirme pas que la photo ne sort pas du compte", () => {
    const contents = source("./ProfilReseauSection.tsx")
    expect(contents).not.toContain("ni votre photo")
    expect(contents).toContain("visibilityFacts(t)")
    expect(contents).toContain("visibilityActions(t)")
  })
})
