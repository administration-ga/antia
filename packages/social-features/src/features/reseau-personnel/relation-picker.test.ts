// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/relation-picker.test.ts @ ad2e7fdc2 — adaptations : vivier au DTO du moteur (`listInviteCandidates` : `personId`, nom nullable) et résultats de recherche au DTO du graphe (`otherPersonId`) ; la ligne sous le nom est le titre de profil (la « fonction » du poste est retirée : le cas « la fonction d'abord » devient « le titre de profil ») ; libellés lus dans l'i18n du moteur (`t` français en dernier paramètre) ; accès indexés gardés (`noUncheckedIndexedAccess`) ; cas neufs : un nom absent retombe sur l'identifiant public (ou la ligne n'est pas proposée), verbe par défaut traduit en anglais.
/**
 * relation-picker — le sélecteur de relations décide HORS de React :
 *
 *  1. le vocabulaire est celui du sélecteur d'appel (`AddToCallCandidate`
 *     passe tel quel) — un seul contrat pour les deux surfaces ;
 *  2. un statut « déjà membre » ou « invitation en attente » n'est pas
 *     sélectionnable, et le dit ;
 *  3. la liste montrée vient du vivier local tant que la recherche serveur
 *     n'a pas parlé — et un vide n'est EXHAUSTIF que quand on a vraiment tout
 *     regardé (le défaut IC-05, repris ici).
 */
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import type { AddToCallCandidate } from "../iappel/add-to-call-candidates"
import {
  isRelationPickerSelectable,
  relationPickerEmptyText,
  relationPickerListState,
  relationPickerSelectionLabel,
  relationPickerStatusIndex,
  relationPickerStatusLabel,
  relationPickerStatusOf,
  relationPickerSubmitLabel,
  searchHitsToRelationPickerCandidates,
  toRelationPickerCandidates,
  toggleRelationPickerSelection,
  type RelationPickerCandidate,
  type RelationPickerSourceRow,
} from "./relation-picker"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

/** Le vivier tel que `thematicGroups.listInviteCandidates` le rend (`items`). */
const VIVIER: RelationPickerSourceRow[] = [
  {
    personId: "u-alice",
    displayName: "Alice Ndong",
    handle: "alice",
    headline: "Archiviste",
    status: "eligible",
  },
  {
    personId: "u-bob",
    displayName: "Bob Mba",
    handle: "bob",
    headline: null,
    status: "member",
  },
  {
    personId: "u-carla",
    displayName: "Carla Obame",
    handle: "carla",
    headline: "Juriste",
    status: "invited",
  },
]

function snapshot(
  over: Partial<{
    eligible: boolean
    settled: boolean
    isError: boolean
    items: RelationPickerCandidate[]
  }> = {},
) {
  return {
    eligible: false,
    settled: false,
    isError: false,
    items: [] as RelationPickerCandidate[],
    ...over,
  }
}

/** Les trois candidats du vivier, nommés — un vivier sans eux n'aurait rien à tester. */
function trois(): [RelationPickerCandidate, RelationPickerCandidate, RelationPickerCandidate] {
  const [alice, bob, carla] = toRelationPickerCandidates(VIVIER)
  if (!alice || !bob || !carla) throw new Error("vivier incomplet")
  return [alice, bob, carla]
}

