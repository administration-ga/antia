// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/empty-states.test.ts @ ad2e7fdc2 — adaptations : textes lus dans l'i18n du moteur (`t` en dernier paramètre ; règles de longueur et de ponctuation vérifiées en français ET en anglais) ; liens composés sur une base de test injectée (la page réseau de l'application) au lieu de l'adresse de l'espace ; « agent » retiré de l'état vide des suggestions ; textes empruntés comparés aux CLÉS du module voisin (`EMPTY_MY_GROUPS_TEXT_KEY`, `EMPTY_DISCOVER_TEXT_KEY`) et à `emptyAgendaText(t)` ; consommateur `DirectsPanel` retiré du cliquet source (volet Conférences non dupliqué tant que le lot `live` n'est pas livré) ; cas neuf : la part de locale de ce lot ne recopie aucun texte emprunté.
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import frRelations from "../../i18n/locales/fr/reseau.relations.json"
import {
  EMPTY_ACTION_LABEL_MAX,
  EMPTY_TEXT_LENGTH_EXEMPTIONS,
  EMPTY_TEXT_MAX,
  RESEAU_EMPTY_GESTE_IDS,
  RESEAU_EMPTY_STATE_IDS,
  allReseauEmptyStates,
  isShortEmptyText,
  reseauEmptyState,
  type ReseauEmptyStateId,
} from "./empty-states"
import { emptyAgendaText } from "./evenements-list"
import { EMPTY_DISCOVER_TEXT_KEY, EMPTY_MY_GROUPS_TEXT_KEY } from "./groupes-thematiques"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")
const LANGUES = [
  ["fr", t],
  ["en", tEn],
] as const

/** La page réseau de l'application de test : seule l'application sait son adresse. */
const HOME = "/fil"

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8")
}

describe("états vides du réseau — la règle de X-09 (une phrase, au plus une action)", () => {
  it("chaque état a un identifiant unique et se résout", () => {
    expect(new Set(RESEAU_EMPTY_STATE_IDS).size).toBe(RESEAU_EMPTY_STATE_IDS.length)
    for (const id of RESEAU_EMPTY_STATE_IDS) {
      expect(reseauEmptyState(id, HOME, t).id).toBe(id)
    }
    expect(allReseauEmptyStates(HOME, t)).toHaveLength(RESEAU_EMPTY_STATE_IDS.length)
  })

  it("un identifiant inconnu LÈVE — jamais un état muet", () => {
    expect(() => reseauEmptyState("nimporte-quoi" as ReseauEmptyStateId, HOME, t)).toThrow(/État vide inconnu/)
    // Une graphie héritée de l'objet ne trouve rien non plus.
    expect(() => reseauEmptyState("toString" as ReseauEmptyStateId, HOME, t)).toThrow(/État vide inconnu/)
  })

  for (const [langue, tr] of LANGUES) {
    it(`chaque texte tient en UNE phrase courte, hors dispenses inscrites (${langue})`, () => {
      for (const state of allReseauEmptyStates(HOME, tr)) {
        const dispense = EMPTY_TEXT_LENGTH_EXEMPTIONS[state.id]
        if (dispense !== undefined) {
          // Une dispense doit porter une raison, pas exister nue.
          expect(dispense.length).toBeGreaterThan(40)
          continue
        }
        expect(isShortEmptyText(state.text), `${state.id} : « ${state.text} » (${state.text.length} caractères)`).toBe(true)
        expect(state.text.length).toBeLessThanOrEqual(EMPTY_TEXT_MAX)
      }
    })

    it(`une dispense ne survit pas à un texte redevenu court (${langue})`, () => {
      for (const id of Object.keys(EMPTY_TEXT_LENGTH_EXEMPTIONS) as ReseauEmptyStateId[]) {
        expect(isShortEmptyText(reseauEmptyState(id, HOME, tr).text), `${id} est redevenu court : retirer sa dispense`).toBe(false)
      }
    })

    it(`aucun texte n'est vide, ni une clé brute, et tous se terminent par une ponctuation (${langue})`, () => {
      for (const state of allReseauEmptyStates(HOME, tr)) {
        expect(state.text.trim().length).toBeGreaterThan(0)
        expect(state.text).not.toMatch(/^(reseau:)?emptyStates\./)
        expect(state.text.trim()).toMatch(/[.!?]$/)
      }
    })
  }

  it("au plus UNE action, correctement typée", () => {
    for (const [, tr] of LANGUES) {
      for (const state of allReseauEmptyStates(HOME, tr)) {
        if (state.action === null) continue
        expect(state.action.label.length).toBeGreaterThan(0)
        expect(state.action.label.length).toBeLessThanOrEqual(EMPTY_ACTION_LABEL_MAX)
        if (state.action.kind === "lien") {
          // Une adresse du réseau, composée sur la base de l'application —
          // jamais une URL externe ni un « # » décoratif.
          expect(state.action.href.startsWith(HOME)).toBe(true)
        } else {
          expect((RESEAU_EMPTY_GESTE_IDS as readonly string[]).includes(state.action.geste)).toBe(true)
        }
      }
    }
  })

  it("les trois actions retenues sont des LIENS vers une destination réelle", () => {
    const withAction = allReseauEmptyStates(HOME, t).filter((state) => state.action !== null)
    expect(withAction.map((state) => state.id)).toEqual(["signets", "relations-connexions", "relations-abonnements"])
    expect(reseauEmptyState("signets", HOME, t).action).toEqual({
      kind: "lien",
      label: "Ouvrir le fil",
      href: "/fil",
    })
    for (const id of ["relations-connexions", "relations-abonnements"] as const) {
      expect(reseauEmptyState(id, HOME, t).action).toEqual({
        kind: "lien",
        label: "Voir les suggestions",
        href: "/fil?tab=relations&vue=suggestions",
      })
    }
  })
})

