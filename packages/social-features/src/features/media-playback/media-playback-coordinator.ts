/**
 * media-playback-coordinator — LE coordinateur de lecture des vidéos de
 * publication (lot P04 de l'étude social-commerce du 18/10/2026).
 *
 * Un objet par session de membre (`MediaPlaybackProvider`), sans React : il
 * reçoit des éléments médias (`PlaybackTarget`, qu'un `HTMLVideoElement`
 * satisfait), leur rôle (donné par le lecteur immersif), leur visibilité
 * (mesurée par `IntersectionObserver`) et l'environnement (onglet, appel,
 * économie de données), puis applique les décisions PURES de
 * `media-playback-policy.ts`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE LE COORDINATEUR GARANTIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · AU PLUS UNE vidéo joue : toute lecture — lancée par la personne
 *    (commandes natives, « Lire ») ou par la lecture automatique — met les
 *    autres en pause ;
 *  · la lecture automatique ne vise que le média du créneau ACTIF du lecteur,
 *    muette sauf préférence de son posée par un geste, jamais en économie de
 *    données ; un refus du navigateur bascule sur « Lire » ;
 *  · un appel (sonnerie ou appel en cours) ou un onglet masqué suspendent la
 *    lecture et en interdisent un nouveau départ ; une vidéo qui sort de
 *    l'écran (sous le seuil) se suspend ;
 *  · aucune relance à la fin d'une vidéo, aucun passage au post suivant ;
 *  · une pause de la personne est respectée tant que le média reste actif.
 *
 * ⚠️ Les évènements `play`, `pause` et `volumechange` ne disent pas QUI les a
 * causés. Le coordinateur compte donc ses propres gestes (`ourPauses`,
 * `ourVolumeChanges`, `pendingPlay`) et n'incrémente un compteur que si
 * l'action change réellement l'état (un `pause()` sur un média déjà en pause
 * n'émet rien) : tout évènement non attendu vient de la personne.
 */

import {
  autoplayDecision,
  DEFAULT_PLAYBACK_ENVIRONMENT,
  environmentSuspension,
  isAutoplayRejection,
  isInterruptedPlay,
  isSufficientlyVisible,
  normalizedThreshold,
  preloadFor,
  suspensionFor,
  type AutoplayCapability,
  type MediaPreload,
  type MediaRole,
  type PlaybackEnvironment,
  type PlaybackSuspension,
} from "./media-playback-policy"

export type PlaybackEventType = "play" | "pause" | "volumechange" | "ended"

/** Ce que le coordinateur pilote d'un média — `HTMLVideoElement` le satisfait tel quel. */
export interface PlaybackTarget {
  readonly paused: boolean
  readonly ended: boolean
  muted: boolean
  play(): Promise<void> | void
  pause(): void
  addEventListener(type: PlaybackEventType, listener: () => void): void
  removeEventListener(type: PlaybackEventType, listener: () => void): void
}

export type MediaPlaybackStatus = "idle" | "playing" | "paused" | "ended"

/** L'état d'UN média, tel que ses commandes le lisent (référence stable tant qu'il ne change pas). */
export interface MediaPlaybackSnapshot {
  status: MediaPlaybackStatus
  role: MediaRole
  /** Piloté par le lecteur immersif (rôle ≠ `unmanaged`). */
  managed: boolean
  muted: boolean
  /** La préférence de son de la session, posée par un geste. */
  soundOn: boolean
  /** Ce qui a suspendu la dernière lecture, tant que la cause dure. */
  suspendedBy: PlaybackSuspension | null
  /** « Lire » : média actif que la lecture automatique ne peut pas démarrer. */
  needsManualStart: boolean
}

export const IDLE_PLAYBACK_SNAPSHOT: MediaPlaybackSnapshot = Object.freeze({
  status: "idle",
  role: "unmanaged",
  managed: false,
  muted: false,
  soundOn: false,
  suspendedBy: null,
  needsManualStart: false,
})

/** `play()` rend une promesse dans les navigateurs actuels, rien dans les anciens. */
function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function"
}

interface Entry {
  readonly id: string
  target: PlaybackTarget | null
  role: MediaRole
  visibleRatio: number | null
  userPaused: boolean
  /** Remplacé par une autre lecture : il ne la reprend pas de lui-même. */
  displaced: boolean
  everPlayed: boolean
  suspendedBy: PlaybackSuspension | null
  pendingPlay: boolean
  ourPauses: number
  ourVolumeChanges: number
  snapshot: MediaPlaybackSnapshot
  detach: (() => void) | null
}

