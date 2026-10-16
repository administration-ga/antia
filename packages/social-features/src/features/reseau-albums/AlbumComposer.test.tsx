// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/AlbumComposer.test.tsx @ ad2e7fdc2 — adaptations : références TYPÉES du moteur reconnues par leur nom généré (`modules/albums/albums:*`, dépôt `modules/media/media:generateUploadUrl`) ; rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n français, réseau de test) ; chaque appel porte le réseau courant, le dépôt l'usage `album_image` ; refus serveur à la forme du moteur (`error.data` porte une règle et ses bornes, traduite) ; barre de progression rendue sur place (plus de `Progress` à simuler) ; adresses de dépôt neutres ; les 15 cas sont gardés ; cas ajoutés : au-delà de douze photos l'enregistrement part par lots, et un refus à la publication se dit traduit sans publier.
// @vitest-environment jsdom

/**
 * AlbumComposer — le parcours complet, monté (R-09, ADR-0145).
 *
 * Cinq choses que seul un test MONTÉ peut prouver — le module pur
 * (`album-model.test.ts`) décide, mais il ne branche rien :
 *
 *  1. le brouillon SERVEUR naît à l'envoi des photos, pas à l'ouverture : rien
 *     n'existe tant qu'on n'a pas déposé un octet ;
 *  2. les métadonnées EXIF partent AVANT le téléversement (ré-encodage), et un
 *     ré-encodage impossible REFUSE le fichier au lieu d'envoyer l'original ;
 *  3. la REPRISE : un renvoi après une coupure ne re-téléverse que le reste, et
 *     `addItems` ne redouble rien (deux idempotences, à deux niveaux) ;
 *  4. l'ordre et la couverture partent AVEC la publication, en une fois ;
 *  5. un refus serveur est lu dans `error.data` — jamais inventé.
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine, TEST_NETWORK_ID } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  /** Tous les appels serveur, dans l'ordre : `[nom, arguments]`. */
  calls: [] as { name: string; args: unknown }[],
  /** Ce que chaque mutation rend, par NOM de fonction. */
  replies: {} as Record<string, (args: unknown) => unknown>,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server")
  return {
    useMutation: (reference: unknown) => (args: unknown) => {
      const name = getFunctionName(reference as never)
      mocks.calls.push({ name, args })
      const reply = mocks.replies[name]
      try {
        return Promise.resolve(reply ? reply(args) : { ok: true })
      } catch (error) {
        return Promise.reject(error)
      }
    },
  }
})
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
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
  }) => <button type="button" {...props}>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Icon: () => null,
  TextArea: (props: InputHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...(props as object)} />
  ),
  TextInput: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

import { AlbumComposer } from "./AlbumComposer"

const ALBUMS = "modules/albums/albums"
const DEPOT = "modules/media/media:generateUploadUrl"

/** Un fichier acceptable — `image/jpeg`, sous la borne du fil. */
function photo(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" })
}

/** Le ré-encodage, injecté : `canvas` n'existe pas en `jsdom`. */
const reencodeOk = vi.fn(async (file: File) => ({ ok: true as const, file }))

function nomsAppeles(): string[] {
  return mocks.calls.map((call) => call.name.split(":").at(-1) ?? call.name)
}

function argsDe(suffixe: string): unknown {
  return mocks.calls.find((call) => call.name.endsWith(suffixe))?.args
}

/** Mène le composeur jusqu'à l'étape « Photos », album titré. */
function ouvrirEtapePhotos(titre = "Mission de terrain") {
  fireEvent.change(screen.getByLabelText("Titre de l'album"), {
    target: { value: titre },
  })
  fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
}

/**
 * Attend l'étape « Ordre et couverture ».
 *
 * ⚠️ Ancré sur la CONSIGNE de l'étape, jamais sur son libellé : la puce
 * d'étape porte « 3. Ordre et couverture » et reste rendue à toutes les
 * étapes — un tel ancrage passerait au vert sans qu'on ait avancé d'un pas.
 */
async function attendreEtapeOrdre() {
  await waitFor(() =>
    expect(
      screen.getByText(/Rangez les photos et choisissez la couverture/),
    ).toBeTruthy(),
  )
}

