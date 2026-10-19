// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/GroupsPanel.test.tsx @ ad2e7fdc2 — adaptations : fonctions du moteur moquées (`thematicGroups.thematicGroups.*`, recherche `graph.connections.searchMine`), réponses au DTO du moteur (`myGroups` → `{ items, truncated }`, vivier `{ items, truncated }` aux lignes `personId`, mur `{ items, nextCursor }`), invitations PAGINÉES (une panne lève, la frontière la dit) ; rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n français, réseau de test) ; primitives de `@antsia/ui` et kit d'espace (`@antsia/ui/espace-kit`) moqués ; les treize cas du socle portés ; cas ajoutés : le refus `notFound` dit « plus accessible », les gestes portent le réseau courant, la lacune de « Mes groupes » se dit, l'invitation envoie une demande par personne cochée.
// @vitest-environment jsdom

/**
 * GroupsPanel — une panne n'est jamais une invitation à créer un groupe
 * (R-08) :
 *
 *  1. « Mes groupes » en panne : bandeau + Réessayer, JAMAIS « créez le
 *     vôtre » ;
 *  2. la découverte en panne : bandeau, jamais « Créez le premier » ;
 *  3. une panne après données conserve la liste ;
 *  4. la fiche d'un groupe en panne n'est pas « plus accessible » ;
 *  5. les invitations en panne se disent.
 *
 * Étendu le 2026-09-06 (R-13) : la page d'un groupe est un LIEU — elle vient
 * de l'URL (`groupId`), s'ouvre par `onOpenGroup` et se referme par `onBack` :
 * le volet n'a plus d'état de vue à lui. Et l'invitation passe par le
 * sélecteur de relations, plus par un champ « @identifiant ».
 */
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { ConvexError } from "convex/values"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"
import { EMPTY_DISCOVER_TEXT_KEY, EMPTY_MY_GROUPS_TEXT_KEY } from "./groupes-thematiques"

type QueryMock = {
  data: unknown
  error?: unknown
  isPending: boolean
  isFetching: boolean
  isError: boolean
  fetchStatus: "idle" | "fetching" | "paused"
  refetch: ReturnType<typeof vi.fn>
}

type PaginatedMock = {
  results: unknown[]
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: ReturnType<typeof vi.fn>
  isLoading: boolean
}

const mocks = vi.hoisted(() => ({
  queries: {} as Record<string, QueryMock>,
  paginated: {} as Record<string, PaginatedMock | Error>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  queryCalls: [] as [string, unknown][],
}))

function ok(data: unknown): QueryMock {
  return {
    data,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  }
}

function err(data: unknown = undefined, error: unknown = new Error("panne")): QueryMock {
  return { ...ok(data), error, isError: true }
}

/** Ce que le moteur rend quand il n'y a « rien » — à la forme de chaque DTO. */
function emptyAnswer(query: string): QueryMock {
  switch (query) {
    case "myGroups":
      return ok({ items: [], truncated: false })
    case "listInviteCandidates":
      return ok({ items: [], truncated: false })
    case "groupWall":
      return ok({ items: [], nextCursor: null })
    default:
      return ok([])
  }
}

function exhausted(results: unknown[] = []): PaginatedMock {
  return { results, status: "Exhausted", loadMore: vi.fn(), isLoading: false }
}

function mutation(reference: string) {
  mocks.mutations[reference] ??= vi.fn().mockResolvedValue({})
  return mocks.mutations[reference]
}

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      thematicGroups: {
        thematicGroups: {
          paginateMyInvites: "paginateMyInvites",
          myGroups: "myGroups",
          discover: "discover",
          respondInvite: "respondInvite",
          join: "join",
          create: "create",
          getGroup: "getGroup",
          leave: "leave",
          unpinGroupPost: "unpinGroupPost",
          invite: "invite",
          paginateMembers: "paginateMembers",
          setMemberRole: "setMemberRole",
          removeMember: "removeMember",
          groupWall: "groupWall",
          pinGroupPost: "pinGroupPost",
          removeGroupPost: "removeGroupPost",
          listInviteCandidates: "listInviteCandidates",
        },
      },
      graph: { connections: { searchMine: "searchMine" } },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: string, args: unknown) => {
    mocks.queryCalls.push([query, args])
    return mocks.queries[query] ?? emptyAnswer(query)
  },
  useAuthenticatedPaginatedQuery: (query: string) => {
    const answer = mocks.paginated[query]
    // Comme `usePaginatedQuery` de Convex : une lecture en panne LÈVE au rendu.
    if (answer instanceof Error) throw answer
    return answer ?? exhausted()
  },
}))

