import type { Id } from "@antsia/api/engine"
import { describe, expect, it } from "vitest"

import {
  appendFollowPage,
  initialFollowsPages,
  mergedFollowRows,
  nextFollowsCursor,
  recordFollowPage,
  removeFollowRow,
  type FollowRow,
  type FollowsPage,
  type FollowsPagesState,
} from "./follows-pagination"

function person(id: string, displayName = id): FollowRow {
  return { targetPersonId: id as Id<"persons">, displayName, handle: id, headline: null, avatarUrl: null, badges: [], since: 1 }
}

function page(rows: FollowRow[], cursor: string | null = null): FollowsPage {
  return { page: rows, continueCursor: cursor ?? "", isDone: cursor === null }
}

function received(state: FollowsPagesState, index: number, data: FollowsPage) {
  return recordFollowPage(state, state.mounts[index]!, { data, isPending: false, isError: false })
}

function twoPages() {
  let state = received(initialFollowsPages(), 0, page([person("a")], "second"))
  state = appendFollowPage(state)
  return received(state, 1, page([person("b")]))
}

describe("pagination des abonnements", () => {
  it("ne demande aucune autre page avant la réponse du serveur", () => {
    const state = initialFollowsPages()
    expect(nextFollowsCursor(state)).toBeNull()
    expect(appendFollowPage(state)).toBe(state)
  })

  it("la version amont gagne sur un doublon aval, dans l'ordre des pages", () => {
    let state = received(initialFollowsPages(), 0, page([person("a", "Version récente")], "second"))
    state = received(appendFollowPage(state), 1, page([person("a", "Ancienne version"), person("b")]))
    expect(mergedFollowRows(state).map((row) => row.displayName)).toEqual(["Version récente", "b"])
  })

  it("une page vide non terminale laisse continuer le curseur natif", () => {
    const state = received(initialFollowsPages(), 0, page([], "second"))
    expect(nextFollowsCursor(state)).toBe("second")
    expect(appendFollowPage(state).mounts.map((mount) => mount.cursor)).toEqual([null, "second"])
  })

  it("ne remonte pas un curseur déjà présent dans la chaîne", () => {
    let state = received(initialFollowsPages(), 0, page([], "second"))
    state = received(appendFollowPage(state), 1, page([], "second"))
    expect(nextFollowsCursor(state)).toBeNull()
    expect(appendFollowPage(state)).toBe(state)
  })

  it("un déplacement amont abandonne tous les descendants et monte la nouvelle frontière", () => {
    const state = received(twoPages(), 0, page([person("new")], "replacement"))
    expect(state.mounts.map((mount) => mount.cursor)).toEqual([null, "replacement"])
    expect(mergedFollowRows(state).map((row) => row.targetPersonId)).toEqual(["new"])
  })

  it("une page amont devenue terminale démonte ses descendants", () => {
    const state = received(twoPages(), 0, page([person("a")]))
    expect(state.mounts).toHaveLength(1)
    expect(mergedFollowRows(state).map((row) => row.targetPersonId)).toEqual(["a"])
  })

  it("une frontière aval déplacée conserve les pages en amont", () => {
    let state = received(twoPages(), 1, page([person("b")], "third"))
    state = received(appendFollowPage(state), 2, page([person("c")]))
    state = received(state, 1, page([person("b-new")], "replacement"))
    expect(state.mounts.map((mount) => mount.cursor)).toEqual([null, "second", "replacement"])
    expect(mergedFollowRows(state).map((row) => row.targetPersonId)).toEqual(["a", "b-new"])
  })

  it("ignore un rapport abandonné même quand son curseur revient", () => {
    let state = twoPages()
    const old = state.mounts[1]!
    state = received(state, 0, page([person("a")], "replacement"))
    state = received(state, 0, page([person("a")], "second"))
    expect(state.mounts[1]!.id).not.toBe(old.id)
    expect(recordFollowPage(state, old, { data: page([person("stale")]), isPending: false, isError: false })).toBe(state)
  })

  it("une erreur conserve la dernière page valide et ferme le chargement suivant", () => {
    let state = received(twoPages(), 1, page([person("b")], "third"))
    state = recordFollowPage(state, state.mounts[1]!, { data: undefined, isPending: false, isError: true })
    expect(mergedFollowRows(state).map((row) => row.targetPersonId)).toEqual(["a", "b"])
    expect(appendFollowPage(state)).toBe(state)
    state = received(state, 1, page([person("b")], "third"))
    expect(nextFollowsCursor(state)).toBe("third")
  })

  it("un échec amont empêche d'ajouter une page même si l'aval est prêt", () => {
    let state = received(twoPages(), 1, page([person("b")], "third"))
    state = recordFollowPage(state, state.mounts[0]!, { data: undefined, isPending: false, isError: true })
    expect(appendFollowPage(state)).toBe(state)
  })

  it("retire une personne de toutes les pages sans perdre leurs frontières", () => {
    const state = twoPages()
    const removed = removeFollowRow(state, "a")
    expect(mergedFollowRows(removed).map((row) => row.targetPersonId)).toEqual(["b"])
    expect(removed.mounts).toBe(state.mounts)
    expect(mergedFollowRows(state)).toHaveLength(2)
  })
})
