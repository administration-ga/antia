import { describe, expect, it } from "vitest"

import { parseNotificationReference } from "./notification-open"
import { routes } from "./routes"

describe("continuation fermée d'une notification", () => {
  it.each([undefined, null, [], ["delivery"], "", "x".repeat(65), "https://external.example", "/fil", "a?b=1", "a#b", "a%2fb", "a\nb", "delivery\n"].map((value) => ({ value })))("refuse une valeur autre qu'une référence opaque", ({ value }) => {
    expect(parseNotificationReference(value)).toBeUndefined()
  })

  it("garde une référence au travers des deux portes sans interpréter une URL", () => {
    expect(routes.signIn(undefined, undefined, "delivery_1")).toBe("/entrer?notification=delivery_1")
    expect(routes.signIn("sign-up", undefined, "delivery_1")).toBe("/entrer?inscription=1&notification=delivery_1")
    expect(routes.welcome(undefined, "delivery_1")).toBe("/bienvenue?notification=delivery_1")
    expect(routes.openNotification("delivery_1")).toBe("/notifications/ouvrir?notification=delivery_1")
    expect(routes.signIn(undefined, undefined, "https://external.example")).toBe(routes.signIn())
    expect(routes.welcome(undefined, "https://external.example")).toBe(routes.welcome())
  })

  it("conserve le retour de publication prioritaire et les adresses historiques sans continuation", () => {
    expect(routes.signIn(undefined, "post_1", "delivery_1")).toBe("/entrer?publication=post_1")
    expect(routes.welcome("post_1", "delivery_1")).toBe("/bienvenue?publication=post_1")
    expect(routes.signIn()).toBe("/entrer")
    expect(routes.welcome()).toBe("/bienvenue")
  })
})
