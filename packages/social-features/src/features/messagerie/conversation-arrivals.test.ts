/**
 * P18b (A04) — l'annonce des arrivées d'une conversation : seulement ce qui
 * arrive en bas, d'un autre que moi, et jamais plus que ce que l'écran montre.
 */
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { ARRIVAL_TEXT_MAX, arrivalAnnouncement, type ArrivalMessage } from "./conversation-arrivals"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("en")

const ME = "persons_me"
const message = (id: string, overrides: Partial<ArrivalMessage> = {}): ArrivalMessage => ({
  id,
  senderId: "persons_awa",
  senderName: "Awa",
  text: `Texte ${id}`,
  ...overrides,
})
const history = [message("m1"), message("m2", { senderId: ME, senderName: "Moi" })]

describe("arrivalAnnouncement (P18b, A04)", () => {
  it("l'ouverture d'une conversation ne s'annonce pas (aucun repère encore posé)", () => {
    expect(arrivalAnnouncement({ previous: null, messages: history, selfId: ME, pinned: true, unseen: 0 }, t)).toBeNull()
  })

  it("un message reçu en bas, fil suivi, dit son auteur et son corps", () => {
    const messages = [...history, message("m3", { text: "On se voit à 10 h ?" })]
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages, selfId: ME, pinned: true, unseen: 0 }, t)).toBe(
      "Nouveau message de Awa : On se voit à 10 h ?",
    )
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages, selfId: ME, pinned: true, unseen: 0 }, tEn)).toBe(
      "New message from Awa: On se voit à 10 h ?",
    )
  })

  it("l'historique chargé par le haut ne s'annonce pas (le dernier message n'a pas bougé)", () => {
    const messages = [message("m0"), ...history]
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages, selfId: ME, pinned: true, unseen: 0 }, t)).toBeNull()
  })

  it("mes propres messages, les lignes système et les retraits ne s'annoncent pas", () => {
    const mine = [...history, message("m3", { senderId: ME })]
    const system = [...history, message("m3", { systemText: "Awa a rejoint le groupe" })]
    const deleted = [...history, message("m3", { deleted: true })]
    for (const messages of [mine, system, deleted]) {
      expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages, selfId: ME, pinned: true, unseen: 0 }, t)).toBeNull()
    }
  })

  it("en lisant plus haut, seule la pastille est dite — jamais le corps qui n'est pas à l'écran", () => {
    const messages = [...history, message("m3", { text: "Contenu privé hors écran" })]
    const announced = arrivalAnnouncement({ previous: { lastId: "m2" }, messages, selfId: ME, pinned: false, unseen: 1 }, t)
    expect(announced).toBe("2 nouveaux messages")
    expect(announced).not.toContain("Contenu privé")
  })

  it("plusieurs arrivées d'un coup se comptent ; une pièce sans texte se dit comme telle", () => {
    const many = [...history, message("m3"), message("m4")]
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages: many, selfId: ME, pinned: true, unseen: 0 }, t)).toBe("2 nouveaux messages")
    const piece = [...history, message("m3", { text: null, attachments: [{}] })]
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages: piece, selfId: ME, pinned: true, unseen: 0 }, t)).toBe(
      "Nouveau message de Awa, avec une pièce jointe",
    )
  })

  it("un fil reçu vide annonce son premier message ; un repère disparu fait taire l'annonce", () => {
    expect(arrivalAnnouncement({ previous: { lastId: null }, messages: [message("m1")], selfId: ME, pinned: true, unseen: 0 }, t)).toBe(
      "Nouveau message de Awa : Texte m1",
    )
    expect(arrivalAnnouncement({ previous: { lastId: "disparu" }, messages: [message("m9")], selfId: ME, pinned: true, unseen: 0 }, t)).toBeNull()
  })

  it("un corps masqué se dit masqué, et un corps long est coupé", () => {
    const masked = [...history, message("m3", { masked: true, text: "secret" })]
    expect(arrivalAnnouncement({ previous: { lastId: "m2" }, messages: masked, selfId: ME, pinned: true, unseen: 0 }, t)).not.toContain("secret")
    const long = [...history, message("m3", { text: "a".repeat(ARRIVAL_TEXT_MAX + 50) })]
    const announced = arrivalAnnouncement({ previous: { lastId: "m2" }, messages: long, selfId: ME, pinned: true, unseen: 0 }, t)!
    expect(announced.endsWith("…")).toBe(true)
    expect(announced.length).toBeLessThan(ARRIVAL_TEXT_MAX + 40)
  })
})
