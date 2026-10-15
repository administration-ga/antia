// Dupliqué de socle/convex/modules/direct/replayComposition.test.ts @ ad2e7fdc2 — adaptations : aucune ; les vingt-sept cas portés tels quels, à côté du module déplacé dans le domaine.
/**
 * Les décisions de composition et d'état d'une rediffusion — module PUR, donc
 * testé en `node`, sans harnais Convex.
 *
 * Chaque `it` garde un défaut CONSTATÉ (audit D-12, 2026-09-06) :
 *  · la composition n'était jamais transmise à LiveKit ;
 *  · seul `egress_ended` écrivait un état, donc « demandé », « en cours » et
 *    « en traitement » n'existaient pas ;
 *  · `ABORTED` et `LIMIT_REACHED` tombaient dans « fichier absent » ;
 *  · un `egress_ended` reçu AVANT `attachEgress` laissait `pending` à vie.
 */
import { describe, expect, it } from "vitest"
import {
  DIRECT_EGRESS_COLOR_DEPTH,
  DIRECT_EGRESS_START_BASE_DELAY_MS,
  DIRECT_EGRESS_START_MAX_ATTEMPTS,
  DIRECT_EGRESS_START_MAX_DELAY_MS,
  directEgressEndedBeforeStartReason,
  directEgressStartGiveUpReason,
  directEgressStartVerdict,
  nextDirectEgressStartFailure,
  type DirectEgressStartFailure,
  DIRECT_EGRESS_FRAMERATE,
  DIRECT_EGRESS_LAYOUT,
  DIRECT_REPLAY_CAPTIONS_MAX_BYTES,
  DIRECT_REPLAY_PENDING_GIVE_UP_MS,
  DIRECT_REPLAY_RECONCILE_AFTER_MS,
  directEgressComposition,
  directEgressCompositeOptions,
  directEgressFailureReason,
  directEgressOutcomeFromStatus,
  directEgressStatusName,
  directReplayCaptionsLangLabel,
  directReplayCaptionsRefusalLabel,
  directReplayEgressView,
  directReplayReconcileVerdict,
  isDirectReplayCaptionsMime,
  normalizeDirectReplayCaptionsLang,
  normalizeDirectStageFormat,
} from "./replayComposition"

describe("composition — le format de la scène ARRIVE jusqu'au fichier", () => {
  it("rend les trois ratios attendus, et jamais un 16:9 par défaut", () => {
    const television = directEgressCompositeOptions("television").encodingOptions
    expect([television.width, television.height]).toEqual([1920, 1080])
    expect(television.width / television.height).toBeCloseTo(16 / 9, 5)

    const computer = directEgressCompositeOptions("computer").encodingOptions
    expect([computer.width, computer.height]).toEqual([1440, 1080])
    expect(computer.width / computer.height).toBeCloseTo(4 / 3, 5)

    const mobile = directEgressCompositeOptions("mobile").encodingOptions
    expect([mobile.width, mobile.height]).toEqual([1080, 1920])
    expect(mobile.width / mobile.height).toBeCloseTo(9 / 16, 5)
    // LE défaut de l'audit : « mobile » produisait un fichier panoramique.
    expect(mobile.height).toBeGreaterThan(mobile.width)
  })

  it("un format inconnu ou absent retombe sur `computer`, jamais sur rien", () => {
    expect(normalizeDirectStageFormat(undefined)).toBe("computer")
    expect(normalizeDirectStageFormat("cinema")).toBe("computer")
    expect(directEgressCompositeOptions(null).encodingOptions).toEqual(
      directEgressCompositeOptions("computer").encodingOptions,
    )
  })

  it("le gabarit est `grid` partout — le partage d'écran est une TUILE", () => {
    // Arbitrage documenté en tête du module : le layout se fixe à `goLive`,
    // avant que quiconque ait pu partager ; `speaker` enregistrerait un seul
    // visage figé sur une conférence sans partage, qui est le cas nominal.
    for (const format of ["television", "computer", "mobile"] as const) {
      expect(directEgressCompositeOptions(format).layout).toBe(
        DIRECT_EGRESS_LAYOUT,
      )
      expect(directEgressCompositeOptions(format).layout).toBe("grid")
    }
  })

  it("chaque option d'encodage est EXPLICITE — aucun zéro laissé au service", () => {
    for (const format of ["television", "computer", "mobile"] as const) {
      const { encodingOptions } = directEgressCompositeOptions(format)
      expect(encodingOptions.framerate).toBe(DIRECT_EGRESS_FRAMERATE)
      expect(encodingOptions.depth).toBe(DIRECT_EGRESS_COLOR_DEPTH)
      expect(encodingOptions.videoBitrate).toBeGreaterThan(0)
      for (const value of Object.values(encodingOptions)) {
        expect(value).toBeGreaterThan(0)
      }
    }
  })

  it("ce qu'on PERSISTE est la même décision, réduite au comparable", () => {
    expect(directEgressComposition("mobile")).toEqual({
      layout: "grid",
      width: 1080,
      height: 1920,
    })
  })
})

