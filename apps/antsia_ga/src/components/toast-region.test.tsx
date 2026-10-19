// @vitest-environment jsdom
/**
 * P18b (A07) — une modale (`useModalA11y`) rend la page inerte, mais PAS la
 * région des toasts : erreurs et confirmations émises pendant le dialogue
 * restent annoncées et atteignables.
 */
import { useModalA11y } from "@antsia/ui"
import { act, useRef } from "react"
import { createPortal } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TOAST_REGION_ATTRIBUTE, ToastRegion } from "./toast-region"

vi.mock("sonner", () => ({ Toaster: () => <section aria-live="polite" data-testid="toasts" /> }))

function Modal() {
  const ref = useRef<HTMLDivElement>(null)
  useModalA11y({ containerRef: ref, onClose: () => undefined })
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true">
      <button type="button">ok</button>
    </div>,
    document.body,
  )
}

function App({ modal }: { modal: boolean }) {
  return (
    <>
      <ToastRegion />
      {modal ? <Modal /> : null}
    </>
  )
}

let root: Root
let container: HTMLDivElement

/** Laisse passer les rappels du `MutationObserver` (micro-tâches) et un tour de boucle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("ToastRegion (P18b, A07)", () => {
  it("monte la région polie des toasts dans son propre hôte, enfant direct de <body>", async () => {
    await act(async () => root.render(<App modal={false} />))
    const host = document.querySelector(`[${TOAST_REGION_ATTRIBUTE}]`)
    expect(host?.parentElement).toBe(document.body)
    expect(host?.querySelector("[aria-live='polite']")).not.toBeNull()
  })

  it("une modale ouverte laisse la page inerte mais pas la région des toasts", async () => {
    await act(async () => root.render(<App modal={false} />))
    await act(async () => root.render(<App modal />))
    await settle()

    const host = document.querySelector(`[${TOAST_REGION_ATTRIBUTE}]`)!
    expect(container.hasAttribute("inert")).toBe(true)
    expect(host.hasAttribute("inert")).toBe(false)

    // Fermeture : la page redevient active, la région reste en place.
    await act(async () => root.render(<App modal={false} />))
    await settle()
    expect(container.hasAttribute("inert")).toBe(false)
    expect(host.isConnected).toBe(true)
  })

  it("l'hôte disparaît avec son fournisseur", async () => {
    await act(async () => root.render(<App modal={false} />))
    await act(async () => root.render(<></>))
    expect(document.querySelector(`[${TOAST_REGION_ATTRIBUTE}]`)).toBeNull()
  })
})
