// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/people-panel.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans l'i18n du moteur (français et anglais) ; adresses composées sur une base de test injectée (la page réseau de l'application) au lieu de l'adresse de l'espace ; ligne « fonction » réduite au titre publié — les trois cas du poste et de l'administration (composition, l'un sans l'autre, priorité sur le titre) retirés avec la branche ; cas neufs : base qui porte déjà une query, `relationErrorText` (règle, code, repli).
import { readFileSync } from "node:fs"

import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { RESEAU_AGENT_VUE_PARAM } from "../../shell/reseau-agent-nav"
import {
  PEOPLE_VIEW_DEFAULT,
  PEOPLE_VIEW_IDS,
  PEOPLE_VIEW_LABEL_KEYS,
  parsePeopleView,
  peopleViewHref,
  peopleViewLabel,
  personTitleLine,
  relationErrorText,
  showPresence,
} from "./people-panel"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

/** La page réseau de l'application de test : seule l'application sait son adresse. */
const HOME = "/fil"

describe("sous-vues du volet Relations (R-04)", () => {
  it("trois sous-vues, dans l'ordre du rendu", () => {
    expect(PEOPLE_VIEW_IDS).toEqual(["relations", "suggestions", "invitations"])
    expect(PEOPLE_VIEW_DEFAULT).toBe("relations")
  })

  it("chaque sous-vue porte un libellé traduit, jamais une clé brute", () => {
    for (const id of PEOPLE_VIEW_IDS) {
      expect(PEOPLE_VIEW_LABEL_KEYS[id].startsWith("reseau:peoplePanel.views.")).toBe(true)
      const fr = peopleViewLabel(id, t)
      const en = peopleViewLabel(id, tEn)
      expect(fr.length).toBeGreaterThan(0)
      expect(fr).not.toContain("peoplePanel")
      expect(en).not.toContain("peoplePanel")
    }
    expect(peopleViewLabel("invitations", t)).toBe("Invitations")
    expect(peopleViewLabel("relations", t)).toBe("Mes relations")
    expect(peopleViewLabel("relations", tEn)).toBe("My relations")
  })
})

describe("parsePeopleView — une URL recopiée ne refuse pas de s'ouvrir", () => {
  it("rend la sous-vue demandée", () => {
    expect(parsePeopleView("suggestions")).toBe("suggestions")
    expect(parsePeopleView("invitations")).toBe("invitations")
  })

  it("tolère casse et espaces", () => {
    expect(parsePeopleView("  Suggestions ")).toBe("suggestions")
    expect(parsePeopleView("INVITATIONS")).toBe("invitations")
  })

  it("retombe sur la sous-vue par défaut, sans erreur", () => {
    expect(parsePeopleView(null)).toBe("relations")
    expect(parsePeopleView(undefined)).toBe("relations")
    expect(parsePeopleView("")).toBe("relations")
    expect(parsePeopleView("   ")).toBe("relations")
    expect(parsePeopleView("inconnue")).toBe("relations")
  })
})

describe("peopleViewHref — le VOLET d'abord, la sous-vue ensuite", () => {
  it("la sous-vue par défaut rend l'adresse du volet, sans paramètre en trop", () => {
    expect(peopleViewHref("relations", HOME)).toBe("/fil?tab=relations")
  })

  it("« Voir tout » des suggestions est une adresse partageable", () => {
    expect(peopleViewHref("suggestions", HOME)).toBe("/fil?tab=relations&vue=suggestions")
    expect(peopleViewHref("invitations", HOME)).toBe("/fil?tab=relations&vue=invitations")
  })

  it("compose sur la base de l'application, même quand elle porte déjà une query ou une ancre", () => {
    expect(peopleViewHref("suggestions", "/r/antsia?lang=fr")).toBe("/r/antsia?lang=fr&tab=relations&vue=suggestions")
    expect(peopleViewHref("invitations", "/accueil#haut")).toBe("/accueil?tab=relations&vue=invitations#haut")
  })

  it("le paramètre est bien celui que la page lit", () => {
    expect(RESEAU_AGENT_VUE_PARAM).toBe("vue")
    expect(peopleViewHref("suggestions", HOME)).toContain(`${RESEAU_AGENT_VUE_PARAM}=`)
  })

  it("l'aller-retour est stable pour les trois sous-vues", () => {
    for (const id of PEOPLE_VIEW_IDS) {
      const href = peopleViewHref(id, HOME)
      const raw = new URLSearchParams(href.slice(href.indexOf("?") + 1)).get(RESEAU_AGENT_VUE_PARAM)
      expect(parsePeopleView(raw)).toBe(id)
    }
  })
})