export interface MediaPlaybackCoordinator {
  readonly threshold: number
  /** Déclare un média avec son rôle du moment ; le retour le retire (et le met en pause). */
  register(id: string, target: PlaybackTarget, role: MediaRole): () => void
  /** Le rôle d'un média DÉJÀ déclaré (sans effet sinon : la déclaration porte le rôle). */
  setRole(id: string, role: MediaRole): void
  setVisibility(id: string, ratio: number): void
  setEnvironment(patch: Partial<PlaybackEnvironment>): void
  setAutoplayCapability(capability: AutoplayCapability): void
  /** « Lire » : geste explicite de la personne. */
  requestPlay(id: string): void
  /** « Son » : geste explicite — active le son s'il est coupé, le coupe sinon. */
  toggleSound(id: string): void
  subscribe(id: string, listener: () => void): () => void
  getSnapshot(id: string): MediaPlaybackSnapshot
  subscribeEnvironment(listener: () => void): () => void
  getEnvironment(): PlaybackEnvironment
  /** Le préchargement d'un rôle dans l'environnement courant (premier rendu compris). */
  preloadFor(role: MediaRole): MediaPreload
  /** Diagnostic et tests : le média qui joue, s'il y en a un. */
  playingId(): string | null
}

export function createMediaPlaybackCoordinator(options: { threshold?: number } = {}): MediaPlaybackCoordinator {
  const threshold = normalizedThreshold(options.threshold)
  const entries = new Map<string, Entry>()
  const listeners = new Map<string, Set<() => void>>()
  const environmentListeners = new Set<() => void>()
  let environment: PlaybackEnvironment = DEFAULT_PLAYBACK_ENVIRONMENT
  let capability: AutoplayCapability = "unknown"
  let soundOn = false
  let evaluating = false

  const decisionFor = (entry: Entry) =>
    autoplayDecision({
      role: entry.role,
      capability,
      environment,
      visibleRatio: entry.visibleRatio,
      threshold,
      userPaused: entry.userPaused,
      ended: entry.target?.ended === true,
      displaced: entry.displaced,
    })

  const statusOf = (entry: Entry): MediaPlaybackStatus => {
    const target = entry.target
    if (target === null) return "idle"
    if (target.ended) return "ended"
    if (!target.paused) return "playing"
    return entry.everPlayed ? "paused" : "idle"
  }

  /** Recalcule l'instantané ; une nouvelle référence SEULEMENT s'il a changé. */
  const refresh = (entry: Entry) => {
    const target = entry.target
    const paused = target === null || target.paused
    const next: MediaPlaybackSnapshot = {
      status: statusOf(entry),
      role: entry.role,
      managed: entry.role !== "unmanaged",
      muted: target?.muted === true,
      soundOn,
      suspendedBy: entry.suspendedBy,
      needsManualStart: target !== null && paused && !entry.pendingPlay && decisionFor(entry) === "manual",
    }
    const current = entry.snapshot
    const same =
      current.status === next.status &&
      current.role === next.role &&
      current.managed === next.managed &&
      current.muted === next.muted &&
      current.soundOn === next.soundOn &&
      current.suspendedBy === next.suspendedBy &&
      current.needsManualStart === next.needsManualStart
    if (same) return
    entry.snapshot = Object.freeze(next)
    for (const listener of listeners.get(entry.id) ?? []) listener()
  }

  const refreshAll = () => {
    for (const entry of entries.values()) refresh(entry)
  }

  const pauseOurselves = (entry: Entry) => {
    const target = entry.target
    if (target === null || target.paused) return
    entry.ourPauses += 1
    try {
      target.pause()
    } catch {
      entry.ourPauses = Math.max(0, entry.ourPauses - 1)
    }
  }

  const setMutedOurselves = (entry: Entry, muted: boolean) => {
    const target = entry.target
    if (target === null || target.muted === muted) return
    entry.ourVolumeChanges += 1
    try {
      target.muted = muted
    } catch {
      entry.ourVolumeChanges = Math.max(0, entry.ourVolumeChanges - 1)
    }
  }

  /** Lance la lecture ; `retryMuted` : un refus avec le son retente une fois en muet. */
  const start = (entry: Entry, mode: { gesture: boolean; retryMuted: boolean }) => {
    const target = entry.target
    if (target === null) return
    entry.pendingPlay = true
    const fail = (error: unknown) => {
      entry.pendingPlay = false
      if (isInterruptedPlay(error)) {
        refresh(entry)
        return
      }
      if (isAutoplayRejection(error) && !mode.gesture) {
        if (mode.retryMuted && entry.target !== null && !entry.target.muted) {
          // Le son est refusé sans geste du moment : la lecture repart muette,
          // la commande « Son » le dit (son coupé).
          setMutedOurselves(entry, true)
          start(entry, { gesture: false, retryMuted: false })
          return
        }
        // Le navigateur refuse la lecture automatique : « Lire » désormais.
        capability = "blocked"
      }
      refreshAll()
      evaluate()
    }
    let result: unknown
    try {
      result = target.play()
    } catch (error) {
      fail(error)
      return
    }
    if (isPromiseLike(result)) {
      result.then(() => {
        // L'évènement `play` consomme normalement `pendingPlay` ; sans lui,
        // on le lève ici.
        if (entry.pendingPlay) {
          entry.pendingPlay = false
          refresh(entry)
        }
      }, fail)
    } else {
      // Pas de promesse (ancien navigateur, environnement de test) : l'évènement fera foi.
      refresh(entry)
    }
  }

  /**
   * Applique les règles à tous les médias. Réentrance bloquée : une pause
   * émise ici déclenche un évènement qui rappellerait les mêmes règles.
   */
  const evaluate = () => {
    if (evaluating) return
    evaluating = true
    try {
      // 1. Ce qui joue (ou va jouer) : suspendre ce qui doit l'être.
      let busy = false
      for (const entry of entries.values()) {
        const target = entry.target
        if (target === null) continue
        if (entry.pendingPlay) busy = true
        if (target.paused) continue
        const reason = suspensionFor({ role: entry.role, environment, visibleRatio: entry.visibleRatio, threshold })
        if (reason !== null) {
          entry.suspendedBy = reason
          pauseOurselves(entry)
        } else {
          busy = true
        }
        refresh(entry)
      }
      // 2. Ce qui est à l'arrêt : lever les suspensions dont la cause a cessé,
      // et au plus UNE lecture automatique — seulement si rien d'autre ne joue.
      for (const entry of entries.values()) {
        const target = entry.target
        if (target === null || !target.paused) continue
        if (entry.suspendedBy === "call" && !environment.callInProgress) entry.suspendedBy = null
        else if (entry.suspendedBy === "hidden" && !environment.documentHidden) entry.suspendedBy = null
        else if (
          entry.suspendedBy === "offscreen" &&
          entry.role !== "neighbor" &&
          entry.role !== "distant" &&
          isSufficientlyVisible(entry.visibleRatio, threshold)
        ) {
          entry.suspendedBy = null
        }
        if (!busy && !entry.pendingPlay && decisionFor(entry) === "play") {
          busy = true
          setMutedOurselves(entry, !soundOn)
          start(entry, { gesture: false, retryMuted: soundOn })
        }
        refresh(entry)
      }
    } finally {
      evaluating = false
    }
  }

  const leaveActiveRole = (entry: Entry, next: MediaRole) => {
    if (entry.role === "active" && next !== "active") {
      // Quitter la publication lue lève la pause de la personne et le
      // remplacement : y revenir relance la lecture automatique.
      entry.userPaused = false
      entry.displaced = false
    }
    entry.role = next
  }

  const attach = (entry: Entry, target: PlaybackTarget) => {
    const onPlay = () => {
      const suspension = environmentSuspension(environment)
      if (suspension !== null) {
        // Aucune lecture pendant un appel ou un onglet masqué — et on le dit.
        entry.pendingPlay = false
        entry.suspendedBy = suspension
        pauseOurselves(entry)
        refresh(entry)
        return
      }
      // Lancée par la personne (commandes natives) ou par nous : dans les deux
      // cas, sa pause précédente ne tient plus.
      entry.userPaused = false
      entry.pendingPlay = false
      entry.everPlayed = true
      entry.displaced = false
      entry.suspendedBy = null
      // Au plus UNE vidéo : les autres se taisent, sans être tenues pour
      // « mises en pause par la personne ».
      for (const other of entries.values()) {
        if (other === entry || other.target === null || other.target.paused) continue
        other.displaced = true
        pauseOurselves(other)
        refresh(other)
      }
      refresh(entry)
    }
    const onPause = () => {
      if (entry.ourPauses > 0) entry.ourPauses -= 1
      else {
        // Une pause qui n'est pas la nôtre : la personne (ou la fin du média).
        entry.userPaused = true
        entry.suspendedBy = null
      }
      refresh(entry)
    }
    const onEnded = () => {
      // Aucun passage automatique au post suivant, aucune relance.
      entry.userPaused = true
      refresh(entry)
    }
    const onVolumeChange = () => {
      if (entry.ourVolumeChanges > 0) {
        entry.ourVolumeChanges -= 1
        refresh(entry)
        return
      }
      // Un geste de la personne sur les commandes natives : c'est sa préférence.
      if (entry.role !== "unmanaged") soundOn = !target.muted
      refreshAll()
    }
    target.addEventListener("play", onPlay)
    target.addEventListener("pause", onPause)
    target.addEventListener("ended", onEnded)
    target.addEventListener("volumechange", onVolumeChange)
    return () => {
      target.removeEventListener("play", onPlay)
      target.removeEventListener("pause", onPause)
      target.removeEventListener("ended", onEnded)
      target.removeEventListener("volumechange", onVolumeChange)
    }
  }

  const coordinator: MediaPlaybackCoordinator = {
    threshold,

    register(id, target, role) {
      let entry = entries.get(id)
      if (entry === undefined) {
        entry = {
          id,
          target: null,
          role,
          visibleRatio: null,
          userPaused: false,
          displaced: false,
          everPlayed: false,
          suspendedBy: null,
          pendingPlay: false,
          ourPauses: 0,
          ourVolumeChanges: 0,
          snapshot: IDLE_PLAYBACK_SNAPSHOT,
          detach: null,
        }
        entries.set(id, entry)
      } else {
        leaveActiveRole(entry, role)
      }
      if (entry.target !== target) {
        entry.detach?.()
        entry.target = target
        entry.everPlayed = !target.paused
        entry.pendingPlay = false
        entry.ourPauses = 0
        entry.ourVolumeChanges = 0
        entry.detach = attach(entry, target)
      }
      const registered = entry
      // Dans le lecteur, une vidéo à l'arrêt suit la préférence de son de la
      // session (muette par défaut) : la commande « Son » dit l'état réel.
      if (role !== "unmanaged" && target.paused) setMutedOurselves(registered, !soundOn)
      evaluate()
      refresh(registered)
      return () => {
        const current = entries.get(id)
        if (current === undefined || current.target !== target) return
        pauseOurselves(current)
        current.detach?.()
        current.detach = null
        current.target = null
        current.pendingPlay = false
        refresh(current)
        // Plus de média : l'entrée part, ses abonnés liront l'état de repos.
        entries.delete(id)
        evaluate()
      }
    },

    setRole(id, role) {
      const entry = entries.get(id)
      if (entry === undefined || entry.role === role) return
      const wasUnmanaged = entry.role === "unmanaged"
      leaveActiveRole(entry, role)
      if (wasUnmanaged && role !== "unmanaged" && entry.target !== null && entry.target.paused) setMutedOurselves(entry, !soundOn)
      evaluate()
      refresh(entry)
    },

    setVisibility(id, ratio) {
      const entry = entries.get(id)
      if (entry === undefined) return
      const next = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
      if (entry.visibleRatio === next) return
      entry.visibleRatio = next
      evaluate()
    },

    setEnvironment(patch) {
      const next: PlaybackEnvironment = { ...environment, ...patch }
      if (
        next.documentHidden === environment.documentHidden &&
        next.callInProgress === environment.callInProgress &&
        next.dataSaver === environment.dataSaver
      ) {
        return
      }
      environment = Object.freeze(next)
      for (const listener of environmentListeners) listener()
      evaluate()
    },

    setAutoplayCapability(next) {
      if (capability === next) return
      capability = next
      evaluate()
    },

    requestPlay(id) {
      const entry = entries.get(id)
      if (entry === undefined || entry.target === null) return
      const suspension = environmentSuspension(environment)
      if (suspension !== null) {
        entry.suspendedBy = suspension
        refresh(entry)
        return
      }
      entry.userPaused = false
      entry.displaced = false
      if (entry.role !== "unmanaged") setMutedOurselves(entry, !soundOn)
      start(entry, { gesture: true, retryMuted: false })
      refresh(entry)
    },

    toggleSound(id) {
      const entry = entries.get(id)
      // Ce que la personne ENTEND fait foi : un média coupé s'ouvre, un média
      // sonore se coupe — même si la préférence disait l'inverse (refus du son
      // par le navigateur, retenté muet).
      soundOn = entry !== undefined && entry.target !== null ? entry.target.muted : !soundOn
      if (entry !== undefined) setMutedOurselves(entry, !soundOn)
      refreshAll()
    },

    subscribe(id, listener) {
      const set = listeners.get(id) ?? new Set<() => void>()
      set.add(listener)
      listeners.set(id, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(id)
      }
    },

    getSnapshot(id) {
      return entries.get(id)?.snapshot ?? IDLE_PLAYBACK_SNAPSHOT
    },

    subscribeEnvironment(listener) {
      environmentListeners.add(listener)
      return () => {
        environmentListeners.delete(listener)
      }
    },

    getEnvironment() {
      return environment
    },

    preloadFor(role) {
      return preloadFor(role, environment)
    },

    playingId() {
      for (const entry of entries.values()) if (entry.target !== null && !entry.target.paused) return entry.id
      return null
    },
  }

  return coordinator
}