vi.mock("convex/react", () => ({ useMutation: (reference: string) => mutation(reference) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("./PostCard", () => ({
  PostCard: ({ post }: { post: { _id: string } }) => <article data-post-id={post._id} />,
}))
vi.mock("./PostComposer", () => ({ PostComposer: () => <div data-testid="composeur" /> }))

vi.mock("@antsia/ui", () => ({
  Alert: ({ title, children }: { title: string; children: ReactNode }) => (
    <div role="alert">
      <strong>{title}</strong>
      {children}
    </div>
  ),
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    variant: _variant,
    size: _size,
    icon: _icon,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    icon?: string
  }) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SkeletonCard: () => <div data-testid="skeleton" />,
  TextArea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  TextInput: ({ icon: _icon, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: string }) => <input {...props} />,
  // La recherche du sélecteur de relations (`useRelationSearch`).
  useDebouncedValue: <T,>(value: T) => value,
}))

// Le kit d'espace (son propre point d'entrée) : l'état vide rend son texte, la pagination se tait.
vi.mock("@antsia/ui/espace-kit", () => ({
  EspaceEmptyState: ({ text, action }: { text: string; action?: ReactNode }) => (
    <div>
      <p>{text}</p>
      {action}
    </div>
  ),
  EspacePagination: () => null,
  clampPage: (page: number, total: number, size: number) => Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / size))),
  pageSlice: <T,>(items: readonly T[], page: number, size: number) => items.slice((page - 1) * size, page * size),
}))

import { GroupsPanel } from "./GroupsPanel"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const EMPTY_MY_GROUPS_TEXT = t(EMPTY_MY_GROUPS_TEXT_KEY)
const EMPTY_DISCOVER_TEXT = t(EMPTY_DISCOVER_TEXT_KEY)

function group(groupId: string, name: string) {
  return {
    groupId,
    name,
    description: null,
    country: null,
    associationPage: null,
    memberCount: 3,
    state: "active",
    myRole: "member",
    invited: false,
    createdAt: 1,
  }
}

/** Les rappels de navigation sont un CONTRAT : le volet n'ouvre plus rien seul. */
let onOpenGroup: (groupId: string) => void
let onBack: () => void

function monter(over: { groupId?: string | null } = {}) {
  renderWithEngine(<GroupsPanel groupId={over.groupId ?? null} now={1_000} onOpenGroup={onOpenGroup} onBack={onBack} />)
}

