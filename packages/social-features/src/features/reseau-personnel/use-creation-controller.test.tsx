// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/use-creation-controller.test.tsx @ ad2e7fdc2 — adaptations : la « conférence » (absente du moteur tant que le direct n'existe pas) est remplacée par l'« actu » dans le cas du remplacement de surface, et retirée de la liste des formats ouverts puis fermés ; tous les cas du socle portés.
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { consumeConferenceLaunch, getConferenceLaunchRequest } from "../iappel/conference-launch-store"
import { useCreationController } from "./use-creation-controller"

describe("useCreationController", () => {
  it("part fermé", () => {
    const { result } = renderHook(() => useCreationController())
    expect(result.current.open).toBeNull()
  })

  it("ouvre le format demandé, puis le rend à `null`", () => {
    const { result } = renderHook(() => useCreationController())

    act(() => result.current.openCreation("publication"))
    expect(result.current.open).toBe("publication")

    act(() => result.current.close())
    expect(result.current.open).toBeNull()
  })

  it("remplace la surface ouverte sans passer par la fermeture", () => {
    // Deux surfaces montées en même temps donneraient deux pièges de focus
    // empilés : le format ouvert est UNE valeur, jamais un ensemble.
    const { result } = renderHook(() => useCreationController())
    act(() => result.current.openCreation("publication"))
    act(() => result.current.openCreation("actu"))
    expect(result.current.open).toBe("actu")
  })

  it("garde des rappels STABLES — la carte ne se remonte pas à chaque frappe", () => {
    const { result, rerender } = renderHook(() => useCreationController())
    const premierOpen = result.current.openCreation
    const premierClose = result.current.close
    rerender()
    expect(result.current.openCreation).toBe(premierOpen)
    expect(result.current.close).toBe(premierClose)
  })

  it("n'appelle AUCUN geste de navigation — le défaut R-01, en test", () => {
    /*
     * Le hook ne reçoit pas la navigation, il ne peut donc pas l'appeler : ce
     * test le VÉRIFIE plutôt que de s'en remettre à la lecture. On monte un
     * arbre qui capture les gestes de volet à côté du contrôleur, on ouvre et
     * on ferme les formats, et on constate qu'aucun n'a bougé.
     */
    const goToTab = vi.fn()
    const setView = vi.fn()
    const setSearchDraft = vi.fn()
    const push = vi.fn()

    const { result } = renderHook(() => {
      const creation = useCreationController()
      return { creation, goToTab, setView, setSearchDraft, push }
    })

    for (const kind of ["publication", "actu", "evenement", "album"] as const) {
      act(() => result.current.creation.openCreation(kind))
      expect(result.current.creation.open).toBe(kind)
      act(() => result.current.creation.close())
    }

    expect(goToTab).not.toHaveBeenCalled()
    expect(setView).not.toHaveBeenCalled()
    expect(setSearchDraft).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(result.current.creation.open).toBeNull()
  })
})


it("confie le brouillon de conférence à l'hôte au-delà de la bascule", () => {
  consumeConferenceLaunch()
  const view = renderHook(() => useCreationController())
  act(() => view.result.current.openCreation("conference"))
  const request = getConferenceLaunchRequest()
  expect(request?.userIds).toEqual([])
  expect(view.result.current.open).toBeNull()
  view.unmount()
  expect(getConferenceLaunchRequest()).toBe(request)
  consumeConferenceLaunch()
})
