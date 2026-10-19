// P04 (18/10/2026) : les décisions du lecteur immersif — clavier, créneau lu, ancre, fin, retour, nouvelles publications.
import { describe, expect, it } from "vitest"

import {
  anchorCorrection,
  approachingEnd,
  canScrollWithin,
  endSlotState,
  fillHeight,
  frozenHeadCount,
  neighborOf,
  pickActiveSlot,
  readerKeyIntent,
  restoreStep,
  slotNavigationTarget,
} from "./immersive-reader-model"

const plain = { altKey: false, ctrlKey: false, metaKey: false }

describe("clavier", () => {
  it("bas et Page suivante avancent, haut et Page précédente reculent", () => {
    expect(readerKeyIntent({ ...plain, key: "ArrowDown" })).toBe("next")
    expect(readerKeyIntent({ ...plain, key: "PageDown" })).toBe("next")
    expect(readerKeyIntent({ ...plain, key: "ArrowUp" })).toBe("previous")
    expect(readerKeyIntent({ ...plain, key: "PageUp" })).toBe("previous")
  })

  it("les autres touches et les touches modifiées restent au navigateur", () => {
    expect(readerKeyIntent({ ...plain, key: "ArrowLeft" })).toBeNull()
    expect(readerKeyIntent({ ...plain, key: " " })).toBeNull()
    expect(readerKeyIntent({ ...plain, key: "ArrowDown", ctrlKey: true })).toBeNull()
    expect(readerKeyIntent({ ...plain, key: "PageDown", altKey: true })).toBeNull()
    expect(readerKeyIntent({ ...plain, key: "ArrowUp", metaKey: true })).toBeNull()
  })

  it("passe d'un créneau à l'autre, borné aux deux bouts (primitive `nextIndex` du pager)", () => {
    const order = ["fil:head", "a", "b", "fil:end"]
    expect(slotNavigationTarget(order, "a", "next")).toBe("b")
    expect(slotNavigationTarget(order, "a", "previous")).toBe("fil:head")
    expect(slotNavigationTarget(order, "fil:end", "next")).toBeNull()
    expect(slotNavigationTarget(order, "fil:head", "previous")).toBeNull()
    expect(slotNavigationTarget(order, null, "next")).toBe("fil:head")
    expect(slotNavigationTarget([], "a", "next")).toBeNull()
  })
})

describe("contenu plus haut que l'écran", () => {
  it("le créneau défile d'abord dans le sens demandé, puis rend la main au fil", () => {
    const tall = { clientHeight: 600, scrollHeight: 1500 }
    expect(canScrollWithin({ ...tall, scrollTop: 0 }, "next")).toBe(true)
    expect(canScrollWithin({ ...tall, scrollTop: 0 }, "previous")).toBe(false)
    expect(canScrollWithin({ ...tall, scrollTop: 900 }, "next")).toBe(false)
    expect(canScrollWithin({ ...tall, scrollTop: 900 }, "previous")).toBe(true)
    expect(canScrollWithin({ clientHeight: 600, scrollHeight: 600, scrollTop: 0 }, "next")).toBe(false)
  })
})

describe("la publication lue", () => {
  it("le créneau le plus visible ; à égalité, le premier ; aucun visible : aucun", () => {
    const order = ["a", "b", "c"]
    expect(pickActiveSlot(order, new Map([["a", 0.2], ["b", 0.8]]))).toBe("b")
    expect(pickActiveSlot(order, new Map([["a", 0.5], ["b", 0.5]]))).toBe("a")
    expect(pickActiveSlot(order, new Map())).toBeNull()
  })

  it("la seule voisine préchargée est la publication suivante", () => {
    expect(neighborOf(["a", "b", "c"], "a")).toBe("b")
    expect(neighborOf(["a", "b", "c"], "c")).toBeNull()
    expect(neighborOf(["a", "b"], null)).toBe("a")
    expect(neighborOf(["a", "b"], "fil:end")).toBeNull()
  })

  it("une insertion au-dessus ne déplace pas la lecture : l'ancre se recale d'une scène", () => {
    // Le créneau lu était en haut (0) ; une publication s'insère au-dessus : il descend de 640.
    expect(anchorCorrection({ slotTop: 1280 + 640, scrollTop: 1280, anchorTop: 0 })).toBe(640)
    // Un retrait au-dessus : il remonte.
    expect(anchorCorrection({ slotTop: 640, scrollTop: 1280, anchorTop: 0 })).toBe(-640)
    expect(anchorCorrection({ slotTop: 1280.4, scrollTop: 1280, anchorTop: 0 })).toBe(0)
  })
})

describe("la fin et la suite", () => {
  it("une fenêtre vide AVEC suite n'est jamais une fin", () => {
    expect(endSlotState({ canLoadMore: true, exhausted: false, lastPageEmpty: true })).toBe("emptyWindow")
    expect(endSlotState({ canLoadMore: true, exhausted: false, lastPageEmpty: false })).toBe("more")
    expect(endSlotState({ canLoadMore: false, exhausted: true, lastPageEmpty: true })).toBe("end")
    // Une page qui n'a pas répondu : on ne conclut pas d'un silence.
    expect(endSlotState({ canLoadMore: false, exhausted: false, lastPageEmpty: false })).toBe("waiting")
  })

  it("l'approche de la fin : l'avant-dernière ou la dernière publication lue", () => {
    expect(approachingEnd(18, 20)).toBe(true)
    expect(approachingEnd(19, 20)).toBe(true)
    expect(approachingEnd(10, 20)).toBe(false)
    expect(approachingEnd(-1, 20)).toBe(false)
    expect(approachingEnd(0, 0)).toBe(false)
  })
})

describe("retour à la publication lue", () => {
  it("recharge page par page jusqu'à la retrouver, sans dépasser la profondeur", () => {
    expect(restoreStep({ present: true, canLoadMore: false, exhausted: false, appended: 0, maxAppends: 3 })).toBe("found")
    expect(restoreStep({ present: false, canLoadMore: true, exhausted: false, appended: 0, maxAppends: 3 })).toBe("append")
    expect(restoreStep({ present: false, canLoadMore: true, exhausted: false, appended: 3, maxAppends: 3 })).toBe("missing")
    // Une page en route : attendre sa réponse (réponse tardive).
    expect(restoreStep({ present: false, canLoadMore: false, exhausted: false, appended: 1, maxAppends: 3 })).toBe("wait")
    expect(restoreStep({ present: false, canLoadMore: false, exhausted: true, appended: 1, maxAppends: 3 })).toBe("missing")
  })
})

describe("nouvelles publications reçues en tête", () => {
  it("retient celles qui précèdent la tête figée ; une tête disparue ne cache rien", () => {
    expect(frozenHeadCount(["n2", "n1", "a", "b"], "a")).toBe(2)
    expect(frozenHeadCount(["a", "b"], "a")).toBe(0)
    expect(frozenHeadCount(["x", "y"], "a")).toBe(0)
    expect(frozenHeadCount(["a"], null)).toBe(0)
  })
})

describe("hauteur du lecteur", () => {
  it("la place restante, jamais sous le plancher", () => {
    expect(fillHeight({ available: 612.7, min: 320 })).toBe(612)
    expect(fillHeight({ available: 120, min: 320 })).toBe(320)
    expect(fillHeight({ available: Number.NaN, min: 320 })).toBe(320)
  })
})