describe("état observable — cinq nuances là où `pending` ne disait rien", () => {
  it("distingue demandé, en cours et en traitement pendant le live", () => {
    expect(directReplayEgressView({ replayStatus: "pending" })).toBe("requested")
    expect(
      directReplayEgressView({
        replayStatus: "pending",
        replayEgressState: "requested",
      }),
    ).toBe("requested")
    expect(
      directReplayEgressView({
        replayStatus: "pending",
        replayEgressState: "active",
      }),
    ).toBe("active")
    expect(
      directReplayEgressView({
        replayStatus: "pending",
        replayEgressState: "stopping",
      }),
    ).toBe("processing")
    expect(
      directReplayEgressView({
        replayStatus: "pending",
        replayEgressState: "stopped",
      }),
    ).toBe("processing")
  })

  it("le statut DURABLE prime toujours sur l'état de capture", () => {
    // Un `stopped` qui traîne ne doit pas faire dire « en traitement » à un
    // replay déjà lisible, ni à un replay purgé.
    expect(
      directReplayEgressView({
        replayStatus: "ready",
        replayEgressState: "stopped",
      }),
    ).toBe("ready")
    expect(
      directReplayEgressView({
        replayStatus: "failed",
        replayEgressState: "active",
      }),
    ).toBe("failed")
    expect(
      directReplayEgressView({
        replayStatus: "expired",
        replayEgressState: "stopped",
      }),
    ).toBe("expired")
  })
})

describe("statuts LiveKit — les deux formes, et les trois échecs", () => {
  it("accepte le NOM (webhook JSON) comme l'entier (listEgress protobuf)", () => {
    expect(directEgressStatusName("EGRESS_COMPLETE")).toBe("EGRESS_COMPLETE")
    expect(directEgressStatusName(3)).toBe("EGRESS_COMPLETE")
    expect(directEgressStatusName(1)).toBe("EGRESS_ACTIVE")
    expect(directEgressStatusName(undefined)).toBeUndefined()
    expect(directEgressStatusName("")).toBeUndefined()
  })

  it("ABORTED et LIMIT_REACHED sont des ÉCHECS NOMMÉS, pas un fichier absent", () => {
    expect(directEgressFailureReason("EGRESS_FAILED")).toBe(
      "LiveKit egress failed",
    )
    expect(directEgressFailureReason("EGRESS_ABORTED")).toBe(
      "LiveKit egress aborted",
    )
    expect(directEgressFailureReason(6)).toBe("LiveKit egress limit reached")
    expect(directEgressFailureReason("EGRESS_COMPLETE")).toBeUndefined()
    expect(directEgressFailureReason(undefined)).toBeUndefined()
  })

  it("un statut intermédiaire ou inconnu n'écrit RIEN", () => {
    expect(directEgressOutcomeFromStatus("EGRESS_STARTING")).toEqual({
      kind: "wait",
    })
    expect(directEgressOutcomeFromStatus("EGRESS_ENDING")).toEqual({
      kind: "wait",
    })
    expect(directEgressOutcomeFromStatus(undefined)).toEqual({ kind: "wait" })
    expect(directEgressOutcomeFromStatus("EGRESS_DEMAIN")).toEqual({
      kind: "wait",
    })
    expect(directEgressOutcomeFromStatus(3)).toEqual({ kind: "complete" })
    expect(directEgressOutcomeFromStatus(1)).toEqual({ kind: "active" })
    expect(directEgressOutcomeFromStatus(5)).toEqual({
      kind: "failed",
      reason: "LiveKit egress aborted",
    })
  })
})