beforeEach(() => {
  mocks.queries = {}
  mocks.paginated = {}
  mocks.mutations = {}
  mocks.queryCalls = []
  onOpenGroup = vi.fn<(groupId: string) => void>()
  onBack = vi.fn<() => void>()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GroupsPanel — l'annuaire (R-08)", () => {
  it("« Mes groupes » en panne : bandeau + Réessayer, JAMAIS « créez le vôtre »", () => {
    mocks.queries.myGroups = err()
    monter()

    expect(screen.queryByText(EMPTY_MY_GROUPS_TEXT)).toBeNull()
    expect(screen.queryByText(/créez le vôtre/)).toBeNull()
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Mes groupes indisponibles")
    expect(screen.queryByTestId("skeleton")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.queries.myGroups?.refetch).toHaveBeenCalledTimes(1)
  })

  it("la découverte en panne : bandeau, jamais « Créez le premier »", () => {
    mocks.queries.discover = err()
    monter()

    expect(screen.queryByText(EMPTY_DISCOVER_TEXT)).toBeNull()
    expect(screen.getByRole("alert").textContent).toContain("Découverte indisponible")
  })

  it("une panne après données CONSERVE la liste sous le bandeau", () => {
    mocks.queries.myGroups = err({ items: [group("g1", "Archivistes du Trésor")], truncated: false })
    monter()

    expect(screen.getByText("Archivistes du Trésor")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("Mes groupes indisponibles")
    expect(screen.queryByText(EMPTY_MY_GROUPS_TEXT)).toBeNull()
  })

  it("les invitations en panne se disent", () => {
    // La frontière d'erreur journalise ce qu'elle attrape : le bruit n'est pas le sujet.
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.paginated.paginateMyInvites = new Error("panne")
    monter()
    expect(screen.getByRole("alert").textContent).toContain("Invitations indisponibles")
  })

  it("rend les vrais états vides quand tout a répondu « rien »", () => {
    monter()
    expect(screen.getByText(EMPTY_MY_GROUPS_TEXT)).toBeTruthy()
    expect(screen.getByText(EMPTY_DISCOVER_TEXT)).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("montre un squelette en vraie attente de « Mes groupes »", () => {
    mocks.queries.myGroups = {
      ...ok(undefined),
      isPending: true,
      isFetching: true,
      fetchStatus: "fetching",
    }
    monter()
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText(EMPTY_MY_GROUPS_TEXT)).toBeNull()
  })

  it("la lecture BORNÉE de « Mes groupes » dit sa lacune", () => {
    mocks.queries.myGroups = ok({ items: [group("g1", "Archivistes du Trésor")], truncated: true })
    monter()
    expect(screen.getByText("Seuls vos groupes les plus actifs sont affichés.")).toBeTruthy()
  })

  it("chaque lecture et chaque geste portent le réseau courant", async () => {
    mocks.queries.discover = ok([{ ...group("g2", "Cartographes"), myRole: null }])
    monter()

    expect(mocks.queryCalls).toContainEqual(["myGroups", { networkId: TEST_NETWORK_ID }])
    expect(mocks.queryCalls).toContainEqual(["discover", { networkId: TEST_NETWORK_ID }])

    fireEvent.click(screen.getByRole("button", { name: "Rejoindre" }))
    await waitFor(() => expect(mocks.mutations.join).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, groupId: "g2" }))
    await waitFor(() => expect(onOpenGroup).toHaveBeenCalledWith("g2"))
  })

  it("une invitation reçue nomme qui invite, et l'accepter ouvre le groupe", async () => {
    mocks.paginated.paginateMyInvites = exhausted([
      {
        inviteId: "i1",
        groupId: "g3",
        groupName: "Botanistes",
        memberCount: 12,
        invitedBy: { personId: "p1", displayName: "Awa Ndong", handle: "awa", avatarUrl: null },
        createdAt: 1,
      },
    ])
    monter()

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("1 invitation de groupe en attente")
    expect(alert.textContent).toContain("Awa Ndong vous invite à rejoindre « Botanistes » (12 membres).")
    fireEvent.click(screen.getByRole("button", { name: "Accepter" }))
    await waitFor(() => expect(mocks.mutations.respondInvite).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, inviteId: "i1", accept: true }))
    await waitFor(() => expect(onOpenGroup).toHaveBeenCalledWith("g3"))
  })
})