/**
 * L'annonce `sr-only` du composeur. Deux `role="status"` coexistent — la
 * progression du téléversement et l'annonce des déplacements — et les
 * confondre ferait passer l'une pour l'autre.
 */
function annonce(): HTMLElement {
  return screen
    .getAllByRole("status")
    .find((element) => element.classList.contains("sr-only"))!
}

/** La ligne de progression, l'autre `role="status"`. */
function progression(): HTMLElement {
  return screen
    .getAllByRole("status")
    .find((element) => !element.classList.contains("sr-only"))!
}

/** Sélectionne des fichiers, puis attend que le ré-encodage soit consommé. */
async function choisir(...fichiers: File[]) {
  const input = screen.getByLabelText("Choisir des photos") as HTMLInputElement
  Object.defineProperty(input, "files", { value: fichiers, configurable: true })
  fireEvent.change(input)
  await waitFor(() =>
    expect(screen.getAllByText(/^En attente$|^Envoyée$|^À reprendre$/).length).toBe(
      fichiers.length,
    ),
  )
}

let compteurStorage = 0

beforeEach(() => {
  mocks.calls = []
  mocks.replies = {}
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  reencodeOk.mockClear()
  compteurStorage = 0

  // jsdom n'implémente ni les URL d'objet ni `fetch`.
  URL.createObjectURL = vi.fn(() => "blob:apercu")
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      compteurStorage += 1
      return {
        ok: true,
        json: async () => ({ storageId: `st-${compteurStorage}` }),
      } as unknown as Response
    }),
  )

  mocks.replies[`${ALBUMS}:create`] = () => ({
    albumId: "al-1",
    created: true,
  })
  mocks.replies[DEPOT] = () => "blob:depot-album"
  mocks.replies[`${ALBUMS}:addItems`] = (args) => {
    const items = (args as { items: { idempotencyKey: string }[] }).items
    return {
      added: items.length,
      skipped: 0,
      itemIds: items.map((_, index) => `it-${index + 1}`),
    }
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ⚠️ Suite LENTE sous charge : un parcours monté complet (Testing Library +
// jsdom) par cas ; vu le 07/09 à 5,4 s pour « refuse d'avancer sans titre »
// quand 13 fichiers tournent en parallèle — vert seul en moins d'une seconde.
vi.setConfig({ testTimeout: 20_000 })

describe("AlbumComposer — l'identité d'abord, et rien n'est visible", () => {
  it("refuse d'avancer sans titre, et le DIT", () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)

    expect(screen.getByText("Donnez un titre à cet album.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Continuer" }).hasAttribute("disabled")).toBe(
      true,
    )
  })

  it("annonce que rien n'est publié tant qu'on n'a pas publié", () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    expect(screen.getByText(/Rien n'est visible tant que vous n'avez pas publié/)).toBeTruthy()
  })

  it("l'audience est un CHOIX explicite, dit en clair, et par défaut la plus fermée", () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    const connexions = screen.getByLabelText(/Mes connexions/) as HTMLInputElement
    expect(connexions.checked).toBe(true)
    // « Tout le réseau » n'est PAS « Internet » : la phrase doit le dire.
    expect(screen.getByText(/Cet album ne sort pas de la plateforme/)).toBeTruthy()
  })

  it("aucun album n'est créé au seul fait d'ouvrir le composeur", () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    expect(nomsAppeles()).toEqual([])
  })
})