describe("textes verrouillés par des suites voisines", () => {
  /**
   * Ces quatre textes sont comparés à distance par des tests montés qui
   * n'importent pas ce module (`PeoplePanel.test.tsx`,
   * `DiscoveryEmptyCard.test.tsx`). Les réaffirmer ici fait échouer la
   * reformulation SUR PLACE, au lieu de la laisser casser une suite voisine.
   */
  it("PeoplePanel et DiscoveryEmptyCard retrouvent leurs phrases", () => {
    expect(reseauEmptyState("relations-recherche", HOME, t).text).toBe("Aucune personne trouvée.")
    expect(reseauEmptyState("suggestions", HOME, t).text).toBe("Aucune nouvelle personne à proposer pour le moment.")
    expect(reseauEmptyState("relations-demandes-envoyees", HOME, t).text).toBe("Aucune demande en attente de réponse.")
    expect(reseauEmptyState("relations-abonnements", HOME, t).text).toMatch(/^Vous ne suivez personne/)
  })

  it("les textes empruntés restent IMPORTÉS, jamais recopiés", () => {
    expect(reseauEmptyState("groupes-mes-groupes", HOME, t).text).toBe(t(EMPTY_MY_GROUPS_TEXT_KEY))
    expect(reseauEmptyState("groupes-decouverte", HOME, t).text).toBe(t(EMPTY_DISCOVER_TEXT_KEY))
    expect(reseauEmptyState("groupes-decouverte", HOME, tEn).text).toBe(tEn(EMPTY_DISCOVER_TEXT_KEY))
    expect(reseauEmptyState("agenda", HOME, t).text).toBe(emptyAgendaText(t))
    expect(reseauEmptyState("agenda", HOME, tEn).text).toBe(emptyAgendaText(tEn))
    // Et la part de locale de ce lot n'en porte aucune copie.
    const ownTexts = JSON.stringify(frRelations)
    for (const id of ["groupes-mes-groupes", "groupes-decouverte", "agenda"] as const) {
      expect(ownTexts).not.toContain(reseauEmptyState(id, HOME, t).text)
    }
  })
})

describe("cliquet SOURCE — les panneaux consomment le registre", () => {
  /**
   * Un module pur que personne n'appelle ne corrige aucun écran (le piège
   * « brancher du code mort »). On exige donc l'import ET l'identifiant de
   * CHAQUE état repris par ce lot, dans le panneau qui le rend.
   *
   * On cherche l'IDENTIFIANT et non l'appel complet : `PeoplePanel` passe par
   * une carte locale — une forme légitime qu'un motif d'appel figé refuserait.
   * Le volet Conférences (`DirectsPanel`) n'est pas encore dupliqué : ses
   * trois états reviendront dans ce cliquet avec lui.
   */
  const CONSUMERS: Record<string, readonly string[]> = {
    "BookmarksPanel.tsx": ['"signets"'],
    "PeoplePanel.tsx": [
      '"relations-connexions"',
      '"relations-abonnements"',
      '"relations-recherche"',
      '"relations-invitations-recues"',
      '"relations-demandes-envoyees"',
      '"suggestions"',
    ],
    "GroupsPanel.tsx": ['"groupes-mes-groupes"', '"groupes-decouverte"'],
    "EvenementsPanel.tsx": ['"agenda"'],
  }

  for (const [file, motifs] of Object.entries(CONSUMERS)) {
    it(`${file} rend ses états vides depuis empty-states`, () => {
      const contents = source(`./${file}`)
      expect(contents).toContain('from "./empty-states"')
      expect(contents).toContain("reseauEmptyState")
      for (const motif of motifs) {
        expect(contents, `${file} doit porter ${motif}`).toContain(motif)
      }
      // La variante compacte n'est pas décorative : c'est la moitié « hauteurs »
      // de X-09. Un panneau qui l'oublie retombe sur 24 px de rembourrage.
      expect(contents).toContain("compact")
    })
  }

  /**
   * Les phrases qui vivaient en littéral DANS le panneau, avant ce lot. Elles
   * doivent avoir disparu de la source : deux d'entre elles portaient la
   * doctrine de confidentialité en pleine carte vide, et une troisième le mode
   * d'emploi d'un geste qui se fait ailleurs.
   *
   * ⚠️ On ne bannit PAS tout `text="…"` : `GroupsPanel` garde trois REFUS
   * d'accès (« Rejoignez ce groupe pour lire… »), qui ne sont pas des absences
   * de contenu et ne relèvent donc pas de ce registre.
   */
  const RETIRED_LITERALS: Record<string, readonly string[]> = {
    "BookmarksPanel.tsx": ["emptyBookmarksText"],
    "PeoplePanel.tsx": [
      'text="Aucune personne trouvée."',
      'text="Aucune invitation en attente."',
      'text="Aucune demande en attente de réponse."',
      'text="Aucun nouvel agent à proposer pour le moment."',
      "Une connexion ouvre vos publications réservées",
      "Suivre quelqu'un ne demande aucun accord",
    ],
  }

  for (const [file, retires] of Object.entries(RETIRED_LITERALS)) {
    it(`${file} n'écrit plus ses états vides en dur`, () => {
      const contents = source(`./${file}`)
      for (const retire of retires) {
        expect(contents, `${file} porte encore « ${retire} »`).not.toContain(retire)
      }
    })
  }
})