describe("GroupsPanel — la page d'un groupe (R-08)", () => {
  it("la fiche en panne n'est pas « plus accessible » : bandeau + Réessayer + retour", () => {
    mocks.queries.getGroup = err()
    monter({ groupId: "g1" })

    expect(screen.queryByText(/n'est plus accessible/)).toBeNull()
    expect(screen.getByRole("alert").textContent).toContain("Groupe indisponible")
    expect(screen.getByRole("button", { name: "Revenir aux groupes" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.queries.getGroup?.refetch).toHaveBeenCalledTimes(1)
  })

  it("le REFUS indistinct du moteur (`notFound`), lui, dit « plus accessible » — avec le retour", () => {
    mocks.queries.getGroup = err(undefined, new ConvexError({ code: "notFound" }))
    monter({ groupId: "g1" })

    expect(screen.getByText("Ce groupe n'est plus accessible.")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux groupes" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("le mur en panne se dit sans prétendre que le groupe est vide", () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    mocks.queries.groupWall = err()
    monter({ groupId: "g1" })

    expect(screen.getByRole("alert").textContent).toContain("Publications indisponibles")
    expect(screen.queryByText(/Aucune publication dans ce groupe/)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// R-13 — la page d'un groupe est un LIEU (ouverture adressable)
// ═══════════════════════════════════════════════════════════════

const FICHE_MEMBRE = {
  groupId: "g1",
  name: "Archivistes du Trésor",
  description: null,
  country: null,
  associationPage: null,
  memberCount: 3,
  state: "active",
  myRole: "member",
  invited: false,
  createdAt: 1,
  pendingInviteId: null,
  pinned: null,
}

describe("GroupsPanel — ouverture adressable (R-13)", () => {
  it("ouvrir une carte DEMANDE l'URL et ne bascule RIEN localement", () => {
    mocks.queries.myGroups = ok({ items: [group("g1", "Archivistes du Trésor")], truncated: false })
    monter()

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }))
    expect(onOpenGroup).toHaveBeenCalledTimes(1)
    expect(onOpenGroup).toHaveBeenCalledWith("g1")
    // L'annuaire est TOUJOURS là : c'est l'URL qui décide, pas un état interne.
    expect(screen.getByRole("button", { name: "Ouvrir" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Revenir aux groupes" })).toBeNull()
  })

  it("la page du groupe vient du prop `groupId` — le retour REND la main", () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    monter({ groupId: "g1" })

    expect(screen.getByText("Archivistes du Trésor")).toBeTruthy()
    expect(mocks.queryCalls).toContainEqual(["getGroup", { networkId: TEST_NETWORK_ID, groupId: "g1" }])
    fireEvent.click(screen.getByRole("button", { name: "Revenir aux groupes" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe("GroupsPanel — invitation par le sélecteur de relations (R-13)", () => {
  it("le champ « @identifiant » a disparu au profit du sélecteur", () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    monter({ groupId: "g1" })

    expect(screen.queryByLabelText("Identifiant public de la personne à inviter")).toBeNull()
    expect(screen.getByRole("button", { name: /Inviter des relations/ })).toBeTruthy()
  })

  it("le sélecteur nomme le statut de chaque relation", () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    mocks.queries.listInviteCandidates = ok({
      items: [
        { personId: "p-alice", handle: "alice", displayName: "Alice Ndong", headline: null, avatarUrl: null, status: "eligible" },
        { personId: "p-bob", handle: "bob", displayName: "Bob Mba", headline: null, avatarUrl: null, status: "member" },
        { personId: "p-carla", handle: "carla", displayName: "Carla Obame", headline: null, avatarUrl: null, status: "invited" },
      ],
      truncated: false,
    })
    monter({ groupId: "g1" })

    fireEvent.click(screen.getByRole("button", { name: /Inviter des relations/ }))
    expect(screen.getByRole("checkbox", { name: /Alice Ndong/ })).toBeTruthy()
    expect(screen.getByText("Déjà membre")).toBeTruthy()
    expect(screen.getByText("Invitation en attente")).toBeTruthy()
  })

  it("le vivier en panne se DIT — jamais « aucune relation »", () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    mocks.queries.listInviteCandidates = err()
    monter({ groupId: "g1" })

    fireEvent.click(screen.getByRole("button", { name: /Inviter des relations/ }))
    const alertes = screen.getAllByRole("alert").map((row) => row.textContent ?? "")
    expect(alertes.some((texte) => texte.includes("Relations indisponibles"))).toBe(true)
  })

  it("inviter envoie UNE demande par personne cochée, dans le réseau courant", async () => {
    mocks.queries.getGroup = ok(FICHE_MEMBRE)
    mocks.queries.listInviteCandidates = ok({
      items: [{ personId: "p-alice", handle: "alice", displayName: "Alice Ndong", headline: null, avatarUrl: null, status: "eligible" }],
      truncated: false,
    })
    mutation("invite").mockResolvedValue({ invited: true, alreadyInvited: false })
    monter({ groupId: "g1" })

    fireEvent.click(screen.getByRole("button", { name: /Inviter des relations/ }))
    expect(mocks.queryCalls).toContainEqual(["listInviteCandidates", { networkId: TEST_NETWORK_ID, groupId: "g1" }])
    fireEvent.click(screen.getByRole("checkbox", { name: /Alice Ndong/ }))
    fireEvent.click(screen.getByRole("button", { name: /Inviter 1 personne/ }))
    await waitFor(() => expect(mocks.mutations.invite).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, groupId: "g1", handle: "alice" }))
    expect(mocks.mutations.invite).toHaveBeenCalledTimes(1)
  })
})