describe("AlbumComposer — les métadonnées partent AVANT l'octet", () => {
  it("chaque photo passe par le ré-encodage", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"), photo("b.jpg"))
    expect(reencodeOk).toHaveBeenCalledTimes(2)
  })

  it("un ré-encodage impossible REFUSE le fichier — jamais l'original", async () => {
    const refus = vi.fn(async () => ({
      ok: false as const,
      reason: "« a.jpg » n'a pas pu être préparée : elle n'a pas été envoyée.",
    }))
    renderWithEngine(<AlbumComposer handle="awa" reencode={refus} />)
    ouvrirEtapePhotos()

    const input = screen.getByLabelText("Choisir des photos") as HTMLInputElement
    Object.defineProperty(input, "files", {
      value: [photo("a.jpg")],
      configurable: true,
    })
    fireEvent.change(input)

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "n'a pas pu être préparée",
      ),
    )
    // Rien n'est entré dans le brouillon, donc rien ne peut partir.
    expect(screen.getByText(/Aucune photo —/)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe("AlbumComposer — envoyer, reprendre, ordonner, publier", () => {
  it("l'envoi crée le brouillon, téléverse et enregistre le lot", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos("Mission à Oyem")
    await choisir(photo("a.jpg"), photo("b.jpg"))

    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await waitFor(() => expect(nomsAppeles()).toContain("addItems"))

    // L'ordre est le contrat : créer, puis une URL par fichier, puis le lot.
    expect(nomsAppeles()).toEqual([
      "create",
      "generateUploadUrl",
      "generateUploadUrl",
      "addItems",
    ])
    expect(argsDe(":create")).toMatchObject({
      networkId: TEST_NETWORK_ID,
      title: "Mission à Oyem",
      audience: "connections",
    })
    // Le dépôt se fait DANS le réseau courant, sous l'usage des albums.
    expect(argsDe(":generateUploadUrl")).toEqual({
      networkId: TEST_NETWORK_ID,
      usage: "album_image",
    })
    const ajout = argsDe(":addItems") as {
      networkId: string
      albumId: string
      items: { storageId: string; idempotencyKey: string }[]
    }
    expect(ajout.networkId).toBe(TEST_NETWORK_ID)
    expect(ajout.albumId).toBe("al-1")
    expect(ajout.items.map((item) => item.storageId)).toEqual(["st-1", "st-2"])
    // Une clé PAR FICHIER, distinctes — c'est ce qui rend la reprise exacte.
    expect(new Set(ajout.items.map((item) => item.idempotencyKey)).size).toBe(2)
  })

  it("un renvoi ne re-téléverse RIEN et ne crée pas un second album", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"))

    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()
    const apresPremier = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length

    // Revenir sur les photos et renvoyer : les octets déjà déposés sont acquis.
    fireEvent.click(screen.getByRole("button", { name: "Retour" }))
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    await waitFor(() =>
      expect(nomsAppeles().filter((nom) => nom === "addItems").length).toBe(2),
    )

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      apresPremier,
    )
    // Et la MÊME clé d'idempotence d'album : un seul `create`.
    expect(nomsAppeles().filter((nom) => nom === "create").length).toBe(1)
    const [premier, second] = mocks.calls
      .filter((call) => call.name.endsWith(":addItems"))
      .map((call) => (call.args as { items: { idempotencyKey: string }[] }).items)
    expect(second![0]!.idempotencyKey).toBe(premier![0]!.idempotencyKey)
  })

  it("au-delà de douze photos, l'enregistrement part par LOTS — le moteur refuse un lot plus grand", async () => {
    let suivant = 0
    mocks.replies[`${ALBUMS}:addItems`] = (args) => {
      const items = (args as { items: unknown[] }).items
      return { added: items.length, skipped: 0, itemIds: items.map(() => `it-${(suivant += 1)}`) }
    }
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(...Array.from({ length: 13 }, (_, index) => photo(`p${index + 1}.jpg`)))

    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()

    const lots = mocks.calls
      .filter((call) => call.name.endsWith(":addItems"))
      .map((call) => (call.args as { items: { idempotencyKey: string }[] }).items)
    expect(lots.map((lot) => lot.length)).toEqual([12, 1])
    // Toutes les photos, chacune sa clé, dans l'ordre de la sélection.
    expect(new Set(lots.flat().map((item) => item.idempotencyKey)).size).toBe(13)
    expect(screen.getByText("Photo 13 sur 13")).toBeTruthy()
    expect(annonce().textContent).toContain("13 photos dans l'album.")
  })

  it("ce qui reste à envoyer est ANNONCÉ, sans laisser croire qu'on recommence", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"), photo("b.jpg"))

    const statut = progression()
    expect(statut.getAttribute("aria-live")).toBe("polite")
    expect(statut.textContent).toContain("Envoi en cours : 0 sur 2.")
  })

  it("l'ordre et la couverture partent AVEC la publication", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"), photo("b.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()

    // Descendre la première, prendre la seconde en couverture.
    fireEvent.click(screen.getByRole("button", { name: "Descendre la photo 1" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Définir la photo 1 comme couverture" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    fireEvent.click(screen.getByRole("button", { name: "Publier l'album" }))

    await waitFor(() => expect(nomsAppeles()).toContain("publish"))
    expect(argsDe(":reorder")).toEqual({
      networkId: TEST_NETWORK_ID,
      albumId: "al-1",
      itemIds: ["it-2", "it-1"],
    })
    expect(argsDe(":setCover")).toEqual({ networkId: TEST_NETWORK_ID, albumId: "al-1", itemId: "it-2" })
    expect(argsDe(":publish")).toEqual({ networkId: TEST_NETWORK_ID, albumId: "al-1" })
  })

  it("un déplacement au clavier s'ANNONCE — sinon la carte bouge en silence", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"), photo("b.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()

    fireEvent.click(screen.getByRole("button", { name: "Descendre la photo 1" }))
    expect(annonce().textContent).toContain("est en position 2 sur 2")
  })

  it("l'aperçu dit l'audience et ce que le retrait ne rappellera pas", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos("Mission à Oyem")
    await choisir(photo("a.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Mission à Oyem")
    expect(screen.getByText(/Seules les personnes avec qui vous êtes connecté/)).toBeTruthy()
    expect(
      screen.getByText(/une copie déjà téléchargée par un lecteur ne peut pas être rappelée/i),
    ).toBeTruthy()
  })

  it("prévient le parent une fois l'album publié", async () => {
    const publie = vi.fn()
    renderWithEngine(
      <AlbumComposer handle="awa" reencode={reencodeOk} onPublished={publie} />,
    )
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    fireEvent.click(screen.getByRole("button", { name: "Publier l'album" }))

    await waitFor(() => expect(publie).toHaveBeenCalledWith("al-1"))
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Album publié.")
  })
})

