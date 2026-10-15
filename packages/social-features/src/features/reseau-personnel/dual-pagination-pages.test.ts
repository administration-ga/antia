// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/dual-pagination-pages.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle, module pur inchangé).
import { describe, expect, it } from "vitest"
import {
  appendDualPage,
  currentDualCursors,
  dualContinuation,
  dualCursorsKey,
  dualPagesLoaded,
  FIRST_DUAL_CURSORS,
  initialDualPages,
  isFirstDualCursors,
  mergeDualRows,
  rebaseDualPages,
  recordDualPage,
  removeDualRow,
  type DualCursors,
  type DualPageData,
  type DualPagesState,
} from "./dual-pagination-pages"

type Row = { connectionId: string; at: number }

const at = (row: Row) => row.at

/** Une page : les lignes des deux côtés, et la continuation de chacun. */
function dualPage(
  low: Row[],
  high: Row[],
  next: { low: string | "fin"; high: string | "fin" },
): DualPageData<Row> {
  return {
    low: {
      page: low,
      isDone: next.low === "fin",
      continueCursor: next.low === "fin" ? "low-fin" : next.low,
    },
    high: {
      page: high,
      isDone: next.high === "fin",
      continueCursor: next.high === "fin" ? "high-fin" : next.high,
    },
  }
}

const C1: DualCursors = { low: "low-1", high: "high-1" }
const C2: DualCursors = { low: "low-2", high: "high-2" }
const C1_BIS: DualCursors = { low: "low-1bis", high: "high-1" }

const ids = (rows: Row[]) => rows.map((row) => row.connectionId)

/** La chaîne première page → C1 → C2, chaque page reçue. */
function threePages(): DualPagesState<Row> {
  let state = initialDualPages<Row>()
  state = recordDualPage(
    state,
    FIRST_DUAL_CURSORS,
    dualPage([{ connectionId: "a", at: 60 }], [{ connectionId: "b", at: 50 }], {
      low: "low-1",
      high: "high-1",
    }),
  )
  state = appendDualPage(state, FIRST_DUAL_CURSORS, C1)
  state = recordDualPage(
    state,
    C1,
    dualPage([{ connectionId: "c", at: 40 }], [{ connectionId: "d", at: 30 }], {
      low: "low-2",
      high: "high-2",
    }),
  )
  state = appendDualPage(state, C1, C2)
  state = recordDualPage(
    state,
    C2,
    dualPage([{ connectionId: "e", at: 20 }], [], { low: "fin", high: "fin" }),
  )
  return state
}

describe("curseurs d'une page — le couple low/high", () => {
  it("la première page a ses deux curseurs nuls, et une clé stable", () => {
    expect(isFirstDualCursors(FIRST_DUAL_CURSORS)).toBe(true)
    expect(isFirstDualCursors(C1)).toBe(false)
    expect(dualCursorsKey(FIRST_DUAL_CURSORS)).toBe("start|start")
    expect(dualCursorsKey(C1)).toBe("low-1|high-1")
  })

  it("la suite d'une page : null seulement quand ses DEUX côtés sont épuisés", () => {
    expect(dualContinuation(dualPage([], [], { low: "fin", high: "fin" }))).toBeNull()
    // Un côté épuisé garde son curseur de fin : la page suivante y rend vide.
    expect(dualContinuation(dualPage([], [], { low: "low-2", high: "fin" }))).toEqual({
      low: "low-2",
      high: "high-fin",
    })
  })

  it("l'état initial : la première page seule, rien de reçu", () => {
    const state = initialDualPages<Row>()
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS])
    expect(currentDualCursors(state)).toEqual(FIRST_DUAL_CURSORS)
    expect(dualPagesLoaded(state)).toBe(false)
  })
})

