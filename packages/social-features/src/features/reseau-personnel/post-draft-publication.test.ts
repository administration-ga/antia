import { describe, expect, it } from "vitest"
import { draftSetAudience, draftSetPageAudience, draftSetPublication, emptyDraft, parseDrafts, serializeDrafts } from "./post-draft"

describe("PA8 — un brouillon ne déduit jamais une diffusion publique", () => {
  it("les données anciennes et le brouillon neuf sont privés aux membres par défaut", () => {
    expect(emptyDraft("key").alsoOnRoot).toBe(false)
    expect(parseDrafts(JSON.stringify({ v: 1, drafts: { feed: { body: "Texte", audience: "public", pageAudience: "public", idempotencyKey: "key", media: [] } } })).drafts.feed?.alsoOnRoot).toBe(false)
  })
  it("le geste explicite survit pour sa cible, et disparaît dès que l'audience est incompatible", () => {
    let draft = draftSetAudience(emptyDraft("key"), "public")
    draft = draftSetPublication(draft, "feed", { alsoOnRoot: true, province: "estuaire" })
    expect(parseDrafts(serializeDrafts({ composerOpen: false, drafts: { feed: draft } })).drafts.feed).toEqual(draft)
    expect(draftSetAudience(draft, "connections").alsoOnRoot).toBe(false)
    expect(draftSetPageAudience(draft, "followers").alsoOnRoot).toBe(false)
    expect(draftSetPublication(draft, "group:g1", { alsoOnRoot: true, province: "estuaire" })).toMatchObject({ alsoOnRoot: false, province: undefined })
  })
  it("une valeur forgée ou l'opt-in d'un groupe ne se réadopte pas au rechargement", () => {
    const state = parseDrafts(JSON.stringify({ v: 1, drafts: {
      feed: { ...emptyDraft("key"), audience: "connections", alsoOnRoot: true, province: "GA" },
      "group:g1": { ...emptyDraft("group"), audience: "public", alsoOnRoot: true, province: "estuaire" },
    } }))
    expect(state.drafts.feed?.alsoOnRoot).toBe(false)
    expect(state.drafts.feed?.province).toBeUndefined()
    expect(state.drafts["group:g1"]?.alsoOnRoot).toBe(false)
    expect(state.drafts["group:g1"]?.province).toBeUndefined()
  })
})
