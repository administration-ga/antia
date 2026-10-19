// P04 (18/10/2026) : le coordinateur de lecture — une vidéo à la fois, suspensions, lecture automatique muette, son sur geste.
import { describe, expect, it } from "vitest"

import { createMediaPlaybackCoordinator, IDLE_PLAYBACK_SNAPSHOT, type PlaybackEventType, type PlaybackTarget } from "./media-playback-coordinator"

/**
 * Un média de test : les évènements partent SYNCHRONES (le navigateur les met
 * en file ; l'ordre relatif est le même). `playResult` simule la politique
 * de lecture automatique.
 */
class FakeMedia implements PlaybackTarget {
  paused = true
  ended = false
  /** L'état muet au moment de chaque `play()`. */
  readonly playCalls: boolean[] = []
  playResult: "resolve" | "rejectAlways" | "rejectUnmuted" = "resolve"
  private mutedValue = false
  private readonly listeners = new Map<PlaybackEventType, Set<() => void>>()

  get muted(): boolean {
    return this.mutedValue
  }

  set muted(value: boolean) {
    if (this.mutedValue === value) return
    this.mutedValue = value
    this.emit("volumechange")
  }

  play(): Promise<void> {
    this.playCalls.push(this.mutedValue)
    if (this.playResult === "rejectAlways" || (this.playResult === "rejectUnmuted" && !this.mutedValue)) {
      return Promise.reject(new DOMException("blocked", "NotAllowedError"))
    }
    if (this.paused) {
      this.paused = false
      this.ended = false
      this.emit("play")
    }
    return Promise.resolve()
  }

  pause(): void {
    if (this.paused) return
    this.paused = true
    this.emit("pause")
  }

  addEventListener(type: PlaybackEventType, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set<() => void>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: PlaybackEventType, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  listenerCount(): number {
    let count = 0
    for (const set of this.listeners.values()) count += set.size
    return count
  }

  /** La personne lance la lecture avec les commandes natives. */
  userPlay(): void {
    if (!this.paused) return
    this.paused = false
    this.emit("play")
  }

  /** La personne met en pause avec les commandes natives. */
  userPause(): void {
    if (this.paused) return
    this.paused = true
    this.emit("pause")
  }

  /** La personne réactive le son avec les commandes natives. */
  userUnmute(): void {
    this.mutedValue = false
    this.emit("volumechange")
  }

  /** La vidéo arrive à sa fin. */
  finish(): void {
    this.paused = true
    this.ended = true
    this.emit("pause")
    this.emit("ended")
  }

  private emit(type: PlaybackEventType): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("au plus UNE vidéo active", () => {
  it("la lecture de B met A en pause, sans la tenir pour une pause de la personne", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const a = new FakeMedia()
    const b = new FakeMedia()
    coordinator.register("a", a, "unmanaged")
    coordinator.register("b", b, "unmanaged")
    a.userPlay()
    expect(coordinator.playingId()).toBe("a")
    b.userPlay()
    expect(a.paused).toBe(true)
    expect(b.paused).toBe(false)
    expect(coordinator.playingId()).toBe("b")
    // A n'affiche aucune suspension : elle a été remplacée, pas interrompue.
    expect(coordinator.getSnapshot("a").suspendedBy).toBeNull()
  })

  it("une seule lecture automatique par passage, même si deux médias se disent actifs", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const first = new FakeMedia()
    const second = new FakeMedia()
    coordinator.register("first", first, "active")
    coordinator.register("second", second, "active")
    expect([first.paused, second.paused].filter((paused) => !paused)).toHaveLength(1)
    expect(coordinator.playingId()).toBe("first")
  })
})

describe("lecture automatique muette du créneau actif", () => {
  it("lance muet la vidéo lue, ne lance ni la voisine ni la lointaine", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const active = new FakeMedia()
    const next = new FakeMedia()
    const far = new FakeMedia()
    coordinator.register("active", active, "active")
    coordinator.register("next", next, "neighbor")
    coordinator.register("far", far, "distant")
    expect(active.paused).toBe(false)
    expect(active.playCalls).toEqual([true])
    expect(next.playCalls).toEqual([])
    expect(far.playCalls).toEqual([])
    expect(coordinator.preloadFor("neighbor")).toBe("metadata")
    expect(coordinator.preloadFor("distant")).toBe("none")
  })

  it("hors lecteur (mode Liste), aucune lecture automatique", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const listed = new FakeMedia()
    coordinator.register("listed", listed, "unmanaged")
    expect(listed.playCalls).toEqual([])
    expect(coordinator.getSnapshot("listed").needsManualStart).toBe(false)
  })

  it("économie de données : aucune vidéo anticipée, « Lire » sur la publication lue", () => {
    const coordinator = createMediaPlaybackCoordinator()
    coordinator.setEnvironment({ dataSaver: true })
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    expect(video.playCalls).toEqual([])
    expect(coordinator.getSnapshot("video").needsManualStart).toBe(true)
    expect(coordinator.preloadFor("active")).toBe("none")
    expect(coordinator.preloadFor("neighbor")).toBe("none")
    coordinator.requestPlay("video")
    expect(video.paused).toBe(false)
  })

  it("un refus du navigateur bascule sur « Lire », jamais une lecture forcée", async () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    video.playResult = "rejectAlways"
    coordinator.register("video", video, "active")
    await flush()
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").needsManualStart).toBe(true)
    const attempts = video.playCalls.length
    // Aucune nouvelle tentative silencieuse.
    coordinator.setVisibility("video", 0.9)
    expect(video.playCalls.length).toBe(attempts)
    // Le geste de la personne, lui, lance la lecture.
    video.playResult = "resolve"
    coordinator.requestPlay("video")
    expect(video.paused).toBe(false)
  })
})