describe("réconciliation — retard, inversion, abandon", () => {
  const now = 10_000_000_000

  it("laisse un Egress récent finir d'écrire son fichier", () => {
    expect(
      directReplayReconcileVerdict({
        endedAt: now - (DIRECT_REPLAY_RECONCILE_AFTER_MS - 1_000),
        now,
        egressId: "EG_1",
      }),
    ).toBe("wait")
  })

  it("interroge LiveKit passé le délai, quand une corrélation existe", () => {
    expect(
      directReplayReconcileVerdict({
        endedAt: now - DIRECT_REPLAY_RECONCILE_AFTER_MS,
        now,
        egressId: "EG_1",
      }),
    ).toBe("reconcile")
  })

  it("ABANDONNE sans corrélation : `completeEgress` ne pourra plus rien rattacher", () => {
    // C'est l'INVERSION : `egress_ended` arrivé avant `attachEgress` est
    // absorbé (résolution par `by_egressId`), et rien ne le rejouera.
    expect(
      directReplayReconcileVerdict({
        endedAt: now - DIRECT_REPLAY_RECONCILE_AFTER_MS,
        now,
      }),
    ).toBe("give_up")
  })

  it("abandonne aussi au bout de 24 h, corrélation ou non", () => {
    expect(
      directReplayReconcileVerdict({
        endedAt: now - DIRECT_REPLAY_PENDING_GIVE_UP_MS,
        now,
        egressId: "EG_1",
      }),
    ).toBe("give_up")
  })
})

describe("démarrage de l'Egress — la salle n'existe pas encore, LiveKit dort (ADR-0158)", () => {
  it("la première tentative en échec RÉESSAIE, avec un délai qui grandit puis plafonne", () => {
    // LE défaut : « fetch failed » à la première tentative, et aucune seconde.
    const first = directEgressStartVerdict(0)
    expect(first).toEqual({
      kind: "retry",
      attempt: 1,
      delayMs: DIRECT_EGRESS_START_BASE_DELAY_MS + 1_000,
    })
    const later = directEgressStartVerdict(8)
    expect(later.kind).toBe("retry")
    if (later.kind === "retry") {
      expect(later.delayMs).toBe(DIRECT_EGRESS_START_MAX_DELAY_MS)
      expect(later.attempt).toBe(9)
    }
  })

  it("renonce à la borne — une capture qu'on attend pour toujours est pire qu'un échec dit", () => {
    expect(directEgressStartVerdict(DIRECT_EGRESS_START_MAX_ATTEMPTS - 1)).toEqual({
      kind: "give_up",
    })
    expect(directEgressStartVerdict(DIRECT_EGRESS_START_MAX_ATTEMPTS + 5)).toEqual({
      kind: "give_up",
    })
    // Et la borne tient dans les deux minutes : au-delà, l'hôte a fermé.
    let total = 0
    for (let attempt = 0; ; attempt++) {
      const verdict = directEgressStartVerdict(attempt)
      if (verdict.kind === "give_up") break
      total += verdict.delayMs
    }
    expect(total).toBeLessThanOrEqual(2 * 60_000)
    expect(total).toBeGreaterThanOrEqual(60_000)
  })

  it("le motif d'abandon dit CE QU'ON A ATTENDU — la salle, ou le serveur", () => {
    expect(directEgressStartGiveUpReason({ roomSeen: false })).toContain(
      "la salle n'a jamais été ouverte",
    )
    expect(
      directEgressStartGiveUpReason({ roomSeen: true, lastError: "fetch failed" }),
    ).toBe("Egress refusé au démarrage : fetch failed")
    expect(directEgressStartGiveUpReason({ roomSeen: true })).toBe(
      "Egress refusé au démarrage.",
    )
    // Un message de 2 000 caractères ne finit pas à l'écran de l'hôte.
    expect(
      directEgressStartGiveUpReason({ roomSeen: true, lastError: "x".repeat(2_000) })
        .length,
    ).toBeLessThan(260)
  })
})

