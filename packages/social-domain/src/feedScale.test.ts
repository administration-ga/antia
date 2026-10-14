// Dupliqué de socle/convex/modules/reseauPersonnel/feedScale.test.ts (l. 1-12, 49-78 et 186-191) @ ad2e7fdc2 — adaptations : les trois cas purs seulement (les deux cas d'intégration suivent le module posts en PA3) ; identifiants en chaînes simples.
import { describe, expect, it } from "vitest"

import {
  boundedFeedSourceIds,
  compareFeedPosts,
  cursorForFeedPost,
  exceedsLacunaThreshold,
  isAfterFeedCursor,
  isLacunarFeedWindow,
  PERSONAL_FEED_AUTHORS_MAX,
} from "./feedScale"

describe("curseur et mesure du fil", () => {
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
