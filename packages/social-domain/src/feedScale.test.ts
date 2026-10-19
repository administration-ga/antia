// Dupliqué de socle/convex/modules/reseauPersonnel/feedScale.test.ts (l. 1-12, 49-78 et 186-191) @ ad2e7fdc2 — adaptations : les trois cas purs seulement (les deux cas d'intégration suivent le module posts en PA3) ; identifiants en chaînes simples ; cas neufs de la fusion sous frontière.
import { describe, expect, it } from "vitest"

import {
  boundedFeedSourceIds,
  compareFeedPosts,
  cursorForFeedPost,
  exceedsLacunaThreshold,
  isAfterFeedCursor,
  isLacunarFeedWindow,
  mergeFeedWindows,
  PERSONAL_FEED_AUTHORS_MAX,
  shouldMaterializeFeed,
  materializedCursorMatches,
  MATERIALIZED_FEED_HISTORY_MS,
} from "./feedScale"

describe("curseur et mesure du fil", () => {
  it("déclenche la matérialisation au-delà de 200 sources, de 50 pages ou d'une lecture tronquée", () => {
    expect(shouldMaterializeFeed({ personSources: 200, pageSources: 0, truncated: false })).toBe(false)
    expect(shouldMaterializeFeed({ personSources: 200, pageSources: 1, truncated: false })).toBe(true)
    expect(shouldMaterializeFeed({ personSources: 1, pageSources: 51, truncated: false })).toBe(true)
    expect(shouldMaterializeFeed({ personSources: 1, pageSources: 0, truncated: true })).toBe(true)
    expect(MATERIALIZED_FEED_HISTORY_MS).toBe(30 * 86_400_000)
  })

  it("ferme les continuations incomplètes ou d'une autre génération sans convertir un curseur ancien", () => {
    const state = { generation: 3, windowStart: 10, status: "ready" }
    const cursor = { publishedAt: 20, postId: "post", postCreationTime: 25, strategy: "materialized" as const, generation: 3, windowStart: 10 }
    expect(materializedCursorMatches(cursor, state)).toBe(true)
    expect(materializedCursorMatches(cursor, { ...state, status: "building" })).toBe(false)
    expect(materializedCursorMatches(cursor, { ...state, generation: 4 })).toBe(false)
    expect(materializedCursorMatches({ publishedAt: 20, postId: "post" }, state)).toBe(false)
    expect(materializedCursorMatches({ ...cursor, windowStart: 11 }, state)).toBe(false)
    expect(materializedCursorMatches({ ...cursor, postCreationTime: undefined }, state)).toBe(false)
  })
  it("ordonne les ex æquo et conserve seulement les lignes derrière le curseur", () => {
    // Les identifiants contredisent volontairement l'ordre de création :
    // l'index Convex tranche par `_creationTime`, pas par `_id`.
    const newest = { _id: "post-a", _creationTime: 3, publishedAt: 10 }
    const boundary = { _id: "post-z", _creationTime: 2, publishedAt: 10 }
    const olderTie = { _id: "post-m", _creationTime: 1, publishedAt: 10 }
    expect([olderTie, boundary, newest].sort(compareFeedPosts)).toEqual([newest, boundary, olderTie])
    expect(isAfterFeedCursor(olderTie, { publishedAt: 10, postId: boundary._id }, boundary._creationTime)).toBe(true)
    expect(isAfterFeedCursor(newest, { publishedAt: 10, postId: boundary._id }, boundary._creationTime)).toBe(false)
    expect(cursorForFeedPost(boundary)).toEqual({ publishedAt: 10, postId: "post-z" })
  })

  it("borne les sources à 200 mais réserve toujours une place au lecteur", () => {
    const selfId = "user-zzzz"
    const connections = Array.from({ length: PERSONAL_FEED_AUTHORS_MAX + 50 }, (_, index) => `user-${String(index).padStart(4, "0")}`)
    const sources = boundedFeedSourceIds({ selfId, connections, follows: [connections[0] ?? "", selfId] })

    expect(sources).toHaveLength(PERSONAL_FEED_AUTHORS_MAX)
    expect(sources[0]).toBe(selfId)
    expect(new Set(sources).size).toBe(PERSONAL_FEED_AUTHORS_MAX)
    // Limite assumée : après soi + 199 liens déterministes, le reste n'entre pas.
    expect(sources).not.toContain("user-0249")
  })

  it("ne signale une lacune que lorsque la fenêtre pleine ne remplit pas la page", () => {
    expect(isLacunarFeedWindow({ candidatesLength: 200, scanLimit: 200, selectedLength: 3, pageLimit: 20 })).toBe(true)
    expect(isLacunarFeedWindow({ candidatesLength: 199, scanLimit: 200, selectedLength: 3, pageLimit: 20 })).toBe(false)
    expect(exceedsLacunaThreshold({ reads: 100, lacunaryReads: 5 })).toBe(false)
    expect(exceedsLacunaThreshold({ reads: 100, lacunaryReads: 6 })).toBe(true)
  })
})

describe("fusion des fenêtres sous frontière", () => {
  const post = (id: string, publishedAt: number) => ({ _id: id, _creationTime: publishedAt, publishedAt })

  it("sans fenêtre pleine, tout s'examine, dans l'ordre, sans doublon", () => {
    const merged = mergeFeedWindows([
      { rows: [post("a2", 20), post("a1", 10)], wasFull: false },
      { rows: [post("b1", 15), post("a1", 10)], wasFull: false },
    ])
    expect(merged).toEqual({ rows: [post("a2", 20), post("b1", 15), post("a1", 10)], wasFull: false })
  })

  it("une fenêtre pleine pose la frontière : rien de plus ancien que sa dernière ligne n'entre dans la page", () => {
    const merged = mergeFeedWindows([
      { rows: [post("a3", 30), post("a2", 25)], wasFull: true },
      { rows: [post("b2", 27), post("b1", 5)], wasFull: false },
      { rows: [post("c2", 40), post("c1", 26)], wasFull: true },
    ])
    expect(merged.wasFull).toBe(true)
    // La frontière est la PLUS RÉCENTE des dernières lignes pleines : c1 (26).
    expect(merged.rows.map((row) => row._id)).toEqual(["c2", "a3", "b2", "c1"])
  })
})

