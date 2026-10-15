import { describe, expect, it } from "vitest"

import { notificationDedupKey, notificationResolutionPrefix, notificationSubjectKey } from "./notifications"

describe("cloche — clés de dédoublonnage et de résolution", () => {
  it("le sujet s'écrit `nature:identifiant`, l'absence `-`", () => {
    expect(notificationSubjectKey({ kind: "post", id: "p1" })).toBe("post:p1")
    expect(notificationSubjectKey(null)).toBe("-")
  })

  it("la clé est `genre|sujet|acteur`, l'acteur absent s'écrit `-`", () => {
    expect(notificationDedupKey("post_reaction", { kind: "post", id: "p1" }, "a1")).toBe("post_reaction|post:p1|a1")
    expect(notificationDedupKey("file_withheld", { kind: "fileScan", id: "s1" }, null)).toBe("file_withheld|fileScan:s1|-")
  })

  it("les genres sans sujet de la tranche diaspora : un retrait par la modération ne désigne personne", () => {
    expect(notificationDedupKey("sponsorship_received", null, "parrain")).toBe("sponsorship_received|-|parrain")
    expect(notificationDedupKey("sponsorship_withdrawn", null, null)).toBe("sponsorship_withdrawn|-|-")
    expect(notificationDedupKey("attestation_not_confirmed", null, null)).toBe("attestation_not_confirmed|-|-")
  })

  it("le préfixe de résolution couvre toutes les lignes du sujet, quel que soit l'acteur", () => {
    const prefix = notificationResolutionPrefix("connection_request", { kind: "connection", id: "c1" })
    expect(notificationDedupKey("connection_request", { kind: "connection", id: "c1" }, "x").startsWith(prefix)).toBe(true)
    expect(notificationDedupKey("connection_request", { kind: "connection", id: "c10" }, "x").startsWith(prefix)).toBe(false)
  })
})
