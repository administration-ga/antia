// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, isError: false, error: null, refetch: vi.fn() },
  send: vi.fn(),
  dismiss: vi.fn(),
  request: { disabled: false, waitLabel: null as string | null, pendingHandle: null as string | null },
}))

vi.mock("@antsia/api/engine", () => ({ api: { modules: { suggestions: { suggestions: { paginate: "paginate", dismiss: "dismiss" } } } } }))
vi.mock("@antsia/api/hooks", () => ({ useAuthenticatedConvexQuery: () => mocks.query }))
vi.mock("convex/react", () => ({ useMutation: () => mocks.dismiss }))
vi.mock("./use-connection-request", () => ({ useConnectionRequest: () => ({ ...mocks.request, send: mocks.send }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { SuggestionsPanel } from "./SuggestionsPanel"

const elise = { personId: "persons_elise", handle: "elise.ndong", displayName: "Élise NDONG", headline: "Journaliste", avatarUrl: null as string | null, relationState: "none", dismissed: false }
const pageOf = (people: unknown[]) => ({ page: people, isDone: true, continueCursor: "" })

beforeEach(() => {
  mocks.query = { data: pageOf([elise]), isLoading: false, isError: false, error: null, refetch: vi.fn() }
  mocks.send.mockReset().mockResolvedValue(true)
  mocks.dismiss.mockReset().mockResolvedValue({})
  mocks.request = { disabled: false, waitLabel: null, pendingHandle: null }
})

describe("SuggestionsPanel — découverte et états serveur", () => {
  it("le carrousel utilise la photo publique du DTO puis revient à l'avatar si elle échoue", () => {
    mocks.query.data = pageOf([{ ...elise, avatarUrl: "/public-profile-photo" }])
    const { container } = renderWithEngine(<SuggestionsPanel presentation="carousel" />)
    const image = container.querySelector("img")!
    expect(image.getAttribute("src")).toBe("/public-profile-photo")
    expect(screen.getByText("@elise.ndong · Journaliste")).toBeTruthy()
    expect(container.textContent).not.toMatch(/en commun/i)
    fireEvent.error(image)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByText("ÉN")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ajouter" })).not.toBeDisabled()
  })

  it("Ajouter attend le serveur, préserve la carte et n'invente pas un état envoyé", async () => {
    let finish: (value: boolean) => void = () => undefined
    mocks.send.mockImplementation(() => new Promise<boolean>((resolve) => { finish = resolve }))
    const view = renderWithEngine(<SuggestionsPanel presentation="carousel" />)
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }))
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({ handle: elise.handle })
    expect(screen.getByRole("button", { name: "Connexion…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Masquer la suggestion Élise NDONG" })).toBeDisabled()
    await act(async () => { finish(true) })
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeTruthy()
    mocks.query.data = pageOf([{ ...elise, relationState: "requested_by_me" }])
    view.rerender(<SuggestionsPanel presentation="carousel" />)
    expect(screen.getByRole("button", { name: "Demande envoyée" })).toBeDisabled()
  })

  it("une invitation reçue ouvre la réponse et ne déclenche aucune nouvelle demande", () => {
    mocks.query.data = pageOf([{ ...elise, relationState: "requested_by_them" }])
    renderWithEngine(<SuggestionsPanel />)
    expect(screen.getByRole("link", { name: "Répondre à l’invitation" })).toHaveAttribute("href", "/fil?tab=relations&vue=invitations")
    expect(screen.queryByRole("button", { name: "Invitation reçue" })).toBeNull()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("une erreur d'envoi réactive Ajouter sans annoncer une demande enregistrée", async () => {
    mocks.send.mockRejectedValueOnce(new Error("refused"))
    renderWithEngine(<SuggestionsPanel />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ajouter" })) })
    expect(screen.getByRole("button", { name: "Ajouter" })).not.toBeDisabled()
    expect(screen.queryByRole("button", { name: "Demande envoyée" })).toBeNull()
  })

  it("Masquer retire la carte immédiatement, puis la restaure si le serveur refuse", async () => {
    let reject: (error: Error) => void = () => undefined
    mocks.dismiss.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
    renderWithEngine(<SuggestionsPanel presentation="carousel" />)
    fireEvent.click(screen.getByRole("button", { name: "Masquer la suggestion Élise NDONG" }))
    expect(mocks.dismiss).toHaveBeenCalledExactlyOnceWith({ networkId: TEST_NETWORK_ID, handle: elise.handle })
    expect(screen.queryByText("Élise NDONG")).toBeNull()
    await act(async () => { reject(new Error("refused")) })
    expect(screen.getByText("Élise NDONG")).toBeTruthy()
  })

  it("un masquage confirmé reste absent au remontage quand le catalogue serveur l'écarte", async () => {
    const first = renderWithEngine(<SuggestionsPanel />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Masquer la suggestion Élise NDONG" })) })
    first.unmount()
    mocks.query.data = pageOf([])
    renderWithEngine(<SuggestionsPanel />)
    expect(screen.queryByText("Élise NDONG")).toBeNull()
    expect(screen.queryByRole("button", { name: "Ajouter" })).toBeNull()
  })

  it("conserve le délai du verrou de demande partagé", () => {
    mocks.request = { disabled: true, waitLabel: "Réessayez dans 20 s.", pendingHandle: null }
    renderWithEngine(<SuggestionsPanel />)
    expect(screen.getByRole("button", { name: "Réessayez dans 20 s." })).toBeDisabled()
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
