// @vitest-environment jsdom
// P04 (18/10/2026) : la vidéo de la présentation « media » sur le coordinateur — inerte sans lui, « Lire » et « Son » dans le créneau actif.
import type { PostMediaDto } from "@antsia/social-contracts/media"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../../i18n"
import { PostMedia } from "../reseau-personnel/PostMedia"
import { createMediaPlaybackCoordinator, type MediaPlaybackCoordinator } from "./media-playback-coordinator"
import { MediaPlaybackScope } from "./media-playback-context"
import type { MediaRole } from "./media-playback-policy"
import { MediaRoleProvider } from "./media-role-context"

const video: PostMediaDto = { kind: "video", mimeType: "video/mp4", url: "https://media.example/clip.mp4", withheld: null, width: 900, height: 1600 }

function surface(children: ReactNode) {
  const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "social" })
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

function renderCoordinated(coordinator: MediaPlaybackCoordinator, role: MediaRole, gutter = 16) {
  return render(
    surface(
      <MediaPlaybackScope coordinator={coordinator}>
        <MediaRoleProvider value={role}>
          <PostMedia media={[video]} gutter={gutter} presentation="media" />
        </MediaRoleProvider>
      </MediaPlaybackScope>,
    ),
  )
}

beforeEach(() => {
  // jsdom n'implémente pas la lecture : elle est simulée, sans évènement.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sans coordinateur : la vidéo P03, à l'identique", () => {
  it("métadonnées seulement, commandes natives, aucune commande ajoutée ni lecture", () => {
    const view = render(surface(<PostMedia media={[video]} presentation="media" />))
    const player = view.container.querySelector("video")
    expect(player).toHaveAttribute("preload", "metadata")
    expect(player).toHaveAttribute("controls")
    expect(screen.queryByRole("button", { name: "Lire la vidéo" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Son de la vidéo" })).toBeNull()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it("la présentation historique (« classic ») ne change pas", () => {
    const view = render(surface(<PostMedia media={[video]} presentation="classic" />))
    const player = view.container.querySelector("video")
    expect(player).toHaveAttribute("preload", "metadata")
    expect(player).not.toHaveAttribute("playsinline")
    expect(screen.queryByRole("button", { name: "Son de la vidéo" })).toBeNull()
  })
})

describe("avec le coordinateur de la session", () => {
  it("en liste (hors lecteur), aucune lecture automatique ni commande ajoutée", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const view = renderCoordinated(coordinator, "unmanaged")
    expect(view.container.querySelector("video")).toHaveAttribute("preload", "metadata")
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Son de la vidéo" })).toBeNull()
  })

  it("la publication lue démarre muette quand le navigateur l'admet", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const view = renderCoordinated(coordinator, "active")
    const player = view.container.querySelector("video")
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    expect(player?.muted).toBe(true)
    // « Son » : bouton à bascule, son coupé au départ.
    expect(screen.getByRole("button", { name: "Son de la vidéo" })).toHaveAttribute("aria-pressed", "false")
  })

  it("la lecture automatique refusée affiche « Lire », qui lance la lecture sur geste", () => {
    const coordinator = createMediaPlaybackCoordinator()
    coordinator.setAutoplayCapability("blocked")
    renderCoordinated(coordinator, "active")
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })

  it("la voisine prépare ses métadonnées, une lointaine rien", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const neighbor = renderCoordinated(coordinator, "neighbor")
    expect(neighbor.container.querySelector("video")).toHaveAttribute("preload", "metadata")
    neighbor.unmount()
    const distant = renderCoordinated(coordinator, "distant")
    expect(distant.container.querySelector("video")).toHaveAttribute("preload", "none")
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it("une vidéo CITÉE (sans gouttière) ne démarre jamais d'elle-même", () => {
    const coordinator = createMediaPlaybackCoordinator()
    renderCoordinated(coordinator, "active", 0)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it("pendant un appel, aucune lecture ne démarre et la raison est dite", () => {
    const coordinator = createMediaPlaybackCoordinator()
    coordinator.setEnvironment({ callInProgress: true })
    const view = renderCoordinated(coordinator, "active")
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    // La personne tente les commandes natives : la lecture est refusée, et dite.
    const player = view.container.querySelector("video")
    if (player === null) throw new Error("vidéo absente")
    fireEvent.play(player)
    expect(screen.getByText("Lecture suspendue pendant l'appel.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lire la vidéo" })).toBeNull()
  })
})