describe("la cause RÉELLE voyage d'une tentative à la suivante (correctif du 2026-09-17)", () => {
  // Ce que LiveKit répond, au bout de 22-25 s, quand aucun worker Egress n'est
  // branché sur la VM — la panne réelle du 17/09.
  const NO_WORKER = "twirp error unknown: no response from servers"
  const refusEnregistrement: DirectEgressStartFailure = { stage: "egress", detail: NO_WORKER }

  it("après douze refus du service d'enregistrement, la conférence terminée DIT la vraie cause", () => {
    let carried: DirectEgressStartFailure | undefined
    for (let attempt = 0; attempt < DIRECT_EGRESS_START_MAX_ATTEMPTS; attempt += 1) {
      carried = nextDirectEgressStartFailure({
        previous: carried,
        attempt: refusEnregistrement,
        serverAnswered: true,
      })
    }
    // LE défaut : « terminée avant que l'enregistrement démarre » accusait
    // l'hôte d'une panne d'infrastructure.
    expect(directEgressEndedBeforeStartReason(carried)).toBe(
      `Le service d'enregistrement n'a pas répondu : ${NO_WORKER}`,
    )
  })

  it("sans AUCUN échec côté LiveKit, « terminée avant que l'enregistrement démarre » reste la phrase juste", () => {
    let carried: DirectEgressStartFailure | undefined
    for (let attempt = 0; attempt < 4; attempt += 1) {
      // Salle pas encore ouverte : le serveur répond, rien n'échoue.
      carried = nextDirectEgressStartFailure({ previous: carried, serverAnswered: true })
    }
    expect(carried).toBeUndefined()
    expect(directEgressEndedBeforeStartReason(carried)).toBe(
      "La conférence s'est terminée avant que l'enregistrement démarre.",
    )
  })

  it("une salle qui se REFERME après un refus ne fait pas oublier le refus", () => {
    const afterRefusal = nextDirectEgressStartFailure({
      attempt: refusEnregistrement,
      serverAnswered: true,
    })
    // L'hôte est parti : `listRooms` répond, la salle n'existe plus.
    const afterRoomClosed = nextDirectEgressStartFailure({
      previous: afterRefusal,
      serverAnswered: true,
    })
    expect(afterRoomClosed).toEqual(refusEnregistrement)
  })

  it("un serveur qui répond de nouveau efface un échec SERVEUR, jamais un refus d'enregistrement", () => {
    const reveilRefuse: DirectEgressStartFailure = {
      stage: "server",
      detail: "LIVEKIT_UNAVAILABLE",
    }
    expect(
      nextDirectEgressStartFailure({ previous: reveilRefuse, serverAnswered: true }),
    ).toBeUndefined()
    expect(
      nextDirectEgressStartFailure({ previous: reveilRefuse, serverAnswered: false }),
    ).toEqual(reveilRefuse)
    expect(
      nextDirectEgressStartFailure({ previous: refusEnregistrement, serverAnswered: true }),
    ).toEqual(refusEnregistrement)
    // Le plus récent l'emporte : c'est lui qui dit l'état au moment de la fin.
    expect(
      nextDirectEgressStartFailure({
        previous: refusEnregistrement,
        attempt: reveilRefuse,
        serverAnswered: false,
      }),
    ).toEqual(reveilRefuse)
  })

  it("le motif nomme l'ÉTAGE en panne et borne son détail technique", () => {
    expect(
      directEgressEndedBeforeStartReason({ stage: "server", detail: "fetch failed" }),
    ).toBe("Le serveur vidéo n'a pas répondu : fetch failed")
    expect(directEgressEndedBeforeStartReason({ stage: "egress", detail: "  " })).toBe(
      "Le service d'enregistrement n'a pas répondu.",
    )
    expect(
      directEgressEndedBeforeStartReason({ stage: "egress", detail: "x".repeat(2_000) })
        .length,
    ).toBeLessThan(260)
  })

  it("l'abandon ne dit plus « salle jamais ouverte » quand c'est le SERVEUR qui n'a jamais répondu", () => {
    expect(
      directEgressStartGiveUpReason({
        roomSeen: false,
        lastError: "LIVEKIT_NO_CAPACITY",
        lastFailureStage: "server",
      }),
    ).toBe("Le serveur vidéo n'a pas répondu : LIVEKIT_NO_CAPACITY")
    // Sans cause serveur, la phrase historique tient toujours.
    expect(directEgressStartGiveUpReason({ roomSeen: false })).toContain(
      "la salle n'a jamais été ouverte",
    )
    expect(
      directEgressStartGiveUpReason({
        roomSeen: true,
        lastError: NO_WORKER,
        lastFailureStage: "egress",
      }),
    ).toBe(`Egress refusé au démarrage : ${NO_WORKER}`)
  })
})

