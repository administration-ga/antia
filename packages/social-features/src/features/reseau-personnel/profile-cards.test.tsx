// @vitest-environment jsdom
// Écrit pour le moteur (lot F2) : `HandleChoiceCard`, `ProfilePublicationCard` et `ProfileMiniCard` n'avaient pas de test au socle.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryRouter, renderWithEngine, TEST_ROUTES } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => {
  const mutations: Record<string, ReturnType<typeof vi.fn>> = {}
  return {
    queries: {} as Record<string, { data: unknown; isLoading: boolean; isError: boolean; isFetching: boolean; refetch: () => void }>,
    args: [] as [string, unknown][],
    mutations,
    mutation: (reference: string) => (mutations[reference] ??= vi.fn(async () => undefined)),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }
})

vi.mock("@antia/api/engine", () => ({
  api: {
    modules: {
      people: {
        persons: { getMyPerson: "getMyPerson", ensureMyPerson: "ensureMyPerson" },
        profile: {
          suggestHandles: "suggestHandles",
          isHandleAvailable: "isHandleAvailable",
          publishMyProfile: "publishMyProfile",
          withdrawMyProfile: "withdrawMyProfile",
          setMyProfilePrivacy: "setMyProfilePrivacy",
          setMyAvatar: "setMyAvatar",
          setMyCover: "setMyCover",
          generateProfileUploadUrl: "generateProfileUploadUrl",
        },
      },
    },
  },
}))
vi.mock("@antia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: string, args: unknown) => {
    mocks.args.push([query, args])
    if (args === "skip") return { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }
    return mocks.queries[query] ?? { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }
  },
}))
vi.mock("convex/react", () => ({ useMutation: (reference: string) => mocks.mutation(reference) }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))
vi.mock("@antia/ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  // Pause de frappe neutralisée : la valeur passe tout de suite.
  return { ...actual, useDebouncedValue: <T,>(value: T) => value }
})

import { HandleChoiceCard } from "./HandleChoiceCard"
import { ProfileMiniCard } from "./ProfileMiniCard"
import { ProfilePublicationCard } from "./ProfilePublicationCard"
import { resetProfileEnsureGuard } from "./use-profile-onboarding"

function ok(data: unknown) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }
}

beforeEach(() => {
  mocks.queries = {}
  mocks.args = []
  for (const k of Object.keys(mocks.mutations)) delete mocks.mutations[k]
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  resetProfileEnsureGuard()
})
afterEach(cleanup)

describe("HandleChoiceCard", () => {
  it("propose à partir du nom saisi, aucune forme pré-cochée, et choisit au clic", () => {
    mocks.queries.suggestHandles = ok([
      { handle: "awa.ndong", available: true },
      { handle: "ndong.awa", available: true },
      { handle: "awa", available: false },
    ])
    const onChoose = vi.fn()
    renderWithEngine(<HandleChoiceCard displayName="Awa Ndong" value="" onChoose={onChoose} />)
    expect(mocks.args).toContainEqual(["suggestHandles", { displayName: "Awa Ndong" }])
    const radios = screen.getAllByRole("radio") as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios.every((radio) => !radio.checked)).toBe(true)
    fireEvent.click(radios[1]!)
    expect(onChoose).toHaveBeenCalledWith("ndong.awa")
  })

  it("sans nom, ne demande rien et le dit", () => {
    renderWithEngine(<HandleChoiceCard displayName="" value="" onChoose={vi.fn()} />)
    expect(mocks.args).toContainEqual(["suggestHandles", "skip"])
    expect(screen.getByText(/Saisissez d'abord votre nom affiché/)).toBeTruthy()
  })

  it("dit la disponibilité de l'identifiant tapé, jamais d'une forme invalide", () => {
    mocks.queries.isHandleAvailable = ok({ available: false })
    const vue = renderWithEngine(<HandleChoiceCard displayName="Awa" value="awa.n" onChoose={vi.fn()} />)
    expect(mocks.args).toContainEqual(["isHandleAvailable", { handle: "awa.n" }])
    expect(screen.getByRole("status").textContent).toBe("@awa.n n'est pas disponible.")
    vue.unmount()
    mocks.args = []
    renderWithEngine(<HandleChoiceCard displayName="Awa" value="A!" onChoose={vi.fn()} />)
    expect(mocks.args).toContainEqual(["isHandleAvailable", "skip"])
  })

  it("l'identifiant actuel se reconnaît sans être revérifié", () => {
    mocks.queries.suggestHandles = ok([{ handle: "awa", available: true }])
    renderWithEngine(<HandleChoiceCard displayName="Awa" value="awa" onChoose={vi.fn()} currentHandle="awa" />)
    expect(mocks.args).toContainEqual(["isHandleAvailable", "skip"])
    expect(screen.getByRole("status").textContent).toBe("C'est votre identifiant actuel.")
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText("adresse actuelle")).toBeTruthy()
  })
})

