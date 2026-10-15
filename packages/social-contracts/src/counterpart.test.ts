// Dupliqué de socle/convex/modules/reseauPersonnel/messagerie/counterpart.test.ts @ ad2e7fdc2 — adaptations : le nom choisi de la PERSONNE remplace l'état civil du compte ; libellé inconnu neutre (`null`).
import { describe, expect, it } from "vitest"

import { counterpartLabel, type PublishedProfileInput } from "./counterpart"

const PUBLIE: PublishedProfileInput = { displayName: "Nom publié", handle: "n.publie", headline: "Agente", avatarUrl: "https://exemple.test/a.png", hasPublishedProfile: true }
const NEUTRE: PublishedProfileInput = { displayName: null, handle: null, headline: null, avatarUrl: null, hasPublishedProfile: false }

describe("counterpartLabel", () => {
  it("le profil PUBLIÉ gagne toujours, même quand la personne a un autre nom", () => {
    expect(counterpartLabel(PUBLIE, { displayName: "Autre nom" })).toEqual({ ...PUBLIE, source: "published", hasPublishedProfile: undefined } as never)
  })

  it("nomme par le nom CHOISI quand rien n'est publié — un fil doit dire à qui l'on parle", () => {
    expect(counterpartLabel(NEUTRE, { displayName: "  Jean D.  " })).toEqual({ displayName: "Jean D.", handle: null, headline: null, avatarUrl: null, source: "account" })
  })

  it("rend un libellé neutre quand rien ne donne de nom, et n'expose jamais d'e-mail", () => {
    expect(counterpartLabel(NEUTRE, null)).toEqual({ displayName: null, handle: null, headline: null, avatarUrl: null, source: "unknown" })
    expect(counterpartLabel(null, { displayName: "   " }).source).toBe("unknown")
    const serialized = JSON.stringify([counterpartLabel(PUBLIE, null), counterpartLabel(NEUTRE, { displayName: "X" }), counterpartLabel(null, null)])
    expect(serialized).not.toContain("@")
    expect(serialized).not.toContain("email")
  })
})
