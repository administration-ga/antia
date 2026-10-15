// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/RelationPicker.test.tsx @ ad2e7fdc2 — adaptations : montage dans l'enveloppe du moteur (`renderWithEngine` : i18n français, réseau de test) ; vraies primitives de `@antia/ui` (plus de doublures) ; vivier au DTO du moteur (`personId`) et résultats de recherche au DTO du graphe (`otherPersonId`, titre de profil au lieu de la fonction) ; accès indexés gardés ; cas neuf : le verbe d'envoi par défaut est traduit, celui de l'appelant passe tel quel ; les neuf cas du socle gardés.
// @vitest-environment jsdom

/**
 * RelationPicker — le sélecteur de relations, monté :
 *
 *  1. une personne DÉJÀ MEMBRE ou DÉJÀ INVITÉE a sa case désactivée, et le
 *     libellé le dit — on ne propose pas un geste qui ne peut qu'échouer ;
 *  2. l'envoi rend les personnes RÉELLEMENT cochées, une seule fois ;
 *  3. la recherche serveur prend le relais du pré-filtre local (IC-05) ;
 *  4. l'ouverture met le focus dans la surface, Échap la referme et rend la
 *     main au déclencheur.
 */
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  search: {
    items: [] as unknown[],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    enabled: false,
    eligible: false,
    settled: false,
    term: "",
  },
}))

vi.mock("./use-relation-search", () => ({
  useRelationSearch: () => mocks.search,
  RELATION_SEARCH_MIN_CHARS: 2,
}))

import { RelationPicker, type RelationPickerProps } from "./RelationPicker"
import { toRelationPickerCandidates } from "./relation-picker"

const CANDIDATS = toRelationPickerCandidates([
  { personId: "u-alice", displayName: "Alice Ndong", handle: "alice", headline: "Archiviste", status: "eligible" },
  { personId: "u-bob", displayName: "Bob Mba", handle: "bob", headline: null, status: "member" },
  { personId: "u-carla", displayName: "Carla Obame", handle: "carla", headline: null, status: "invited" },
])

beforeEach(() => {
  mocks.search = {
    items: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    enabled: false,
    eligible: false,
    settled: false,
    term: "",
  }
})

afterEach(cleanup)

function monter(over: Partial<RelationPickerProps> = {}) {
  const onSubmit = vi.fn<RelationPickerProps["onSubmit"]>().mockResolvedValue(undefined)
  renderWithEngine(<RelationPicker label="Inviter des relations dans le groupe" candidates={CANDIDATS} emptyText="Aucune relation à inviter." onSubmit={onSubmit} {...over} />)
  return { onSubmit }
}

describe("RelationPicker — ce que l'on peut cocher", () => {
  it("désactive la case d'un membre et d'un invité, et NOMME leur statut", () => {
    monter()
    const alice = screen.getByRole("checkbox", { name: /Alice Ndong/ })
    const bob = screen.getByRole("checkbox", { name: /Bob Mba/ })
    const carla = screen.getByRole("checkbox", { name: /Carla Obame/ })
    expect((alice as HTMLInputElement).disabled).toBe(false)
    expect((bob as HTMLInputElement).disabled).toBe(true)
    expect((carla as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText("Déjà membre")).toBeTruthy()
    expect(screen.getByText("Invitation en attente")).toBeTruthy()
  })

  it("l'envoi ne porte que les personnes cochées, une seule fois", async () => {
    const { onSubmit } = monter()
    fireEvent.click(screen.getByRole("checkbox", { name: /Alice Ndong/ }))
    const envoyer = screen.getByRole("button", { name: "Inviter 1 personne" })
    fireEvent.click(envoyer)
    await Promise.resolve()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0].map((row) => row.userId)).toEqual(["u-alice"])
  })

  it("rien de coché : le bouton d'envoi est inerte", () => {
    monter()
    const envoyer = screen.getByRole("button", { name: "Inviter" })
    expect((envoyer as HTMLButtonElement).disabled).toBe(true)
  })

  it("le verbe de l'appelant passe tel quel, accordé au nombre", () => {
    monter({ submitVerb: "Ajouter" })
    fireEvent.click(screen.getByRole("checkbox", { name: /Alice Ndong/ }))
    expect(screen.getByRole("button", { name: "Ajouter 1 personne" })).toBeTruthy()
  })
})

describe("RelationPicker — recherche et pannes", () => {
  it("le pré-filtre local répond avant la recherche serveur", () => {
    monter()
    fireEvent.change(screen.getByLabelText("Chercher parmi mes relations"), {
      target: { value: "obame" },
    })
    expect(screen.queryByRole("checkbox", { name: /Alice Ndong/ })).toBeNull()
    expect(screen.getByRole("checkbox", { name: /Carla Obame/ })).toBeTruthy()
  })

  it("la recherche serveur ramène une relation ABSENTE du vivier (IC-05)", () => {
    mocks.search = {
      ...mocks.search,
      eligible: true,
      settled: true,
      items: [{ otherPersonId: "u-dede", displayName: "Dédé Nzé", handle: "dede", headline: "Inspecteur" }],
    }
    monter({ truncated: true })
    fireEvent.change(screen.getByLabelText("Chercher parmi mes relations"), {
      target: { value: "dede" },
    })
    expect(screen.getByRole("checkbox", { name: /Dédé Nzé/ })).toBeTruthy()
  })

  it("une recherche en panne se dit et propose Réessayer", () => {
    mocks.search = { ...mocks.search, eligible: true, isError: true }
    monter()
    fireEvent.change(screen.getByLabelText("Chercher parmi mes relations"), {
      target: { value: "alice" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.search.refetch).toHaveBeenCalledTimes(1)
  })

  it("aucune relation à proposer : l'état vide de l'appelant, jamais un vide inventé", () => {
    renderWithEngine(<RelationPicker label="Inviter des relations dans le groupe" candidates={[]} emptyText="Aucune relation à inviter." onSubmit={vi.fn()} />)
    expect(screen.getByText("Aucune relation à inviter.")).toBeTruthy()
  })
})

describe("RelationPicker — focus et clavier", () => {
  it("l'ouverture pose le focus dans la surface", () => {
    monter()
    expect(document.activeElement).toBe(screen.getByLabelText("Chercher parmi mes relations"))
  })

  it("Échap referme la surface — et rien d'autre", () => {
    const onClose = vi.fn()
    monter({ onClose })
    fireEvent.keyDown(screen.getByRole("group", { name: "Inviter des relations dans le groupe" }), {
      key: "Escape",
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
