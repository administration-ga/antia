import { describe, expect, it } from "vitest"
import { memberFeedFilter } from "./member-feed-filter"

describe("portées membres adressables", () => {
  it("conserve le fil historique et accepte les filtres exacts", () => {
    expect(memberFeedFilter({})).toEqual({ kind: "personal" })
    expect(memberFeedFilter({ portee: "national", tag: "École", curseur: "opaque" })).toEqual({ kind: "national", tag: "école", cursor: "opaque" })
    expect(memberFeedFilter({ portee: "province", province: "haut-ogooue" })).toEqual({ kind: "national", province: "haut-ogooue" })
  })
  it("une province, portée, liste ou continuation forgée ne devient pas un fil élargi", () => {
    for (const params of [
      { portee: "province", province: "GA" }, { portee: "province" },
      { portee: "national", province: "estuaire" }, { portee: ["national", "province"] },
      { portee: "national", tag: "x&scope=recents" }, { portee: "national", curseur: "x".repeat(4097) },
    ]) expect(memberFeedFilter(params)).toEqual({ kind: "invalid" })
  })
})
