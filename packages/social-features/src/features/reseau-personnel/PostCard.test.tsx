// @vitest-environment jsdom
// Écrit pour le moteur (lot F2) : `PostCard` n'avait pas de test au socle — carte d'une personne, carte d'une page (identité de la page, signataire nommé), nom neutre d'un auteur sans profil publié.
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID, TEST_PERSON_ID } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  calls: [] as { ref: string; args: unknown }[],
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      engagement: { engagement: { toggleReaction: "toggleReaction", paginateComments: "paginateComments", paginateReplies: "paginateReplies", comment: "comment", removeComment: "removeComment", editComment: "editComment" } },
      posts: { posts: { remove: "remove", edit: "edit", pinOnMyWall: "pinOnMyWall", publish: "publish" } },
      pages: { pages: { removePagePost: "removePagePost" } },
      moderation: { moderation: { reportPost: "reportPost", reportComment: "reportComment" } },
      marks: { marks: { toggleMark: "toggleMark", hidePost: "hidePost", unhidePost: "unhidePost", muteAuthor: "muteAuthor", unmuteAuthor: "unmuteAuthor" } },
    },
  },
}))

vi.mock("convex/react", () => ({
  useMutation: (ref: string) => async (args: unknown) => {
    mocks.calls.push({ ref, args })
    if (ref === "toggleMark") return { marked: true }
    return { ok: true }
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { PostCard, type PostCardPost } from "./PostCard"

const base: PostCardPost = {
  _id: "posts_1" as never,
  body: "Bonjour #numerique @awa.demo",
  audience: "public",
  visibility: "network",
  publishedAt: 1_700_000_000_000,
  editedAt: null,
  isMine: false,
  author: { personId: "persons_awa" as never, handle: "awa.demo", displayName: "Awa", headline: "Archiviste", avatarUrl: null, badges: ["verified", "community"] },
  reactions: { counts: { like: 2, bravo: 0, soutien: 0, instructif: 0 }, total: 2, mine: null },
  commentCount: 3,
  shareCount: 0,
  media: [],
  share: null,
  tags: ["numerique"],
  groupId: null,
  event: null,
  page: null,
  reach: null,
  country: null,
  origin: null,
  reason: "connection",
  viewer: { bookmarked: false, notifying: false },
}

beforeEach(() => {
  mocks.calls = []
})

describe("PostCard (vérification)", () => {
  it("personne : lien de profil injecté, badge calculé, gestes du réseau", async () => {
    renderWithEngine(<PostCard post={base} now={1_700_000_060_000} />)
    const link = screen.getByRole("link", { name: "Awa" })
    expect(link).toHaveAttribute("href", "/profil/awa.demo")
    expect(screen.getByText("Vérifié")).toBeTruthy()
    expect(screen.queryByText("Communauté")).toBeNull()
    expect(screen.getByText("Archiviste")).toBeTruthy()
    // Mentions et mots-dièse sans gestionnaire : adresses injectées.
    expect(screen.getByRole("link", { name: "@awa.demo" })).toHaveAttribute("href", "/profil/awa.demo")
    expect(screen.getByRole("link", { name: "#numerique" })).toHaveAttribute("href", "/fil?tag=numerique")
    expect(screen.getByRole("button", { name: "Commenter · 3" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Relayer" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /^J'aime · 2 réactions\./ }))
    await waitFor(() => expect(mocks.calls).toContainEqual({ ref: "toggleReaction", args: { networkId: TEST_NETWORK_ID, postId: "posts_1", kind: "like" } }))

    fireEvent.click(screen.getByRole("button", { name: "Autres actions sur cette publication" }))
    const menu = await screen.findByRole("menu", { name: "Actions sur cette publication" })
    expect([...menu.querySelectorAll(".rp-of-label")].map((n) => n.textContent)).toEqual([
      "Enregistrer",
      "Être averti des commentaires",
      "Masquer cette publication",
      "Ne plus voir les publications de Awa",
      "Signaler",
    ])
    fireEvent.click(screen.getByText("Ne plus voir les publications de Awa"))
    await waitFor(() => expect(mocks.calls).toContainEqual({ ref: "muteAuthor", args: { networkId: TEST_NETWORK_ID, targetPersonId: "persons_awa" } }))
  })

  it("page : identité de la page, signataire nommée, retrait par la page", async () => {
    const post: PostCardPost = {
      ...base,
      reason: "own",
      author: { ...base.author, personId: TEST_PERSON_ID },
      page: { pageId: "pages_1" as never, networkId: TEST_NETWORK_ID, handle: "asso", name: "Association X", shortName: null, logoUrl: null, badge: "official", ownerKind: "association", country: null },
    }
    renderWithEngine(<PostCard post={post} now={1_700_000_060_000} />)
    expect(screen.getByRole("link", { name: "Association X" })).toHaveAttribute("href", "/page/asso")
    expect(screen.getByText("Officiel")).toBeTruthy()
    expect(screen.getByText("Publié par Awa")).toBeTruthy()
    expect(screen.queryByText("Archiviste")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Autres actions sur cette publication" }))
    const menu = await screen.findByRole("menu", { name: "Actions sur cette publication" })
    // Signataire et autrice : gestes d'auteur, SANS épinglage personnel.
    expect([...menu.querySelectorAll(".rp-of-label")].map((n) => n.textContent)).toEqual([
      "Modifier",
      "Enregistrer",
      "Retirer ma publication",
    ])
    fireEvent.click(screen.getByText("Retirer ma publication"))
    await waitFor(() => expect(mocks.calls).toContainEqual({ ref: "removePagePost", args: { networkId: TEST_NETWORK_ID, postId: "posts_1" } }))
  })

  it("nom neutre et partage indisponible", () => {
    const post: PostCardPost = {
      ...base,
      author: { ...base.author, displayName: null, handle: null, badges: [] },
      share: { available: false },
    }
    renderWithEngine(<PostCard post={post} now={1_700_000_060_000} />)
    expect(screen.getAllByText("Membre du réseau").length).toBeGreaterThan(0)
    expect(screen.queryByRole("link", { name: "Membre du réseau" })).toBeNull()
    expect(screen.getByText("Publication indisponible.")).toBeTruthy()
  })
})