describe("recordDualPage — ce qu'une page montée a rendu", () => {
  it("range les deux côtés sous la clé de la page, dédoublonnés par relation", () => {
    const state = recordDualPage(
      initialDualPages<Row>(),
      FIRST_DUAL_CURSORS,
      dualPage(
        [{ connectionId: "a", at: 1 }],
        [{ connectionId: "a", at: 2 }, { connectionId: "b", at: 3 }],
        { low: "fin", high: "fin" },
      ),
    )
    expect(dualPagesLoaded(state)).toBe(true)
    expect(state.rows["start|start"]).toEqual([
      { connectionId: "a", at: 2 },
      { connectionId: "b", at: 3 },
    ])
  })

  it("ignore la réponse d'une page qui n'est plus montée — pas de page ressuscitée", () => {
    const state = initialDualPages<Row>()
    const late = recordDualPage(
      state,
      C1,
      dualPage([{ connectionId: "z", at: 1 }], [], { low: "fin", high: "fin" }),
    )
    expect(late).toBe(state)
  })
})

describe("appendDualPage — « Voir plus », ou le chargement automatique", () => {
  it("monte la suite de la dernière page", () => {
    const state = appendDualPage(initialDualPages<Row>(), FIRST_DUAL_CURSORS, C1)
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS, C1])
    expect(currentDualCursors(state)).toEqual(C1)
  })

  it("idempotent : un double-clic ne monte pas deux fois la même page", () => {
    const once = appendDualPage(initialDualPages<Row>(), FIRST_DUAL_CURSORS, C1)
    expect(appendDualPage(once, C1, C1)).toBe(once)
  })

  it("ignore un geste périmé : la suite d'une page qui n'est plus la dernière", () => {
    const once = appendDualPage(initialDualPages<Row>(), FIRST_DUAL_CURSORS, C1)
    // Lue sur la première page, alors que C1 est déjà montée derrière elle.
    expect(appendDualPage(once, FIRST_DUAL_CURSORS, C2)).toBe(once)
  })

  it("rien derrière une page épuisée", () => {
    const state = initialDualPages<Row>()
    expect(appendDualPage(state, FIRST_DUAL_CURSORS, null)).toBe(state)
  })
})

describe("rebaseDualPages — la première page a changé de frontière", () => {
  it("même suite : même référence, rien n'est abandonné", () => {
    const state = threePages()
    expect(rebaseDualPages(state, { low: "low-1", high: "high-1" })).toBe(state)
  })

  it("autre suite : les pages profondes et leurs lignes sont abandonnées, la chaîne repart de la nouvelle frontière", () => {
    const state = threePages()
    const rebased = rebaseDualPages(state, C1_BIS)
    expect(rebased.cursors).toEqual([FIRST_DUAL_CURSORS, C1_BIS])
    expect(currentDualCursors(rebased)).toEqual(C1_BIS)
    expect(Object.keys(rebased.rows)).toEqual(["start|start"])
    expect(ids(mergeDualRows(rebased, at))).toEqual(["a", "b"])
  })

  it("une première page désormais épuisée referme la chaîne sur elle seule", () => {
    const rebased = rebaseDualPages(threePages(), null)
    expect(rebased.cursors).toEqual([FIRST_DUAL_CURSORS])
    expect(currentDualCursors(rebased)).toEqual(FIRST_DUAL_CURSORS)
  })

  it("rien à réaligner tant qu'aucune page n'est montée derrière la première", () => {
    const state = initialDualPages<Row>()
    expect(rebaseDualPages(state, C1)).toBe(state)
  })
})