describe("le vocabulaire du sélecteur", () => {
  it("accepte TEL QUEL un candidat du sélecteur d'appel (interface commune)", () => {
    const appel: AddToCallCandidate = {
      userId: "u-alice",
      name: "Alice Ndong",
      position: "Archiviste",
      handle: "alice",
    }
    const candidat: RelationPickerCandidate = appel
    expect(relationPickerStatusOf(candidat)).toBe("eligible")
    expect(isRelationPickerSelectable(candidat)).toBe(true)
  })

  it("traduit le vivier serveur — le titre de profil sous le nom", () => {
    const candidats = toRelationPickerCandidates(VIVIER)
    expect(candidats.map((row) => row.userId)).toEqual(["u-alice", "u-bob", "u-carla"])
    expect(candidats[0]).toEqual({
      userId: "u-alice",
      name: "Alice Ndong",
      handle: "alice",
      position: "Archiviste",
      status: "eligible",
    })
    expect(candidats[1]?.position).toBeNull()
  })

  it("dédoublonne par personne", () => {
    const candidats = toRelationPickerCandidates([...VIVIER, ...VIVIER.slice(0, 1)])
    expect(candidats).toHaveLength(3)
  })

  it("un nom absent retombe sur l'identifiant public — sinon la ligne n'est pas proposée", () => {
    const candidats = toRelationPickerCandidates([
      { personId: "u-dede", displayName: null, handle: "dede", headline: null, status: "eligible" },
      { personId: "u-x", displayName: "   ", handle: null, status: "eligible" },
    ])
    expect(candidats).toEqual([{ userId: "u-dede", name: "@dede", handle: "dede", position: null, status: "eligible" }])
  })

  it("traduit les résultats de la recherche serveur avec le statut connu", () => {
    const statusOf = relationPickerStatusIndex(toRelationPickerCandidates(VIVIER))
    const trouvés = searchHitsToRelationPickerCandidates(
      [
        { otherPersonId: "u-bob", displayName: "Bob Mba", handle: "bob" },
        {
          otherPersonId: "u-dede",
          displayName: "Dédé Nzé",
          handle: "dede",
          headline: "Inspecteur",
        },
      ],
      statusOf,
    )
    // Un co-membre reste « déjà membre » même trouvé par la recherche…
    expect(trouvés[0]?.status).toBe("member")
    // …et une relation INCONNUE du vivier (au-delà du plafond) est éligible :
    // le serveur reste seul juge à l'invitation.
    expect(trouvés[1]).toEqual({
      userId: "u-dede",
      name: "Dédé Nzé",
      handle: "dede",
      position: "Inspecteur",
      status: "eligible",
    })
  })
})

describe("statut et sélection", () => {
  it("nomme le statut, et ne rend sélectionnable que l'éligible", () => {
    expect(relationPickerStatusLabel("eligible", t)).toBeNull()
    expect(relationPickerStatusLabel("member", t)).toBe("Déjà membre")
    expect(relationPickerStatusLabel("invited", t)).toBe("Invitation en attente")
    const candidats = toRelationPickerCandidates(VIVIER)
    expect(candidats.map(isRelationPickerSelectable)).toEqual([true, false, false])
  })

  it("bascule la sélection — et REFUSE d'y faire entrer un non-éligible", () => {
    const [alice, bob] = trois()
    expect(toggleRelationPickerSelection([], alice)).toEqual(["u-alice"])
    expect(toggleRelationPickerSelection(["u-alice"], alice)).toEqual([])
    expect(toggleRelationPickerSelection(["u-alice"], bob)).toEqual(["u-alice"])
  })

  it("compte la sélection et accorde le bouton", () => {
    expect(relationPickerSelectionLabel(0, t)).toBe("Aucune personne sélectionnée")
    expect(relationPickerSelectionLabel(1, t)).toBe("1 personne sélectionnée")
    expect(relationPickerSelectionLabel(3, t)).toBe("3 personnes sélectionnées")
    expect(relationPickerSubmitLabel(0, undefined, t)).toBe("Inviter")
    expect(relationPickerSubmitLabel(1, undefined, t)).toBe("Inviter 1 personne")
    expect(relationPickerSubmitLabel(4, undefined, t)).toBe("Inviter 4 personnes")
    expect(relationPickerSubmitLabel(2, "Ajouter", t)).toBe("Ajouter 2 personnes")
  })

  it("le verbe par défaut et l'accord se disent aussi en anglais", () => {
    expect(relationPickerSubmitLabel(0, undefined, tEn)).toBe("Invite")
    expect(relationPickerSubmitLabel(1, undefined, tEn)).toBe("Invite 1 person")
    expect(relationPickerSelectionLabel(2, tEn)).toBe("2 people selected")
  })
})