describe("sous-titres — ce qu'on accepte d'attacher", () => {
  it("laisse passer les formes réelles d'un .vtt, écarte l'erreur grossière", () => {
    // ⚠️ Le type d'un `.vtt` varie selon le système : `text/vtt`, `text/plain`,
    // `application/octet-stream`, ou rien du tout. Ce filtre n'est PAS la
    // barrière — l'en-tête `WEBVTT` l'est, lu dans l'action ; celui-ci écarte
    // l'évidence pour ne pas faire téléverser une vidéo entière pour rien.
    expect(isDirectReplayCaptionsMime("text/vtt")).toBe(true)
    expect(isDirectReplayCaptionsMime("text/vtt; charset=utf-8")).toBe(true)
    expect(isDirectReplayCaptionsMime("TEXT/PLAIN")).toBe(true)
    expect(isDirectReplayCaptionsMime("application/octet-stream")).toBe(true)
    expect(isDirectReplayCaptionsMime(undefined)).toBe(true)
    expect(isDirectReplayCaptionsMime("")).toBe(true)
    expect(isDirectReplayCaptionsMime("video/mp4")).toBe(false)
    expect(isDirectReplayCaptionsMime("image/png")).toBe(false)
  })

  it("la langue est un vocabulaire FERMÉ — `srcLang` était en dur", () => {
    expect(normalizeDirectReplayCaptionsLang("en")).toBe("en")
    expect(normalizeDirectReplayCaptionsLang("kl")).toBe("fr")
    expect(normalizeDirectReplayCaptionsLang(undefined)).toBe("fr")
    expect(directReplayCaptionsLangLabel("en")).toBe("Anglais")
    expect(directReplayCaptionsLangLabel("zz")).toBe("Français")
  })

  it("chaque refus a SA phrase, et le succès n'en a aucune", () => {
    expect(directReplayCaptionsRefusalLabel("ok")).toBeNull()
    expect(directReplayCaptionsRefusalLabel("too_large")).toContain("2")
    expect(directReplayCaptionsRefusalLabel("wrong_type")).toContain("WebVTT")
    expect(directReplayCaptionsRefusalLabel("missing")).toBeTruthy()
  })

  it("le plafond est de 2 Mo, exprimé en octets", () => {
    expect(DIRECT_REPLAY_CAPTIONS_MAX_BYTES).toBe(2 * 1024 * 1024)
  })
})