describe("AlbumComposer — un refus se LIT", () => {
  it("le refus serveur vient de `error.data`, jamais d'une phrase inventée", async () => {
    mocks.replies[`${ALBUMS}:addItems`] = () => {
      throw Object.assign(new Error("Server Error"), {
        data: { code: "invalidArgument", rule: "ALBUM_FULL", params: { max: 60 } },
      })
    }
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Un album porte au plus 60 photos.",
      ),
    )
    expect(screen.queryByText(/Server Error/)).toBeNull()
  })

  it("un refus à la publication se dit traduit, et rien n'est publié", async () => {
    mocks.replies[`${ALBUMS}:reorder`] = () => {
      throw Object.assign(new Error("Server Error"), {
        data: { code: "invalidArgument", rule: "ALBUM_REORDER_MISMATCH" },
      })
    }
    const publie = vi.fn()
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} onPublished={publie} />)
    ouvrirEtapePhotos()
    await choisir(photo("a.jpg"))
    fireEvent.click(screen.getByRole("button", { name: "Envoyer les photos" }))
    await attendreEtapeOrdre()
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }))
    fireEvent.click(screen.getByRole("button", { name: "Publier l'album" }))

    // L'aperçu porte déjà son propre bandeau (« Avant de publier ») : le refus
    // est le bandeau « Action refusée », qui s'y ajoute.
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .find((alerte) => alerte.textContent?.startsWith("Action refusée"))?.textContent,
      ).toContain("L'ordre demandé ne correspond plus à cet album."),
    )
    expect(nomsAppeles()).not.toContain("publish")
    expect(publie).not.toHaveBeenCalled()
    expect(screen.queryByText(/Server Error/)).toBeNull()
  })

  it("une image refusée par le brouillon le dit, sans faire tomber la sélection", async () => {
    renderWithEngine(<AlbumComposer handle="awa" reencode={reencodeOk} />)
    ouvrirEtapePhotos()

    const input = screen.getByLabelText("Choisir des photos") as HTMLInputElement
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "note.txt", { type: "text/plain" })],
      configurable: true,
    })
    fireEvent.change(input)

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "n'est pas une image acceptée",
      ),
    )
  })
})
