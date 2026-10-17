import { describe, expect, it } from "vitest"
import { analyticsCaptureEndpoint, engineRoutes, routes, usageScreenForPath } from "./routes"

describe("routes et mesure facultative", () => {
  it("encode chaque segment public et chaque filtre adressable", () => {
    expect(routes.publicProfile("a/b?c")).toBe("/@a%2Fb%3Fc")
    expect(routes.publicAlbum("a/b", "x?y")).toBe("/@a%2Fb/albums/x%3Fy")
    expect(routes.officialPage("a/b")).toBe("/pages/a%2Fb")
    expect(routes.publication("x/y")).toBe("/publications/x%2Fy")
    expect(routes.tag("école & mer")).toBe("/tags/%C3%A9cole%20%26%20mer")
    const tag = new URL(routes.memberTag("école & mer"), "https://example.test")
    expect(tag.searchParams.get("tag")).toBe("école & mer")
    expect(tag.searchParams.get("portee")).toBe("national")
    const province = new URL(routes.memberProvince("haut-ogooue"), "https://example.test")
    expect(province.searchParams.get("province")).toBe("haut-ogooue")
    expect(province.searchParams.get("portee")).toBe("province")
  })
  it("garde les routes de membre et les portes publiques distinctes", () => {
    expect(routes.publicProfile("awa")).not.toBe(routes.profile("awa"))
    expect(routes.officialPage("radio")).not.toBe(routes.page("radio"))
    expect(engineRoutes.profile("awa")).toBe(routes.profile("awa"))
    expect(engineRoutes.page("radio")).toBe(routes.page("radio"))
    expect(routes.authSession()).toBe("/api/auth/get-session")
    expect(routes.publicSessionBridge()).toBe("/api/session-bridge")
  })
  it("la vue des recours réseau ne transporte jamais un filtre d'équipe", () => {
    const appeal = new URL(routes.moderationView("appeals", "foreign", "opaque"), "https://example.test")
    expect(appeal.searchParams.get("vue")).toBe("appeals")
    expect(appeal.searchParams.has("equipe")).toBe(false)
    expect(appeal.searchParams.get("curseur")).toBe("opaque")
  })
  it("la navigation mobile rejoint les réglages personnels servis", () => {
    expect(engineRoutes.settings?.()).toBe(routes.personalControls())
  })
  it("projette seulement des catégories, sans identifiants privés", () => {
    expect(usageScreenForPath(routes.profile("private.handle"))).toBe("profile")
    expect(usageScreenForPath(routes.conference("secret-id"))).toBe("conference")
    expect(usageScreenForPath(`${routes.messages()}/private-id`)).toBe("messages")
    expect(usageScreenForPath(routes.signIn())).toBeNull()
    expect(usageScreenForPath(routes.welcome())).toBeNull()
    expect(usageScreenForPath("/unknown/private-id")).toBeNull()
  })
  it("refuse des hosts qui ne sont pas des origines HTTPS pures", () => {
    expect(analyticsCaptureEndpoint("https://usage.example.test")).toBe("https://usage.example.test/i/v0/e/")
    for (const host of [undefined, "", "http://usage.example.test", "https://user@usage.example.test", "https://usage.example.test/path", "https://usage.example.test?x=1", "https://usage.example.test#x", " https://usage.example.test"]) expect(analyticsCaptureEndpoint(host)).toBeNull()
  })
})
