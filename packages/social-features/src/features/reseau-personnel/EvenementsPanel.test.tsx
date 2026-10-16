// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/EvenementsPanel.test.tsx @ ad2e7fdc2 — adaptations : fonctions du moteur moquées (`events.events.*`, recherche `graph.connections.searchMine`), agenda au DTO du moteur (`{ items, truncated }`, organisateur `counterpartLabel`) ; rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n français, réseau de test, routeur en mémoire) ; primitives de `@antsia/ui` et kit d'espace (`@antsia/ui/espace-kit`) moqués ; les gestes portent le réseau courant ; les onze premiers cas du socle portés, le douzième retourné — sans hôte, le volet compose LUI-MÊME (iAgenda n'existe pas dans le moteur) : le bouton ouvre la carte de composition ; cas ajoutés : la composition (réseau, fuseau du navigateur, clé tirée à l'ouverture), la fin avant le début, l'intention portée par l'adresse (consommée une fois, URL nettoyée, retour rendu), l'invitation des relations, la liste des invités, la lacune de l'agenda.
// @vitest-environment jsdom

/**
 * EvenementsPanel — l'agenda en panne n'est pas un agenda vide (R-08) :
 *
 *  1. panne sans données : bandeau + Réessayer, jamais `emptyAgendaText` ;
 *  2. panne après données : les évènements restent affichés sous le bandeau ;
 *  3. le squelette n'apparaît qu'en vraie attente.
 *
 * …et l'ANNONCE se compose avant de partir (R-16) :
 *
 *  4. « Annoncer au réseau » ouvre la boîte et n'appelle PAS `announce` ;
 *  5. confirmer appelle `announce` avec l'audience CHOISIE et le corps saisi ;
 *  6. les invités sont distingués de l'audience de l'annonce ;
 *  7. « Créer un évènement » appelle `onCreateEvent` quand un hôte l'écoute, et
 *     rien d'autre — sans hôte, le volet compose lui-même.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Id } from "@antsia/api/engine"

import { createAppI18n } from "../../i18n"
import { memoryRouter, renderWithEngine, TEST_NETWORK_ID, TEST_ROUTES } from "../../tests/engine-wrapper"
import { emptyAgendaText, type EvenementListItem } from "./evenements-list"

type PaginatedMock = {
  results: unknown[]
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: ReturnType<typeof vi.fn>
  isLoading: boolean
}

const mocks = vi.hoisted(() => ({
  agenda: {
    data: undefined as unknown,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle" as "idle" | "fetching" | "paused",
    refetch: vi.fn(),
  },
  agendaArgs: [] as unknown[],
  searchHits: [] as unknown[],
  paginated: {} as Record<string, PaginatedMock>,
  announce: vi.fn(),
  respond: vi.fn(),
  cancel: vi.fn(),
  create: vi.fn(),
  invite: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      events: {
        events: {
          myAgenda: "myAgenda",
          respond: "respond",
          cancel: "cancel",
          announce: "announce",
          create: "create",
          invite: "invite",
          paginateEventParticipants: "paginateEventParticipants",
        },
      },
      graph: { connections: { searchMine: "searchMine" } },
    },
  },
}))

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (query: string, args: unknown) => {
    if (query === "myAgenda") {
      mocks.agendaArgs.push(args)
      return mocks.agenda
    }
    // La recherche du sélecteur de relations (`useRelationSearch`).
    return {
      data: args === "skip" ? undefined : mocks.searchHits,
      isPending: false,
      isFetching: false,
      isError: false,
      fetchStatus: "idle",
      refetch: vi.fn(),
    }
  },
  useAuthenticatedPaginatedQuery: (query: string) => mocks.paginated[query] ?? { results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false },
}))
vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    if (reference === "announce") return mocks.announce
    if (reference === "respond") return mocks.respond
    if (reference === "create") return mocks.create
    if (reference === "invite") return mocks.invite
    return mocks.cancel
  },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("@antsia/ui", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
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
    Icon: () => null,
    SkeletonCard: () => <div data-testid="skeleton" />,
    // Comme le vrai `Field` : l'étiquette est LIÉE à son champ (identifiant propagé).
    Field: ({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode }) => {
      const id = htmlFor ?? `champ-${label}`
      const child = React.isValidElement<{ id?: string }>(children) ? React.cloneElement(children, { id: children.props.id ?? id }) : children
      return (
        <div>
          <label htmlFor={id}>{label}</label>
          {hint === undefined ? null : <small>{hint}</small>}
          {child}
          {error === undefined ? null : <span>{error}</span>}
        </div>
      )
    },
    Select: (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
    TextArea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
    TextInput: ({ icon: _icon, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: string }) => <input {...props} />,
    useModalA11y: () => undefined,
    // La recherche du sélecteur de relations (`useRelationSearch`).
    useDebouncedValue: <T,>(value: T) => value,
  }
})

// Le kit d'espace (son propre point d'entrée) : l'état vide rend son texte, la pagination se tait.
vi.mock("@antsia/ui/espace-kit", () => ({
  EspaceEmptyState: ({ text }: { text: string }) => <p>{text}</p>,
  EspacePagination: () => null,
  clampPage: (page: number) => Math.max(1, page),
  pageSlice: <T,>(items: readonly T[], page: number, size: number) => items.slice((page - 1) * size, page * size),
}))

import { EvenementsPanel } from "./EvenementsPanel"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")

const NOW = Date.UTC(2026, 8, 6, 10, 0, 0)

function event(eventId: string, title: string, over: Partial<EvenementListItem> = {}): EvenementListItem {
  return {
    eventId: eventId as Id<"events">,
    title,
    description: null,
    location: null,
    startAt: NOW + 7 * 24 * 3_600_000,
    endAt: NOW + 7 * 24 * 3_600_000 + 3_600_000,
    timeZone: "Africa/Libreville",
    status: "scheduled",
    cancelledAt: null,
    isOrganizer: true,
    myParticipation: null,
    organizer: {
      personId: "persons_awa" as Id<"persons">,
      displayName: "Awa Ndong",
      handle: "awa",
      headline: null,
      avatarUrl: null,
      source: "published",
    },
    participantCount: 2,
    acceptedCount: 1,
    announcePostId: null,
    createdAt: NOW - 3_600_000,
    ...over,
  }
}

function agenda(items: EvenementListItem[], truncated = false) {
  return { items, truncated }
}

beforeEach(() => {
  mocks.agenda.data = undefined
  mocks.agenda.isPending = false
  mocks.agenda.isFetching = false
  mocks.agenda.isError = false
  mocks.agenda.fetchStatus = "idle"
  mocks.agenda.refetch.mockReset()
  mocks.agendaArgs = []
  mocks.searchHits = []
  mocks.paginated = {}
  mocks.announce.mockReset().mockResolvedValue(undefined)
  mocks.respond.mockReset().mockResolvedValue(undefined)
  mocks.cancel.mockReset().mockResolvedValue(undefined)
  mocks.create.mockReset().mockResolvedValue({ eventId: "e-new", created: true })
  mocks.invite.mockReset().mockResolvedValue({ invited: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("EvenementsPanel — panne honnête (R-08)", () => {
  it("dit la panne, avec Réessayer — jamais l'agenda vide", () => {
    mocks.agenda.isError = true
    renderWithEngine(<EvenementsPanel now={NOW} />)

    expect(screen.queryByText(emptyAgendaText(t))).toBeNull()
    expect(screen.queryByTestId("skeleton")).toBeNull()
    expect(screen.getByRole("alert").textContent).toContain("Agenda indisponible")

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(mocks.agenda.refetch).toHaveBeenCalledTimes(1)
  })

  it("une panne après données CONSERVE les évènements sous le bandeau", () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
    mocks.agenda.isError = true
    renderWithEngine(<EvenementsPanel now={NOW} />)

    expect(screen.getByText("Revue des archives")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("Agenda indisponible")
    expect(screen.queryByText(emptyAgendaText(t))).toBeNull()
  })

  it("montre un squelette en vraie attente seulement", () => {
    mocks.agenda.isPending = true
    mocks.agenda.isFetching = true
    mocks.agenda.fetchStatus = "fetching"
    renderWithEngine(<EvenementsPanel now={NOW} />)
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText(emptyAgendaText(t))).toBeNull()
  })

  it("rend le vrai agenda vide quand le serveur a répondu « rien »", () => {
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    expect(screen.getByText(emptyAgendaText(t))).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("lit l'agenda du réseau courant, à l'instant donné", () => {
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    expect(mocks.agendaArgs).toContainEqual({ networkId: TEST_NETWORK_ID, now: NOW })
  })

  it("l'agenda BORNÉ par le serveur dit sa lacune", () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")], true)
    renderWithEngine(<EvenementsPanel now={NOW} />)
    expect(screen.getByText("Votre agenda est long : seuls les évènements les plus proches sont affichés.")).toBeTruthy()
  })
})

describe("annoncer un évènement se COMPOSE (R-16)", () => {
  beforeEach(() => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
  })

  it("ouvre la boîte sans rien annoncer", async () => {
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Annoncer au réseau" }))

    const boite = await screen.findByRole("dialog")
    expect(boite.getAttribute("aria-label")).toContain("Revue des archives")
    // ⚠️ LE défaut d'origine : ce bouton PUBLIAIT, en `connections` codé en
    // dur, sans que personne n'ait choisi ni relu quoi que ce soit.
    expect(mocks.announce).not.toHaveBeenCalled()
  })

  it("prévisualise les DEUX publics, et suit le choix d'audience", async () => {
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Annoncer au réseau" }))
    await screen.findByRole("dialog")

    // `participantCount` vaut 2 dans la fixture.
    expect(screen.getByRole("dialog").textContent).toContain("2 personnes sont invitées")
    expect(screen.getByRole("dialog").textContent).toContain("vos connexions")

    fireEvent.change(screen.getByLabelText("Qui voit l'annonce"), {
      target: { value: "public" },
    })
    expect(screen.getByRole("dialog").textContent).toContain("tout le réseau")
  })

  it("annonce avec l'audience choisie ET le mot saisi", async () => {
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Annoncer au réseau" }))
    await screen.findByRole("dialog")

    fireEvent.change(screen.getByLabelText("Qui voit l'annonce"), {
      target: { value: "public" },
    })
    fireEvent.change(screen.getByLabelText("Ajouter un mot (facultatif)"), {
      target: { value: "Ouvert à tous les archivistes." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Annoncer" }))

    await waitFor(() => expect(mocks.announce).toHaveBeenCalledTimes(1))
    expect(mocks.announce.mock.calls[0]?.[0]).toEqual({
      networkId: TEST_NETWORK_ID,
      eventId: "e1",
      audience: "public",
      body: "Ouvert à tous les archivistes.",
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("n'envoie PAS de corps vide — le serveur compose alors l'annonce", async () => {
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Annoncer au réseau" }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Annoncer" }))

    await waitFor(() => expect(mocks.announce).toHaveBeenCalledTimes(1))
    expect(mocks.announce.mock.calls[0]?.[0]).toEqual({
      networkId: TEST_NETWORK_ID,
      eventId: "e1",
      audience: "connections",
    })
  })

  it("renonce sans rien envoyer", async () => {
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Annoncer au réseau" }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(mocks.announce).not.toHaveBeenCalled()
  })
})

describe("la carte distingue les invités de l'audience de l'annonce", () => {
  it("nomme les INVITÉS, avec leurs réponses", () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    // La fixture : 2 invités, 1 accepté.
    expect(screen.getByText(/Invités\s*:/).textContent).toContain("1 accepté")
    expect(screen.getByText(/Invités\s*:/).textContent).toContain("sur 2")
  })

  it("déplie la liste des invités, avec la réponse de chacun", () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
    mocks.paginated.paginateEventParticipants = {
      results: [
        {
          participationId: "pp1",
          status: "accepted",
          person: { personId: "p1", displayName: "Paul Mba", handle: "paul", headline: null, avatarUrl: null, source: "published" },
        },
        {
          participationId: "pp2",
          status: "pending",
          person: { personId: "p2", displayName: null, handle: null, headline: null, avatarUrl: null, source: "unknown" },
        },
      ],
      status: "Exhausted",
      loadMore: vi.fn(),
      isLoading: false,
    }
    renderWithEngine(<EvenementsPanel now={NOW} />)

    fireEvent.click(screen.getByRole("button", { name: "Voir les invités" }))
    const liste = screen.getByRole("region", { name: "Invités" })
    expect(liste.textContent).toContain("Paul Mba")
    expect(liste.textContent).toContain("Participe")
    expect(liste.textContent).toContain("Personne du réseau")
    expect(liste.textContent).toContain("Sans réponse")
  })
})

describe("créer un évènement — l'hôte, ou le volet lui-même", () => {
  it("appelle onCreateEvent quand un hôte l'écoute, et rien d'autre", () => {
    const onCreateEvent = vi.fn()
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} onCreateEvent={onCreateEvent} />)

    fireEvent.click(screen.getByRole("button", { name: "Créer un évènement" }))
    expect(onCreateEvent).toHaveBeenCalledTimes(1)
    expect(mocks.announce).not.toHaveBeenCalled()
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(screen.queryByRole("form", { name: "Créer un évènement" })).toBeNull()
  })

  it("sans hôte, le volet compose LUI-MÊME : le bouton ouvre la carte de composition", () => {
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} />)

    fireEvent.click(screen.getByRole("button", { name: "Créer un évènement" }))
    expect(screen.getByRole("form", { name: "Créer un évènement" })).toBeTruthy()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it("compose dans le réseau courant, au fuseau du navigateur, avec une clé tirée à l'ouverture", async () => {
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Créer un évènement" }))

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Pot de départ" } })
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-10" } })
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "09:00" } })
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "10:30" } })
    fireEvent.change(screen.getByLabelText("Lieu (optionnel)"), { target: { value: "Salle B" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer l'évènement" }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0]?.[0]).toEqual({
      networkId: TEST_NETWORK_ID,
      title: "Pot de départ",
      location: "Salle B",
      startAt: new Date(2026, 8, 10, 9, 0, 0).getTime(),
      endAt: new Date(2026, 8, 10, 10, 30, 0).getTime(),
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      idempotencyKey: expect.any(String),
    })
    await waitFor(() => expect(screen.queryByRole("form", { name: "Créer un évènement" })).toBeNull())
  })

  it("une fin qui ne suit pas le début se DIT, et rien ne part", () => {
    mocks.agenda.data = agenda([])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    fireEvent.click(screen.getByRole("button", { name: "Créer un évènement" }))

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Pot de départ" } })
    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "11:00" } })
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "10:00" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer l'évènement" }))

    expect(screen.getByText("La fin doit être postérieure au début")).toBeTruthy()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})

describe("l'INTENTION de composition portée par l'adresse (agenda-create-intent)", () => {
  /** La page réseau des routes de test, telle que l'application l'injecte. */
  const HOME = TEST_ROUTES.home()
  const GROUPS = `${HOME}?tab=groupes`
  const EVENTS = `${HOME}?tab=evenements`
  const INTENT = `tab=evenements&nouveau=evenement&retour=${encodeURIComponent(GROUPS)}`

  it("ouvre la composition, et retire l'intention de l'URL — une seule fois", () => {
    mocks.agenda.data = agenda([])
    const router = memoryRouter({ pathname: HOME, search: INTENT })
    renderWithEngine(<EvenementsPanel now={NOW} />, { router: router.implementation })

    expect(screen.getByRole("form", { name: "Créer un évènement" })).toBeTruthy()
    expect(router.calls).toEqual([{ method: "replace", href: EVENTS }])

    // Renoncer referme la carte, et l'adresse (inchangée ici) ne la rouvre pas.
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.queryByRole("form", { name: "Créer un évènement" })).toBeNull()
    expect(router.calls).toHaveLength(1)
  })

  it("après la création, rend la main à l'adresse de retour", async () => {
    mocks.agenda.data = agenda([])
    const router = memoryRouter({ pathname: HOME, search: INTENT })
    renderWithEngine(<EvenementsPanel now={NOW} />, { router: router.implementation })

    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Pot de départ" } })
    fireEvent.click(screen.getByRole("button", { name: "Créer l'évènement" }))

    await waitFor(() => expect(router.calls).toContainEqual({ method: "push", href: GROUPS }))
  })

  it("un retour HORS de la page réseau est ignoré — la composition s'ouvre quand même", () => {
    mocks.agenda.data = agenda([])
    const router = memoryRouter({ pathname: HOME, search: `tab=evenements&nouveau=evenement&retour=${encodeURIComponent("https://evil.example")}` })
    renderWithEngine(<EvenementsPanel now={NOW} />, { router: router.implementation })

    expect(screen.getByRole("form", { name: "Créer un évènement" })).toBeTruthy()
    expect(router.calls).toEqual([{ method: "replace", href: EVENTS }])
  })
})