describe("la première page, toujours vivante, réaligne la chaîne en s'enregistrant", () => {
  it("une invitation acceptée ailleurs : la page périmée ne garde pas de fantôme", () => {
    // « a » a été acceptée sur un autre écran : la première page ne la rend
    // plus, remonte « c » et annonce une autre frontière. Les instantanés de
    // C1 et C2 décrivaient l'ancienne chaîne : ils sont abandonnés.
    const state = recordDualPage(
      threePages(),
      FIRST_DUAL_CURSORS,
      dualPage([{ connectionId: "c", at: 40 }], [{ connectionId: "b", at: 50 }], {
        low: "low-1bis",
        high: "high-1",
      }),
    )
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS, C1_BIS])
    expect(ids(mergeDualRows(state, at))).toEqual(["b", "c"])
  })

  it("une invitation reçue en tête : la ligne poussée hors de la première page n'est pas perdue", () => {
    // Avant la règle : « b », poussée hors de la première page, ne figurait
    // plus dans aucune — C1 commence APRÈS elle. La chaîne repart de la
    // nouvelle frontière, et C1bis la rendra.
    const state = recordDualPage(
      threePages(),
      FIRST_DUAL_CURSORS,
      dualPage([{ connectionId: "n", at: 70 }], [{ connectionId: "a", at: 60 }], {
        low: "low-1bis",
        high: "high-1",
      }),
    )
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS, C1_BIS])
    const next = recordDualPage(
      state,
      C1_BIS,
      dualPage([{ connectionId: "b", at: 50 }], [], { low: "fin", high: "fin" }),
    )
    expect(ids(mergeDualRows(next, at))).toEqual(["n", "a", "b"])
  })

  it("même frontière : les pages profondes restent montées", () => {
    const state = recordDualPage(
      threePages(),
      FIRST_DUAL_CURSORS,
      dualPage([{ connectionId: "a", at: 61 }], [{ connectionId: "b", at: 50 }], {
        low: "low-1",
        high: "high-1",
      }),
    )
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS, C1, C2])
    expect(ids(mergeDualRows(state, at))).toEqual(["a", "b", "c", "d", "e"])
  })
})

describe("removeDualRow — le masquage optimiste reste immédiat", () => {
  it("retire la relation de toutes les pages reçues, au geste", () => {
    const state = removeDualRow(threePages(), "c")
    expect(ids(mergeDualRows(state, at))).toEqual(["a", "b", "d", "e"])
    // La chaîne, elle, ne bouge pas : c'est un masque, pas un réalignement.
    expect(state.cursors).toEqual([FIRST_DUAL_CURSORS, C1, C2])
  })

  it("même référence quand la relation n'y figure pas", () => {
    const state = threePages()
    expect(removeDualRow(state, "inconnue")).toBe(state)
  })

  it("une page VIVANTE qui la rend encore l'y remet : le serveur a raison", () => {
    const masked = removeDualRow(threePages(), "a")
    const again = recordDualPage(
      masked,
      FIRST_DUAL_CURSORS,
      dualPage([{ connectionId: "a", at: 60 }], [{ connectionId: "b", at: 50 }], {
        low: "low-1",
        high: "high-1",
      }),
    )
    expect(ids(mergeDualRows(again, at))).toContain("a")
  })
})

describe("mergeDualRows — l'union affichée", () => {
  it("triée de la plus récente à la plus ancienne, sans doublon", () => {
    expect(ids(mergeDualRows(threePages(), at))).toEqual(["a", "b", "c", "d", "e"])
  })

  it("une relation vue deux fois garde la version d'une page VIVANTE", () => {
    // « c » figure dans l'instantané C1 (figé, ancienne date) et dans la
    // première page, vivante (date à jour) : la première l'emporte.
    const state = recordDualPage(
      threePages(),
      FIRST_DUAL_CURSORS,
      dualPage([{ connectionId: "a", at: 60 }], [{ connectionId: "c", at: 99 }], {
        low: "low-1",
        high: "high-1",
      }),
    )
    const merged = mergeDualRows(state, at)
    expect(merged.filter((row) => row.connectionId === "c")).toEqual([
      { connectionId: "c", at: 99 },
    ])
    expect(ids(merged)[0]).toBe("c")
  })

  it("la page courante l'emporte sur un instantané intermédiaire", () => {
    let state = threePages()
    state = recordDualPage(
      state,
      C2,
      dualPage([{ connectionId: "d", at: 35 }], [], { low: "fin", high: "fin" }),
    )
    const d = mergeDualRows(state, at).filter((row) => row.connectionId === "d")
    expect(d).toEqual([{ connectionId: "d", at: 35 }])
  })
})