describe("ce que la liste montre", () => {
  const candidats = toRelationPickerCandidates(VIVIER)

  it("sans terme : tout le vivier, source locale", () => {
    const état = relationPickerListState({
      terme: "",
      candidates: candidats,
      truncated: false,
      search: snapshot(),
    })
    expect(état).toEqual({ kind: "liste", items: candidats, source: "local" })
  })

  it("un terme court filtre LOCALEMENT, nom ou @identifiant", () => {
    const parNom = relationPickerListState({
      terme: "obame",
      candidates: candidats,
      truncated: false,
      search: snapshot(),
    })
    expect(parNom.kind).toBe("liste")
    expect(parNom.kind === "liste" ? parNom.items.map((r) => r.userId) : []).toEqual(["u-carla"])
    const parHandle = relationPickerListState({
      terme: "@bob",
      candidates: candidats,
      truncated: false,
      search: snapshot(),
    })
    expect(parHandle.kind === "liste" ? parHandle.items[0]?.userId : null).toBe("u-bob")
  })

  it("recherche serveur en route : le pré-filtre local tient l'écran", () => {
    const état = relationPickerListState({
      terme: "nd",
      candidates: candidats,
      truncated: true,
      search: snapshot({ eligible: true }),
    })
    expect(état.kind).toBe("attente")
    expect(état.kind === "attente" ? état.items.map((r) => r.userId) : []).toEqual(["u-alice"])
  })

  it("recherche serveur aboutie : ses résultats REMPLACENT le pré-filtre", () => {
    const trouvé: RelationPickerCandidate = {
      userId: "u-dede",
      name: "Dédé Nzé",
      handle: "dede",
      position: null,
      status: "eligible",
    }
    const état = relationPickerListState({
      terme: "dede",
      candidates: candidats,
      truncated: true,
      search: snapshot({ eligible: true, settled: true, items: [trouvé] }),
    })
    expect(état).toEqual({ kind: "liste", items: [trouvé], source: "serveur" })
  })

  it("une panne de recherche se dit, sans vider l'écran", () => {
    const état = relationPickerListState({
      terme: "alice",
      candidates: candidats,
      truncated: false,
      search: snapshot({ eligible: true, isError: true }),
    })
    expect(état.kind).toBe("erreur")
    expect(état.kind === "erreur" ? état.items.length : 0).toBe(1)
  })

  it("un vide n'est EXHAUSTIF que si le vivier n'a pas été tronqué (IC-05)", () => {
    const tronqué = relationPickerListState({
      terme: "zz",
      candidates: candidats,
      truncated: true,
      search: snapshot(),
    })
    expect(tronqué).toEqual({ kind: "vide", exhaustive: false })
    const complet = relationPickerListState({
      terme: "zz",
      candidates: candidats,
      truncated: false,
      search: snapshot(),
    })
    expect(complet).toEqual({ kind: "vide", exhaustive: true })
    const serveur = relationPickerListState({
      terme: "zzz",
      candidates: candidats,
      truncated: true,
      search: snapshot({ eligible: true, settled: true, items: [] }),
    })
    expect(serveur).toEqual({ kind: "vide", exhaustive: true })
  })
})

describe("l'état vide dit POURQUOI il est vide", () => {
  const vivier = toRelationPickerCandidates(VIVIER)
  const etat = (terme: string, truncated: boolean, search = snapshot()) => relationPickerListState({ terme, candidates: vivier, truncated, search })

  it("sans terme : la phrase de l'appelant (« personne à proposer »)", () => {
    expect(
      relationPickerEmptyText(
        {
          terme: "",
          state: etat("", false),
          emptyText: "Aucune relation à inviter.",
        },
        t,
      ),
    ).toBe("Aucune relation à inviter.")
  })

  it("réponse exhaustive : « aucune relation ne correspond »", () => {
    expect(
      relationPickerEmptyText(
        {
          terme: "zz",
          state: etat("zz", false),
          emptyText: "Aucune relation à inviter.",
        },
        t,
      ),
    ).toBe("Aucune relation ne correspond.")
  })

  it("vivier tronqué : on ne conclut PAS — la recherche se poursuit", () => {
    expect(
      relationPickerEmptyText(
        {
          terme: "zz",
          state: etat("zz", true),
          emptyText: "Aucune relation à inviter.",
        },
        t,
      ),
    ).toBe("Aucune relation chargée ne correspond — la recherche se poursuit.")
  })
})
