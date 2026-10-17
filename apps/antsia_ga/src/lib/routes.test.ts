import { describe, expect, it } from "vitest"
import { analyticsCaptureEndpoint, engineRoutes, routes, usageScreenForPath } from "./routes"

describe("routes et mesure facultative", () => {
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
