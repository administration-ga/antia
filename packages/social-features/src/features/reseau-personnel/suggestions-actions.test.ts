// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/suggestions-actions.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans l'i18n du moteur (`t` français, passé en dernier paramètre ; `busy` explicite pour `relationActionLabel`) ; cas neuf : les mêmes états se disent en anglais avec les mêmes clés ; tous les cas du socle gardés.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  connectButtonLabel,
  offersInvitationAnswer,
  relationActionDisabled,
  relationActionLabel,
  suggestionActionState,
  visibleSuggestions,
} from "./suggestions-actions"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

describe("suggestionActionState", () => {
  it("idle par défaut — rien en cours, rien d'abouti", () => {
    expect(suggestionActionState("alice", null, new Set())).toBe("idle")
  })

  it("busy uniquement pour le handle EN COURS d'appel", () => {
    expect(suggestionActionState("alice", "alice", new Set())).toBe("busy")
    expect(suggestionActionState("bob", "alice", new Set())).toBe("idle")
  })

  it("done l'emporte sur busy — l'action est déjà aboutie", () => {
    expect(suggestionActionState("alice", "alice", new Set(["alice"]))).toBe("done")
  })

  it("done indépendant du handle occupé par ailleurs", () => {
    expect(suggestionActionState("alice", "bob", new Set(["alice"]))).toBe("done")
  })
})

describe("visibleSuggestions", () => {
  const items = [{ handle: "alice" }, { handle: "bob" }]

  it("retire uniquement les personnes masquées pour la session", () => {
    expect(visibleSuggestions(items, new Set(["alice"]))).toEqual([{ handle: "bob" }])
  })

  it("aucune suppression → la liste reste intacte", () => {
    expect(visibleSuggestions(items, new Set())).toEqual(items)
  })

  it("ne mute pas le tableau reçu", () => {
    const copy = [...items]
    visibleSuggestions(items, new Set(["alice"]))
    expect(items).toEqual(copy)
  })
})

describe("connectButtonLabel", () => {
  it("présente l'action réciproque avec un état d'attente explicite", () => {
    expect(connectButtonLabel("idle", t)).toBe("Se connecter")
    expect(connectButtonLabel("busy", t)).toBe("Connexion…")
  })

  it("confirme la demande une fois partie", () => {
    expect(connectButtonLabel("done", t)).toBe("Demande envoyée")
  })

  it("se dit dans la langue de l'écran, avec les mêmes clés", () => {
    expect(connectButtonLabel("idle", tEn)).toBe("Connect")
    expect(connectButtonLabel("done", tEn)).toBe("Request sent")
  })
})

describe("l'état relationnel vient du SERVEUR (R-05)", () => {
  it("« Demande envoyée » survit au rechargement — plus un `useState`", () => {
    // Le défaut : au montage suivant, l'état local était perdu et la carte
    // reproposait « Se connecter » alors que la demande était en base.
    expect(relationActionLabel("requested_by_me", false, t)).toBe("Demande envoyée")
    expect(relationActionDisabled("requested_by_me")).toBe(true)
  })

  it("une invitation REÇUE ne se répond pas par une seconde demande", () => {
    expect(relationActionLabel("requested_by_them", false, t)).toBe("Invitation reçue")
    expect(relationActionDisabled("requested_by_them")).toBe(true)
    expect(offersInvitationAnswer("requested_by_them")).toBe(true)
  })

  it("sans demande en attente, le geste reste ouvert", () => {
    expect(relationActionLabel("none", false, t)).toBe("Se connecter")
    expect(relationActionDisabled("none")).toBe(false)
    expect(offersInvitationAnswer("none")).toBe(false)
    expect(offersInvitationAnswer("requested_by_me")).toBe(false)
  })

  it("l'aller-retour en cours se dit, sans effacer l'état serveur", () => {
    expect(relationActionLabel("none", true, t)).toBe("Connexion…")
    expect(relationActionDisabled("none", true)).toBe(true)
    // `busy` ne peut pas rendre un état serveur plus permissif.
    expect(relationActionLabel("requested_by_me", true, t)).toBe("Demande envoyée")
  })
})
