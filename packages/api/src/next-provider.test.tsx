import type { EffectCallback, ReactNode, RefObject, SetStateAction } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { makeFunctionReference } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  authenticated: false,
  loading: false,
  active: undefined as boolean | undefined,
  signingOut: false,
  effects: [] as EffectCallback[],
  stateValues: [] as Array<{ value: unknown }>,
  stateIndex: 0,
  refs: [] as Array<RefObject<unknown>>,
  refIndex: 0,
  ensurePerson: vi.fn(async () => undefined),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}))

// Le rendu serveur vérifie les surfaces réellement montées. Ce harnais retient
// l'état et les vrais objets de ref entre deux rendus manuels ; les effets sont
// retenus pour vérifier les transitions et le rechargement sans navigateur.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>()
  return {
    ...react,
    useEffect: (effect: EffectCallback) => { state.effects.push(effect) },
    useRef: <T,>(initialValue: T) => {
      const ref = react.useRef(initialValue)
      const index = state.refIndex++
      state.refs[index] ??= ref
      return state.refs[index] as RefObject<T>
    },
    useState: <T,>(initialValue: T | (() => T)) => {
      const index = state.stateIndex++
      const cell = state.stateValues[index] ??= {
        value: typeof initialValue === "function" ? (initialValue as () => T)() : initialValue,
      }
      const setValue = (next: SetStateAction<T>) => {
        cell.value = typeof next === "function" ? (next as (previous: T) => T)(cell.value as T) : next
      }
      return [cell.value as T, setValue] as const
    },
  }
})
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: state.loading }),
  useQuery: (...args: unknown[]) => { state.useQuery(...args); return state.active },
  useMutation: (...args: unknown[]) => { state.useMutation(...args); return state.ensurePerson },
}))
vi.mock("@convex-dev/react-query", () => ({
  ConvexQueryClient: class {
    convexClient = {}
    hashFn() { return () => "query" }
    queryFn() { return () => undefined }
    connect() {}
  },
}))
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("./stable-convex-better-auth-provider", () => ({
  StableConvexBetterAuthProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("./sign-out-everywhere", () => ({
  isSigningOutEverywhere: () => state.signingOut,
}))

import { EngineConvexProvider } from "./next-provider"

const sessionQuery = makeFunctionReference<"query", Record<string, never>, boolean>("platform/authentication:mySession")
const ensurePerson = makeFunctionReference<"mutation">("people/persons:ensureMyPerson")
const authClient = {
  getSession: vi.fn(async () => null),
  convex: { token: vi.fn(async () => null) },
  signOut: vi.fn(async () => undefined),
  revokeSessions: vi.fn(async () => undefined),
}
const reload = vi.fn()
const labels = { loading: "Vérification de la session", failed: "Échec", retry: "Réessayer" }

function render(withSessionGate = true): string {
  state.effects = []
  state.stateIndex = 0
  state.refIndex = 0
  return renderToStaticMarkup(
    <EngineConvexProvider convexUrl="https://engine.example" authClient={authClient} ensurePerson={ensurePerson} isSessionActive={withSessionGate ? sessionQuery : undefined} labels={labels}>
      <div>Contenu personnel</div>
    </EngineConvexProvider>,
  )
}

function runEffects(): Array<() => void> {
  const cleanups: Array<() => void> = []
  for (const effect of state.effects) {
    const cleanup = effect()
    if (typeof cleanup === "function") cleanups.push(cleanup)
  }
  return cleanups
}

beforeEach(() => {
  vi.clearAllMocks()
  state.authenticated = false
  state.loading = false
  state.active = undefined
  state.signingOut = false
  state.effects = []
  state.stateValues = []
  state.refs = []
  state.stateIndex = 0
  state.refIndex = 0
  vi.stubGlobal("window", { location: { reload } })
})
afterEach(() => {
  vi.restoreAllMocks()
  state.ensurePerson.mockReset()
  state.ensurePerson.mockResolvedValue(undefined)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("EngineConvexProvider — garde réactive de session", () => {
  it("ne synchronise aucune personne pendant notre déconnexion même si un ancien état authentifié revient", () => {
    state.authenticated = true
    state.active = true
    state.signingOut = true
    render()
    runEffects()
    expect(state.ensurePerson).not.toHaveBeenCalled()
  })

  it("une synchronisation refusée après le début de déconnexion ne signale pas un échec de création", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let reject!: (error: Error) => void
    state.ensurePerson.mockReturnValueOnce(new Promise<undefined>((_resolve, fail) => { reject = fail }))
    state.authenticated = true
    state.active = true
    render()
    runEffects()
    state.signingOut = true
    reject(new Error("unauthenticated"))
    await Promise.resolve()
    expect(warn).not.toHaveBeenCalled()
  })

  it("reste compatible avec les hôtes sans requête de session", () => {
    state.authenticated = true
    expect(render(false)).toContain("Contenu personnel")
    expect(state.useQuery).not.toHaveBeenCalled()
    runEffects()
    expect(state.ensurePerson).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
  })

  it("attend la preuve serveur avant de monter PersonSync et les données personnelles", () => {
    state.authenticated = true
    const html = render()
    expect(html).toContain('role="status"')
    expect(html).toContain(labels.loading)
    expect(html).not.toContain("Contenu personnel")
    expect(state.useQuery).toHaveBeenCalledWith(sessionQuery, {})
    expect(state.useMutation).not.toHaveBeenCalled()
    runEffects()
    expect(reload).not.toHaveBeenCalled()
  })

  it("un chargement initial sans session validée ne monte aucune surface personnelle", () => {
    state.loading = true
    expect(render()).not.toContain("Contenu personnel")
    expect(state.useMutation).not.toHaveBeenCalled()
    runEffects()
    expect(reload).not.toHaveBeenCalled()
  })

  it("monte les données et synchronise la personne seulement avec une session active", () => {
    state.authenticated = true
    state.active = true
    expect(render()).toContain("Contenu personnel")
    runEffects()
    expect(state.ensurePerson).toHaveBeenCalledWith({})
    expect(reload).not.toHaveBeenCalled()
  })

  it("une révocation distante retire les données immédiatement, puis recharge une seule fois à la tâche suivante", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = false
    const html = render()
    expect(html).not.toContain("Contenu personnel")
    expect(html).toContain(labels.loading)
    expect(state.useMutation).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    runEffects()
    runEffects()
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(reload).toHaveBeenCalledOnce()
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(authClient.revokeSessions).not.toHaveBeenCalled()
    expect(state.ensurePerson).not.toHaveBeenCalled()
  })

  it("attend la purge de notre propre déconnexion en gardant les surfaces démontées", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = false
    state.signingOut = true
    expect(render()).not.toContain("Contenu personnel")
    runEffects()
    await vi.advanceTimersByTimeAsync(600)
    expect(reload).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    state.signingOut = false
    await vi.advanceTimersByTimeAsync(200)
    expect(reload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(authClient.revokeSessions).not.toHaveBeenCalled()
  })

  it("annule l'attente au démontage et ne recharge pas depuis un effet abandonné", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = false
    state.signingOut = true
    render()
    const cleanups = runEffects()
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)
    for (const cleanup of cleanups) cleanup()
    expect(vi.getTimerCount()).toBe(0)
    state.signingOut = false
    await vi.advanceTimersByTimeAsync(200)
    expect(reload).not.toHaveBeenCalled()
  })

  it("le démontage annule aussi la toute première vérification différée", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = false
    render()
    const cleanups = runEffects()
    expect(reload).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    for (const cleanup of cleanups) cleanup()
    await vi.advanceTimersByTimeAsync(0)
    expect(reload).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("la continuation de déconnexion redirige vers l'entrée avant le rechargement de la garde", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = false
    state.signingOut = true
    const assign = vi.fn()
    vi.stubGlobal("window", { location: { reload, assign } })
    // Reproduit le compteur remis à zéro dans finally : la garde peut être
    // évaluée avant que l'await de l'appelant reprenne pour la redirection.
    const finished = Promise.resolve().finally(() => {
      state.signingOut = false
      render()
      runEffects()
    })
    await finished.then(() => window.location.assign("/entrer"))
    expect(assign).toHaveBeenCalledWith("/entrer")
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(reload).toHaveBeenCalledOnce()
    expect(assign.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]!)
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(authClient.revokeSessions).not.toHaveBeenCalled()
  })

  it("une perte stable d'authentification ferme les anciennes surfaces après la grâce puis recharge", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = true
    expect(render()).toContain("Contenu personnel")
    runEffects()
    state.authenticated = false
    state.active = undefined
    expect(render()).toContain("Contenu personnel")
    expect(state.useQuery).toHaveBeenLastCalledWith(sessionQuery, "skip")
    const cleanups = runEffects()
    await vi.advanceTimersByTimeAsync(1_499)
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    for (const cleanup of cleanups) cleanup()
    expect(render()).not.toContain("Contenu personnel")
    runEffects()
    runEffects()
    await vi.advanceTimersByTimeAsync(0)
    expect(reload).toHaveBeenCalledOnce()
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(authClient.revokeSessions).not.toHaveBeenCalled()
  })

  it("retient aussi une authentification apparue après un montage initial anonyme", async () => {
    vi.useFakeTimers()
    expect(render()).toContain("Contenu personnel")
    runEffects()
    expect(reload).not.toHaveBeenCalled()
    state.authenticated = true
    state.active = true
    expect(render()).toContain("Contenu personnel")
    runEffects()
    state.authenticated = false
    state.active = undefined
    expect(render()).toContain("Contenu personnel")
    const cleanups = runEffects()
    await vi.advanceTimersByTimeAsync(1_500)
    for (const cleanup of cleanups) cleanup()
    expect(render()).not.toContain("Contenu personnel")
    runEffects()
    await vi.advanceTimersByTimeAsync(0)
    expect(reload).toHaveBeenCalledOnce()
  })

  it("une perte d'authentification pendant notre déconnexion attend la purge avant le rechargement", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = true
    render()
    runEffects()
    state.authenticated = false
    state.active = undefined
    state.signingOut = true
    render()
    const graceCleanups = runEffects()
    await vi.advanceTimersByTimeAsync(1_500)
    for (const cleanup of graceCleanups) cleanup()
    expect(render()).not.toContain("Contenu personnel")
    const cleanups = runEffects()
    await vi.advanceTimersByTimeAsync(400)
    expect(reload).not.toHaveBeenCalled()
    state.signingOut = false
    await vi.advanceTimersByTimeAsync(200)
    expect(reload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    for (const cleanup of cleanups) cleanup()
    expect(authClient.signOut).not.toHaveBeenCalled()
    expect(authClient.revokeSessions).not.toHaveBeenCalled()
  })

  it("un renouvellement en cours conserve les surfaces validées et ne recharge jamais", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = true
    render()
    runEffects()
    state.authenticated = false
    state.loading = true
    state.active = undefined
    expect(render()).toContain("Contenu personnel")
    runEffects()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(vi.getTimerCount()).toBe(0)
    state.authenticated = true
    state.loading = false
    expect(render()).toContain("Contenu personnel")
    runEffects()
    state.active = true
    expect(render()).toContain("Contenu personnel")
    runEffects()
    expect(reload).not.toHaveBeenCalled()
  })

  it("une transition false/false brève annule la grâce à la reprise de la session", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = true
    render()
    runEffects()
    state.authenticated = false
    state.active = undefined
    expect(render()).toContain("Contenu personnel")
    const cleanups = runEffects()
    await vi.advanceTimersByTimeAsync(500)
    for (const cleanup of cleanups) cleanup()
    state.authenticated = true
    state.active = true
    expect(render()).toContain("Contenu personnel")
    runEffects()
    await vi.advanceTimersByTimeAsync(1_500)
    expect(reload).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(render()).toContain("Contenu personnel")
  })

  it("un refus serveur reste immédiat et fermé pendant une transition d'authentification", async () => {
    vi.useFakeTimers()
    state.authenticated = true
    state.active = true
    render()
    runEffects()
    state.active = false
    state.signingOut = true
    expect(render()).not.toContain("Contenu personnel")
    const cleanups = runEffects()
    expect(reload).not.toHaveBeenCalled()
    for (const cleanup of cleanups) cleanup()
    state.authenticated = false
    state.loading = true
    state.active = undefined
    expect(render()).not.toContain("Contenu personnel")
    runEffects()
    state.signingOut = false
    await vi.advanceTimersByTimeAsync(200)
    expect(reload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([undefined, false, true])("ne lance ni requête ni boucle de rechargement déconnecté (%s)", (active) => {
    state.active = active
    expect(render()).toContain("Contenu personnel")
    expect(state.useQuery).toHaveBeenCalledWith(sessionQuery, "skip")
    runEffects()
    expect(reload).not.toHaveBeenCalled()
    expect(state.ensurePerson).not.toHaveBeenCalled()
  })
})
