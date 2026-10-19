import { describe, expect, it } from "vitest"

import { parsePublicPostContinuation, PUBLIC_POST_CONTINUATION_PARAM } from "./public-post-continuation"
import { routes } from "./routes"

const POST_ID = "jd7c7gw7f0nkf8kv8dazmw86ps8r4qgq"

describe("retour fermé vers une publication publique", () => {
  it("accepte une référence opaque bornée, sans modifier sa casse", () => {
    expect(parsePublicPostContinuation(POST_ID)).toBe(POST_ID)
    expect(parsePublicPostContinuation("Post_1-2")).toBe("Post_1-2")
    expect(parsePublicPostContinuation("p".repeat(128))).toBe("p".repeat(128))
    expect(parsePublicPostContinuation("p".repeat(129))).toBeUndefined()
  })

  it.each([
    undefined, null, 1, {}, [], [POST_ID], [POST_ID, POST_ID], "",
    "https://example.test", "//example.test", "/fil", "../fil", "javascript:alert(1)",
    `${POST_ID}?returnTo=https://example.test`, `${POST_ID}&admin=1`, `${POST_ID}#fragment`,
    `${POST_ID}%2F`, `${POST_ID}%0A`, ` ${POST_ID}`, `${POST_ID} `,
    `${POST_ID}\n`, `${POST_ID}\r`, `${POST_ID}\u2028`, `${POST_ID}\u0000`, "école",
  ].map((value) => [value] as const))("refuse toute valeur autre qu'un seul identifiant : %j", (value) => {
    expect(parsePublicPostContinuation(value)).toBeUndefined()
  })

  it("garde exactement les anciennes routes quand aucun retour n'est fourni", () => {
    expect(routes.signIn()).toBe("/entrer")
    expect(routes.signIn("sign-up")).toBe("/entrer?inscription=1")
    expect(routes.welcome()).toBe("/bienvenue")
  })

  it("ne transporte que l'identifiant entre connexion, inscription et bienvenue", () => {
    for (const href of [routes.signIn(undefined, POST_ID), routes.signIn("sign-up", POST_ID), routes.welcome(POST_ID)]) {
      const url = new URL(href, "https://example.test")
      expect(url.origin).toBe("https://example.test")
      expect(url.searchParams.get(PUBLIC_POST_CONTINUATION_PARAM)).toBe(POST_ID)
      expect([...url.searchParams.keys()].every((key) => key === PUBLIC_POST_CONTINUATION_PARAM || key === "inscription")).toBe(true)
      expect(url.hash).toBe("")
    }
    expect(routes.signIn("sign-up", POST_ID)).toBe(`/entrer?inscription=1&publication=${POST_ID}`)
    expect(routes.welcome(POST_ID)).toBe(`/bienvenue?publication=${POST_ID}`)
  })

  it("abandonne un retour invalide même lorsqu'une route est appelée directement", () => {
    expect(routes.signIn(undefined, "//example.test")).toBe(routes.signIn())
    expect(routes.signIn("sign-up", "post&returnTo=elsewhere")).toBe(routes.signIn("sign-up"))
    expect(routes.welcome("/admin")).toBe(routes.welcome())
  })
})
