// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-composer-target.test.ts @ ad2e7fdc2 — adaptations : libellés lus par un `t` français (`t` en dernier paramètre) ; une page du moteur (« Association X ») au lieu d'un ministère ; note aux abonnés au lieu de la note de service ; tous les cas du socle portés ; cas ajouté : le mot du fil ne parle ni d'administration ni d'iCorrespondance.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  composerAudienceNote,
  composerDisclaimer,
  composerHeadingLabel,
  composerSubmitLabel,
  isComposerExpanded,
  resolveComposerTarget,
  showsAudienceSelector,
} from "./post-composer-target"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

describe("resolveComposerTarget", () => {
  it("retombe sur le fil quand ni groupe ni page ne sont fournis", () => {
    expect(resolveComposerTarget({})).toEqual({ kind: "feed" })
  })

  it("résout un groupe", () => {
    expect(resolveComposerTarget({ group: { name: "DSI" } })).toEqual({
      kind: "group",
      name: "DSI",
    })
  })

  it("résout une page", () => {
    expect(
      resolveComposerTarget({ asPage: { displayName: "Association X" } })
    ).toEqual({ kind: "page", displayName: "Association X" })
  })

  it("lève si les deux sont fournis — erreur de programmation, jamais un état muet", () => {
    expect(() =>
      resolveComposerTarget({
        group: { name: "DSI" },
        asPage: { displayName: "Association X" },
      })
    ).toThrow(/mutuellement exclusifs/)
  })
})

describe("composerHeadingLabel", () => {
  it("fil", () => {
    expect(composerHeadingLabel({ kind: "feed" }, t)).toBe(
      "Publier sur votre réseau"
    )
  })

  it("groupe", () => {
    expect(composerHeadingLabel({ kind: "group", name: "DSI" }, t)).toBe(
      "Publier dans « DSI »"
    )
  })

  it("page", () => {
    expect(
      composerHeadingLabel({ kind: "page", displayName: "Association X" }, t)
    ).toBe("Publier en tant que Association X")
  })
})

describe("showsAudienceSelector", () => {
  it("le fil ET la page le montrent, le GROUPE non", () => {
    // ⚠️ La page en montre un — avec sa PROPRE liste (communiqué / note aux
    // abonnés), pas celle du fil. Seul le groupe n'en a
    // pas : l'audience y vient du LIEU et ne se choisit pas.
    expect(showsAudienceSelector({ kind: "feed" })).toBe(true)
    expect(
      showsAudienceSelector({ kind: "page", displayName: "Association X" })
    ).toBe(true)
    expect(showsAudienceSelector({ kind: "group", name: "DSI" })).toBe(false)
  })
})

describe("composerAudienceNote", () => {
  it("rien sur le fil — le sélecteur parle à sa place", () => {
    expect(composerAudienceNote({ kind: "feed" }, t)).toBeNull()
  })

  it("le mot du groupe, inchangé au caractère près", () => {
    expect(composerAudienceNote({ kind: "group", name: "DSI" }, t)).toBe(
      "Visible des membres du groupe uniquement."
    )
  })

  it("ne dit plus rien pour une page — elle a son sélecteur", () => {
    // Elle affirmait « toujours visible de tout le réseau ». C'est devenu FAUX
    // le 2026-08-22, et une note qui affirme le faux à l'endroit exact où l'on
    // choisit l'audience est pire qu'une absence de note.
    expect(
      composerAudienceNote({ kind: "page", displayName: "Association X" }, t)
    ).toBeNull()
  })
})

describe("composerDisclaimer", () => {
  it("le mot du fil et du groupe ne prétend pas qu'un signataire est propriétaire", () => {
    const text = composerDisclaimer({ kind: "feed" }, t)
    expect(text).toContain("vous appartient")
    expect(composerDisclaimer({ kind: "group", name: "DSI" }, t)).toBe(text)
  })

  it("le mot du fil ne renvoie ni à une administration ni à iCorrespondance", () => {
    const text = composerDisclaimer({ kind: "feed" }, t)
    expect(text).not.toMatch(/administration/i)
    expect(text).not.toContain("iCorrespondance")
  })

  it("le mot d'une page nomme le signataire, jamais l'auteur", () => {
    const text = composerDisclaimer(
      {
        kind: "page",
        displayName: "Association X",
      },
      t
    )
    expect(text).toContain("signataire")
    expect(text).not.toContain("vous appartient")
  })
})

describe("composerSubmitLabel", () => {
  it("« Publication… » pendant l'envoi, quel que soit le mode", () => {
    expect(composerSubmitLabel({ kind: "feed" }, true, t)).toBe("Publication…")
    expect(
      composerSubmitLabel({ kind: "page", displayName: "Association X" }, true, t)
    ).toBe("Publication…")
  })

  it("« Publier » au repos, hors mode page", () => {
    expect(composerSubmitLabel({ kind: "feed" }, false, t)).toBe("Publier")
    expect(composerSubmitLabel({ kind: "group", name: "DSI" }, false, t)).toBe(
      "Publier"
    )
  })

  it("« Publier en tant que <nom> » au repos, en mode page", () => {
    expect(
      composerSubmitLabel({ kind: "page", displayName: "Association X" }, false, t)
    ).toBe("Publier en tant que Association X")
  })
})

describe("isComposerExpanded — le composeur ouvre le fil, il ne le remplit pas", () => {
  const replie = { focused: false, bodyLength: 0, mediaCount: 0 }

  it("est replié au repos", () => {
    expect(isComposerExpanded(replie)).toBe(false)
  })

  it("se déplie au focus", () => {
    expect(isComposerExpanded({ ...replie, focused: true })).toBe(true)
  })

  it("se déplie dès la première frappe", () => {
    expect(isComposerExpanded({ ...replie, bodyLength: 1 })).toBe(true)
  })

  it("reste déplié quand un média est joint mais que le focus est parti", () => {
    // Le cas qui se rate : replier ici cacherait l'avertissement de
    // publication au moment précis où un brouillon existe.
    expect(isComposerExpanded({ ...replie, mediaCount: 1 })).toBe(true)
  })
})