describe("ProfilePublicationCard", () => {
  it("personne non publiée : le geste de publier, puis l'éditeur vide qui publie le choix", async () => {
    mocks.queries.getMyPerson = ok({ _id: "persons_me", published: false, private: false, badges: [], consentsInForce: [], avatar: null, cover: null })
    mocks.queries.suggestHandles = ok([{ handle: "awa.ndong", available: true }])
    renderWithEngine(<ProfilePublicationCard />)
    expect(screen.getByText("Vous n'êtes pas encore trouvable")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Publier mon profil de réseau" }))
    const nom = screen.getByLabelText("Nom affiché") as HTMLInputElement
    expect(nom.value).toBe("")
    fireEvent.change(nom, { target: { value: "Awa Ndong" } })
    fireEvent.click(screen.getByRole("radio"))
    expect((screen.getByLabelText("Identifiant public") as HTMLInputElement).value).toBe("awa.ndong")
    fireEvent.click(screen.getByRole("button", { name: "Publier mon profil" }))
    await waitFor(() =>
      expect(mocks.mutations.publishMyProfile).toHaveBeenCalledWith({ handle: "awa.ndong", displayName: "Awa Ndong" }),
    )
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Profil de réseau publié."))
  })

  it("un identifiant pris : le code du moteur, pas une devinette", async () => {
    mocks.queries.getMyPerson = ok({ _id: "persons_me", handle: "awa", displayName: "Awa", published: false, private: false, badges: [], consentsInForce: [], avatar: null, cover: null })
    renderWithEngine(<ProfilePublicationCard />)
    expect(screen.getByText("Votre profil est retiré du réseau")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Republier mon profil" }))
    expect((screen.getByLabelText("Identifiant public") as HTMLInputElement).value).toBe("awa")
    mocks.mutation("publishMyProfile").mockRejectedValueOnce(Object.assign(new Error("x"), { data: { code: "handleUnavailable" } }))
    fireEvent.click(screen.getByRole("button", { name: "Publier mon profil" }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Cet identifiant n'est pas disponible."))
  })

  it("publié : les gestes, la retenue d'analyse dite, le mode privé et le retrait", async () => {
    mocks.queries.getMyPerson = ok({
      _id: "persons_me", handle: "awa", displayName: "Awa Ndong", headline: "Infirmière", published: true, private: false,
      badges: [], consentsInForce: [], avatar: { url: null, withheld: "fileScanPending" }, cover: null,
    })
    renderWithEngine(<ProfilePublicationCard />)
    expect(screen.getByText("Awa Ndong")).toBeTruthy()
    expect(screen.getByText(/Votre photo est en cours d'analyse de sécurité/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retirer la photo" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Retirer la couverture" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Passer hors connexion" }))
    await waitFor(() => expect(mocks.mutations.setMyProfilePrivacy).toHaveBeenCalledWith({ private: true }))
    fireEvent.click(screen.getByRole("button", { name: "Me retirer du réseau" }))
    await waitFor(() => expect(mocks.mutations.withdrawMyProfile).toHaveBeenCalledWith({}))
    fireEvent.click(screen.getByRole("button", { name: "Retirer la photo" }))
    await waitFor(() => expect(mocks.mutations.setMyAvatar).toHaveBeenCalledWith({ storageId: null }))
  })

  it("sans personne : la crée une fois, sans rien publier", async () => {
    mocks.queries.getMyPerson = ok(null)
    renderWithEngine(<ProfilePublicationCard />)
    await waitFor(() => expect(mocks.mutations.ensureMyPerson).toHaveBeenCalledTimes(1))
    expect(mocks.mutations.publishMyProfile).not.toHaveBeenCalled()
  })
})

describe("ProfileMiniCard", () => {
  it("publié : l'identité mène à MA fiche", () => {
    mocks.queries.getMyPerson = ok({ _id: "persons_me", handle: "awa", displayName: "Awa Ndong", published: true, private: false, badges: [], consentsInForce: [], avatar: null, cover: null })
    renderWithEngine(<ProfileMiniCard cover={false} />)
    const lien = screen.getByRole("link", { name: "Voir mon profil" })
    expect(lien.getAttribute("href")).toBe(TEST_ROUTES.profile("awa"))
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("hors connexion : le rappel mène à la gestion de mon profil", () => {
    mocks.queries.getMyPerson = ok({ _id: "persons_me", handle: "awa", displayName: "Awa Ndong", published: true, private: true, badges: [], consentsInForce: [], avatar: null, cover: null })
    const router = memoryRouter()
    renderWithEngine(<ProfileMiniCard cover={false} />, { router: router.implementation })
    expect(screen.getByText("Votre profil est hors connexion")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Revenir sur le réseau" }))
    expect(router.calls).toEqual([{ method: "push", href: `${TEST_ROUTES.profile("awa")}?gerer=1` }])
  })

  it("non publié, sans réglages servis : le rappel informe, sans bouton mort", () => {
    mocks.queries.getMyPerson = ok({ _id: "persons_me", published: false, private: false, badges: [], consentsInForce: [], avatar: null, cover: null })
    renderWithEngine(<ProfileMiniCard cover />)
    expect(screen.getByText("Vous n'êtes pas encore trouvable")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Publier mon profil" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Voir mon profil" })).toBeNull()
  })
})
