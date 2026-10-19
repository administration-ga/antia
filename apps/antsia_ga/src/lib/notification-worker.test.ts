import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

import { NOTIFICATION_REFERENCE_PARAM } from "./notification-open"
import { notificationWorkerScript } from "./notification-worker"
import { routes } from "./routes"

type WorkerEvent = {
  data?: { json: () => unknown }
  notification?: { data: unknown; close: () => void }
  waitUntil: (promise: Promise<unknown>) => void
}

function worker(windows: { url: string; navigate: (href: string) => Promise<{ focus: () => Promise<unknown> } | null> }[] = []) {
  const handlers = new Map<string, (event: WorkerEvent) => void>()
  const showNotification = vi.fn(async (_title: string, _options: unknown) => undefined)
  const openWindow = vi.fn(async (_href: string) => undefined)
  runInNewContext(notificationWorkerScript({ title: "ANTSIA", messages: { fr: "Un nouvel avis.", en: "A new notification." }, openPath: routes.openNotification(), fallbackPath: routes.notificationCenter(), referenceParam: NOTIFICATION_REFERENCE_PARAM }), {
    URL,
    self: {
      addEventListener: (kind: string, handler: (event: WorkerEvent) => void) => handlers.set(kind, handler),
      registration: { scope: "https://antsia.example/", showNotification },
      clients: { matchAll: async () => windows, openWindow },
    },
  })
  const fire = async (kind: string, event: Omit<WorkerEvent, "waitUntil">) => {
    const pending: Promise<unknown>[] = []
    const handler = handlers.get(kind)
    if (!handler) throw new Error("Gestionnaire du worker absent")
    handler({ ...event, waitUntil: (promise) => pending.push(promise) })
    await Promise.all(pending)
  }
  return { fire, showNotification, openWindow }
}

const payload = { version: 1, networkId: "network-current", reference: "delivery_opaque", count: 1, locale: "fr", url: "https://external.example/ignored" }

describe("worker de notification — référence opaque et origine fermée", () => {
  it("affiche un texte neutre et ne conserve que la référence pour le clic", async () => {
    const subject = worker()
    await subject.fire("push", { data: { json: () => payload } })
    expect(subject.showNotification).toHaveBeenCalledWith("ANTSIA", { body: "Un nouvel avis.", tag: "antsia-notification-delivery_opaque", data: { reference: payload.reference } })
    expect(subject.openWindow).not.toHaveBeenCalled()
  })

  it.each([
    { ...payload, preview: "Un texte privé" },
    { ...payload, reference: "https://external.example/" },
    { ...payload, reference: "delivery\n" },
    { ...payload, reference: "x".repeat(65) },
    { ...payload, count: 0 },
    { ...payload, locale: "unknown" },
  ])("rejette un payload hors contrat", async (value) => {
    const subject = worker()
    await subject.fire("push", { data: { json: () => value } })
    expect(subject.showNotification).not.toHaveBeenCalled()
  })

  it("ignore toute destination fournie par le push et ouvre seulement la porte interne", async () => {
    const subject = worker()
    const close = vi.fn()
    await subject.fire("notificationclick", { notification: { data: { reference: payload.reference, path: payload.url }, close } })
    expect(close).toHaveBeenCalledOnce()
    expect(subject.openWindow).toHaveBeenCalledWith(new URL(routes.openNotification(payload.reference), "https://antsia.example").href)
  })

  it("un ancien avis sans référence rejoint seulement les notifications de l’application", async () => {
    const subject = worker()
    await subject.fire("notificationclick", { notification: { data: { path: payload.url }, close: vi.fn() } })
    expect(subject.openWindow).toHaveBeenCalledWith(new URL(routes.notificationCenter(), "https://antsia.example").href)
  })

  it("réutilise une fenêtre de la même origine et laisse les autres fenêtres intactes", async () => {
    const focus = vi.fn(async () => undefined)
    const foreign = { url: "https://external.example/", navigate: vi.fn(async () => ({ focus })) }
    const current = { url: "https://antsia.example/fil", navigate: vi.fn(async () => ({ focus })) }
    const subject = worker([foreign, current])
    await subject.fire("notificationclick", { notification: { data: { reference: payload.reference }, close: vi.fn() } })
    expect(foreign.navigate).not.toHaveBeenCalled()
    expect(current.navigate).toHaveBeenCalledWith(new URL(routes.openNotification(payload.reference), "https://antsia.example").href)
    expect(focus).toHaveBeenCalledOnce()
    expect(subject.openWindow).not.toHaveBeenCalled()
  })
})
