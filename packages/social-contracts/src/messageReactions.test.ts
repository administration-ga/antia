import { describe, expect, it } from "vitest"

import { applyMessageReactionDelta, emptyMessageReactionCounts, nextMessageReactionKind, totalMessageReactions } from "./messageReactions"

describe("réactions à un message", () => {
  it("poser, remplacer, retirer — jamais sous zéro ; reposer le même genre retire", () => {
    const posed = applyMessageReactionDelta(undefined, null, "like")
    expect(posed).toEqual({ ...emptyMessageReactionCounts(), like: 1 })
    const replaced = applyMessageReactionDelta(posed, "like", "love")
    expect(replaced).toMatchObject({ like: 0, love: 1 })
    expect(applyMessageReactionDelta(emptyMessageReactionCounts(), "sad", null).sad).toBe(0)
    expect(nextMessageReactionKind("like", "like")).toBeNull()
    expect(nextMessageReactionKind("like", "pray")).toBe("pray")
    expect(totalMessageReactions({ ...emptyMessageReactionCounts(), like: 2, wow: 1 })).toBe(3)
    expect(totalMessageReactions(undefined)).toBe(0)
  })
})