describe("inviter des relations — l'acte de l'organisateur", () => {
  it("une demande par personne cochée, dans le réseau courant", async () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
    mocks.searchHits = [{ otherPersonId: "p-alice", displayName: "Alice Ndong", handle: "alice", headline: null, avatarUrl: null }]
    renderWithEngine(<EvenementsPanel now={NOW} />)

    fireEvent.click(screen.getByRole("button", { name: "Inviter des relations" }))
    expect(screen.getByRole("group", { name: "Inviter des relations à « Revue des archives »" })).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Chercher parmi mes relations"), { target: { value: "Ali" } })
    fireEvent.click(screen.getByRole("checkbox", { name: /Alice Ndong/ }))
    fireEvent.click(screen.getByRole("button", { name: /Inviter 1 personne/ }))

    await waitFor(() => expect(mocks.invite).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, eventId: "e1", handle: "alice" }))
    expect(mocks.invite).toHaveBeenCalledTimes(1)
  })

  it("ne s'offre ni à l'invité, ni sur un évènement annulé", () => {
    mocks.agenda.data = agenda([
      event("e1", "Chez Awa", { isOrganizer: false, myParticipation: { participationId: "pp1" as Id<"eventParticipants">, status: "pending" } }),
      event("e2", "Annulé", { status: "cancelled", cancelledAt: NOW }),
    ])
    renderWithEngine(<EvenementsPanel now={NOW} />)
    expect(screen.queryByRole("button", { name: "Inviter des relations" })).toBeNull()
  })
})

describe("répondre et annuler — le réseau courant, toujours", () => {
  it("répondre à une invitation passe la ligne de participation et le réseau", async () => {
    mocks.agenda.data = agenda([
      event("e1", "Chez Awa", { isOrganizer: false, myParticipation: { participationId: "pp1" as Id<"eventParticipants">, status: "pending" } }),
    ])
    renderWithEngine(<EvenementsPanel now={NOW} />)

    fireEvent.click(screen.getByRole("button", { name: "Je participe" }))
    await waitFor(() => expect(mocks.respond).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, participationId: "pp1", response: "accepted" }))
  })

  it("annuler passe par une confirmation explicite", async () => {
    mocks.agenda.data = agenda([event("e1", "Revue des archives")])
    renderWithEngine(<EvenementsPanel now={NOW} />)

    fireEvent.click(screen.getByRole("button", { name: "Annuler l'évènement" }))
    expect(mocks.cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'annulation" }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith({ networkId: TEST_NETWORK_ID, eventId: "e1" }))
  })
})