describe("personTitleLine — le titre publié, et rien d'autre", () => {
  it("le titre publié prend la ligne", () => {
    expect(personTitleLine({ headline: "Archiviste" })).toBe("Archiviste")
  })

  it("rien à dire rend `null` plutôt qu'une mention inventée", () => {
    expect(personTitleLine({})).toBeNull()
    expect(personTitleLine({ headline: null })).toBeNull()
  })

  it("une chaîne d'espaces compte pour absente", () => {
    expect(personTitleLine({ headline: "   " })).toBeNull()
    expect(personTitleLine({ headline: "  Juriste " })).toBe("Juriste")
  })
})

describe("showPresence — « on ne sait pas » n'est pas « hors ligne »", () => {
  it("une RELATION identifiée porte la pastille", () => {
    expect(showPresence("relation", "persons_42")).toBe(true)
  })

  it("une suggestion, une invitation, un résultat de recherche : jamais", () => {
    expect(showPresence("suggestion", "persons_42")).toBe(false)
    expect(showPresence("invitation", "persons_42")).toBe(false)
    expect(showPresence("recherche", "persons_42")).toBe(false)
  })

  it("sans identifiant, aucune pastille — `presenceOf` répondrait pour personne", () => {
    expect(showPresence("relation", null)).toBe(false)
    expect(showPresence("relation", undefined)).toBe(false)
    expect(showPresence("relation", "")).toBe(false)
  })
})

describe("relationErrorText — un refus du moteur se dit par son code, jamais par sa trace", () => {
  const FALLBACK = "reseau:peoplePanel.search.actionFailed"

  it("la règle du domaine enfreinte, avec ses bornes", () => {
    const err = new ConvexError({ code: "invalidArgument", rule: "CONNECTION_MESSAGE_TOO_LONG", params: { max: 300 } })
    expect(relationErrorText(err, FALLBACK, t)).toBe("Un message de mise en relation est limité à 300 caractères.")
  })

  it("le code du moteur, traduit", () => {
    expect(relationErrorText(new ConvexError({ code: "rateLimited" }), FALLBACK, t)).toBe("Trop de tentatives. Réessayez dans quelques instants.")
    expect(relationErrorText(new ConvexError({ code: "notFound" }), FALLBACK, tEn)).not.toContain("errors:")
  })

  it("sans code reconnu, la phrase de l'écran — jamais le message brut", () => {
    const brute = new Error("[CONVEX M(modules/graph/connections:requestConnection)] Server Error")
    expect(relationErrorText(brute, FALLBACK, t)).toBe("Action impossible pour cette personne.")
  })
})

describe("PeoplePanel — la grille est mesurée sur le VOLET (R-04)", () => {
  const source = readFileSync(new URL("./PeoplePanel.tsx", import.meta.url), "utf8")

  it("le palier de 280px réservé à la recherche a disparu", () => {
    expect(source).not.toContain("280px")
    expect(source).not.toContain("@container rp-page")
  })

  it("le volet est son propre conteneur de requête", () => {
    expect(source).toContain("container-type: inline-size")
    expect(source).toContain("container-name: rp-people")
  })

  it("les tuiles partent de 240px, pas de 200px", () => {
    expect(source).toContain("repeat(auto-fill, minmax(240px, 1fr))")
  })

  it("le nom tient sur DEUX lignes", () => {
    expect(source).toContain("-webkit-line-clamp: 2")
    expect(source).toContain("rp-person-name")
  })
})
