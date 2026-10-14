// Dupliqué de socle/convex/modules/reseauPersonnel/domain.test.ts (l. 254-329) @ ad2e7fdc2 — adaptations : imports depuis ./richText (domaine scindé) ; cas inchangés.
import { describe, expect, it } from "vitest"

import { extractHashtags, extractMentionHandles, HASHTAG_MAX_PER_POST, MENTION_MAX_PER_POST, splitBodyRich } from "./richText"

describe("hashtags", () => {
  it("extrait, met en minuscules, déduplique et plafonne", () => {
    expect(extractHashtags("Rien à signaler")).toEqual([])
    expect(extractHashtags("#Numérique et #numerique et #NUMÉRIQUE")).toEqual(["numérique", "numerique"])
    const many = Array.from({ length: 15 }, (_, i) => `#tag${i}`).join(" ")
    expect(extractHashtags(many)).toHaveLength(HASHTAG_MAX_PER_POST)
  })

  it("ignore ce qui n'est pas un hashtag", () => {
    // Un caractère seul n'est pas un tag ; un « # » de ponctuation non plus.
    expect(extractHashtags("#a # #ok")).toEqual(["ok"])
  })
})

describe("mentions", () => {
  it("cite une personne, jamais une adresse électronique", () => {
    expect(extractMentionHandles("Bonjour @a.ndong")).toEqual(["a.ndong"])
    // LA garde qui distingue une mention d'un e-mail.
    expect(extractMentionHandles("écrire à contact@exemple.ga")).toEqual([])
    expect(extractMentionHandles("(@nadia et ,@paul")).toEqual(["nadia", "paul"])
  })

  it("ne MORD pas sur un séparateur final", () => {
    // « @nadia. » cite `nadia` : le point final n'appartient à aucun handle.
    expect(extractMentionHandles("merci @nadia.")).toEqual(["nadia"])
    expect(extractMentionHandles("merci @nadia, et voilà")).toEqual(["nadia"])
  })

  it("déduplique et plafonne", () => {
    expect(extractMentionHandles("@nadia @Nadia @NADIA")).toEqual(["nadia"])
    const many = Array.from({ length: 15 }, (_, i) => `@user${i}x`).join(" ")
    expect(extractMentionHandles(many)).toHaveLength(MENTION_MAX_PER_POST)
  })
})

describe("découpage riche du corps", () => {
  it("rend des segments, jamais du balisage", () => {
    expect(splitBodyRich("Salut @nadia, voir #numerique !")).toEqual([
      { type: "text", value: "Salut " },
      { type: "mention", value: "nadia" },
      { type: "text", value: ", voir " },
      { type: "tag", value: "numerique" },
      { type: "text", value: " !" },
    ])
  })

  it("reconstruit le corps SANS rien perdre", () => {
    for (const body of [
      "",
      "texte simple",
      "#tag en tête",
      "fin par @nadia",
      "a#b n'est pas un tag, contact@exemple.ga non plus",
      "  espaces   multiples  ",
    ]) {
      const rebuilt = splitBodyRich(body)
        .map((segment) => (segment.type === "text" ? segment.value : segment.type === "tag" ? `#${segment.value}` : `@${segment.value}`))
        .join("")
      expect(rebuilt.toLowerCase()).toBe(body.toLowerCase())
    }
  })
})