describe("suspensions : onglet masqué, appel, hors écran", () => {
  it("l'onglet masqué suspend, l'onglet revenu reprend la lecture automatique", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    expect(video.paused).toBe(false)
    coordinator.setEnvironment({ documentHidden: true })
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").suspendedBy).toBe("hidden")
    coordinator.setEnvironment({ documentHidden: false })
    expect(video.paused).toBe(false)
    expect(coordinator.getSnapshot("video").suspendedBy).toBeNull()
  })

  it("un appel entrant ou actif suspend et interdit tout départ, même par les commandes natives", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    coordinator.setEnvironment({ callInProgress: true })
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").suspendedBy).toBe("call")
    video.userPlay()
    expect(video.paused).toBe(true)
    coordinator.requestPlay("video")
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").suspendedBy).toBe("call")
    coordinator.setEnvironment({ callInProgress: false })
    expect(video.paused).toBe(false)
  })

  it("une vidéo en liste qui sort de l'écran se suspend, sans reprise automatique", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "unmanaged")
    video.userPlay()
    coordinator.setVisibility("video", 0.2)
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").suspendedBy).toBe("offscreen")
    coordinator.setVisibility("video", 1)
    expect(video.paused).toBe(true)
    expect(coordinator.getSnapshot("video").suspendedBy).toBeNull()
  })

  it("la vidéo lue, sous le seuil de 70 %, se suspend ; au-dessus, elle reprend", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    coordinator.setVisibility("video", 0.6)
    expect(video.paused).toBe(true)
    coordinator.setVisibility("video", 0.8)
    expect(video.paused).toBe(false)
  })

  it("quitter la publication lue la met en pause", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    coordinator.setRole("video", "distant")
    expect(video.paused).toBe(true)
  })
})

describe("la personne garde la main", () => {
  it("sa pause est respectée tant que la publication reste lue ; y revenir relance", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    video.userPause()
    coordinator.setVisibility("video", 1)
    expect(video.paused).toBe(true)
    coordinator.setRole("video", "distant")
    coordinator.setRole("video", "active")
    expect(video.paused).toBe(false)
  })

  it("la fin d'une vidéo n'entraîne ni relance ni passage au post suivant", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    const calls = video.playCalls.length
    video.finish()
    coordinator.setVisibility("video", 1)
    expect(video.paused).toBe(true)
    expect(video.playCalls.length).toBe(calls)
    expect(coordinator.getSnapshot("video").status).toBe("ended")
  })

  it("le son demande un geste ; la préférence vaut ensuite pour la session", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const first = new FakeMedia()
    coordinator.register("first", first, "active")
    expect(first.muted).toBe(true)
    coordinator.toggleSound("first")
    expect(first.muted).toBe(false)
    expect(coordinator.getSnapshot("first").soundOn).toBe(true)
    coordinator.setRole("first", "distant")
    const second = new FakeMedia()
    coordinator.register("second", second, "active")
    expect(second.playCalls).toEqual([false])
  })

  it("un son refusé sans geste du moment repart muet, et le dit", async () => {
    const coordinator = createMediaPlaybackCoordinator()
    const first = new FakeMedia()
    coordinator.register("first", first, "active")
    coordinator.toggleSound("first")
    coordinator.setRole("first", "distant")
    const second = new FakeMedia()
    second.playResult = "rejectUnmuted"
    coordinator.register("second", second, "active")
    await flush()
    expect(second.paused).toBe(false)
    expect(second.muted).toBe(true)
    expect(coordinator.getSnapshot("second").muted).toBe(true)
  })

  it("un réglage du son par les commandes natives devient la préférence (dans le lecteur)", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "active")
    video.userUnmute()
    expect(coordinator.getSnapshot("video").soundOn).toBe(true)
  })
})

describe("cycle de vie", () => {
  it("retirer un média le met en pause, retire ses écouteurs et rend l'état de repos", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    const release = coordinator.register("video", video, "active")
    expect(video.paused).toBe(false)
    release()
    expect(video.paused).toBe(true)
    expect(video.listenerCount()).toBe(0)
    expect(coordinator.getSnapshot("video")).toBe(IDLE_PLAYBACK_SNAPSHOT)
    expect(coordinator.playingId()).toBeNull()
  })

  it("un instantané garde sa référence tant que rien ne change (abonnement React stable)", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    coordinator.register("video", video, "neighbor")
    const before = coordinator.getSnapshot("video")
    coordinator.setVisibility("video", 0.4)
    expect(coordinator.getSnapshot("video")).toBe(before)
  })

  it("notifie les abonnés d'un média quand son état change", () => {
    const coordinator = createMediaPlaybackCoordinator()
    const video = new FakeMedia()
    let calls = 0
    const unsubscribe = coordinator.subscribe("video", () => {
      calls += 1
    })
    coordinator.register("video", video, "active")
    expect(calls).toBeGreaterThan(0)
    unsubscribe()
    const after = calls
    coordinator.setEnvironment({ documentHidden: true })
    expect(calls).toBe(after)
  })
})
