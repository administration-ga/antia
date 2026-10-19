// Dupliqué de socle/convex/lib/egressWebhook.test.ts @ ad2e7fdc2 — adaptations : routes réduites au direct — `EGRESS_ROUTES` vaut `["direct"]`, les charges utiles des traitements du socle absents du moteur (pistes iRéunion, enregistrements d'appel) deviennent des chemins de direct ou hors contrat ; le plan ne porte plus qu'UN motif, un CODE (`egress_failed`, `egress_aborted`, `egress_limit_reached`), ni début de capture ni taille (fusion iRéunion) ; les onze cas du socle portés ; cas NEUF : la comparaison à temps constant du secret historique.
/**
 * Le plan d'un `egress_ended` — règles pures du webhook (correctif du
 * 2026-09-17). Les charges utiles suivent la forme RÉELLE d'un `FileInfo`
 * LiveKit : le chemin est dans `filename`, la durée en NANOSECONDES. Les
 * anciens tests encodaient `filepath` et des secondes — la même hypothèse que
 * le code, d'où un vert qui ne prouvait rien (recette R1 du 17/09).
 */
import { describe, expect, it } from "vitest"

import { EGRESS_ROUTES, egressDurationNsToMs, egressEndedNeedsFile, isHandledEgressEvent, planEgressEnded, timingSafeEqual } from "./livekitEgressWebhook"

const LOCATION = "https://storage.googleapis.com/b/directs/s.mp4?X-Goog-Signature=x"

describe("les événements traités", () => {
  it("seuls les trois événements d'egress sont traités — salles et participants sont absorbés", () => {
    expect(isHandledEgressEvent("egress_started")).toBe(true)
    expect(isHandledEgressEvent("egress_updated")).toBe(true)
    expect(isHandledEgressEvent("egress_ended")).toBe(true)
    for (const other of ["room_started", "participant_joined", "track_published", "", undefined, 42]) {
      expect(isHandledEgressEvent(other)).toBe(false)
    }
    expect(EGRESS_ROUTES).toEqual(["direct"])
  })
})

describe("planEgressEnded — la forme réelle d'un FileInfo LiveKit", () => {
  it("durée en nanosecondes ; ni début de capture ni taille (ils ne servaient qu'à iRéunion)", () => {
    const plan = planEgressEnded({
      egressId: "EG_1",
      status: "EGRESS_COMPLETE",
      startedAt: "1789650000123456789",
      fileResults: [{ filename: "directs/s.mp4", location: LOCATION, duration: "12500000000", size: "4096" }],
    })
    expect(plan).toEqual({
      egressId: "EG_1",
      route: "direct",
      filepath: "directs/s.mp4",
      location: LOCATION,
      durationMs: 12_500,
    })
  })

  it("EGRESS_FAILED, ABORTED et LIMIT_REACHED : un motif NOMMÉ, en code", () => {
    expect(planEgressEnded({ egressId: "EG_2", status: "EGRESS_FAILED" })).toMatchObject({
      route: "unknown",
      filepath: "",
      failureReason: "egress_failed",
    })
    expect(planEgressEnded({ egressId: "EG_3", status: "EGRESS_ABORTED" }).failureReason).toBe("egress_aborted")
    expect(planEgressEnded({ egressId: "EG_4", status: "EGRESS_LIMIT_REACHED" }).failureReason).toBe("egress_limit_reached")
    expect(planEgressEnded({ egressId: "EG_5", status: "EGRESS_COMPLETE" }).failureReason).toBeUndefined()
  })

  it("le manifeste réel de la recette R1 (17/09) : route directe, 131 s, à rapatrier", () => {
    const plan = planEgressEnded({
      egressId: "EG_FbSteZsYMSs6",
      status: "EGRESS_COMPLETE",
      startedAt: "1789656389851338907",
      endedAt: "1789656521063439745",
      fileResults: [
        {
          filename: "directs/v58k81qj6w3t8nevgfds5mt38n8ekv5d.mp4",
          startedAt: "1789656389851338907",
          endedAt: "1789656521063439745",
          duration: "131212100838",
          size: "55492512",
          location: LOCATION,
        } as never,
      ],
    })
    expect(plan).toMatchObject({
      route: "direct",
      filepath: "directs/v58k81qj6w3t8nevgfds5mt38n8ekv5d.mp4",
      durationMs: 131_212,
    })
    expect(egressEndedNeedsFile(plan)).toBe(true)
  })

  it("repli : un ancien `filepath` est encore lu, mais `filename` l'emporte", () => {
    expect(
      planEgressEnded({
        egressId: "EG_11",
        fileResults: [{ filepath: "directs/a.mp4", filename: "recordings/b.mp4", location: LOCATION }],
      }),
    ).toMatchObject({ route: "unknown", filepath: "recordings/b.mp4" })
    expect(planEgressEnded({ egressId: "EG_12", fileResults: [{ filepath: "directs/a.mp4", location: LOCATION }] })).toMatchObject({
      route: "direct",
      filepath: "directs/a.mp4",
    })
  })

  it("aucun champ inventé quand LiveKit ne dit rien", () => {
    expect(planEgressEnded({ egressId: "EG_5", fileResults: [{}] })).toEqual({
      egressId: "EG_5",
      route: "unknown",
      filepath: "",
    })
  })
})

describe("egressEndedNeedsFile — rapatrier, ou conclure tout de suite", () => {
  it("rapatrie une branche connue, avec emplacement, sans échec déclaré", () => {
    const plan = planEgressEnded({
      egressId: "EG_6",
      status: "EGRESS_COMPLETE",
      fileResults: [{ filename: "directs/s.mp4", location: LOCATION }],
    })
    expect(egressEndedNeedsFile(plan)).toBe(true)
  })

  it("ne télécharge JAMAIS un fichier déjà promis à la poubelle", () => {
    // Direct interrompu : l'ancien webhook téléchargeait, puis `completeEgress` supprimait.
    expect(
      egressEndedNeedsFile(
        planEgressEnded({
          egressId: "EG_7",
          status: "EGRESS_ABORTED",
          fileResults: [{ filename: "directs/s.mp4", location: LOCATION }],
        }),
      ),
    ).toBe(false)
    // Direct en échec : un fichier accompagné d'un échec n'est pas une rediffusion.
    expect(
      egressEndedNeedsFile(
        planEgressEnded({
          egressId: "EG_8",
          status: "EGRESS_FAILED",
          fileResults: [{ filename: "directs/r.mp4", location: LOCATION }],
        }),
      ),
    ).toBe(false)
  })

  it("sans emplacement, ou sur un chemin hors contrat, rien à rapatrier", () => {
    expect(egressEndedNeedsFile(planEgressEnded({ egressId: "EG_9", fileResults: [{ filename: "directs/s.mp4" }] }))).toBe(false)
    expect(
      egressEndedNeedsFile(
        planEgressEnded({
          egressId: "EG_10",
          fileResults: [{ filename: "autre/x.mp4", location: LOCATION }],
        }),
      ),
    ).toBe(false)
  })
})

describe("egressDurationNsToMs — int64 LiveKit en nanosecondes", () => {
  it("convertit un bigint (SDK), une chaîne (webhook JSON) ou un nombre", () => {
    expect(egressDurationNsToMs(12_000_000_000n)).toBe(12_000)
    expect(egressDurationNsToMs("131212100838")).toBe(131_212)
    expect(egressDurationNsToMs(5e9)).toBe(5_000)
  })

  it("rend undefined pour une valeur absente, nulle, négative ou illisible — jamais une durée inventée", () => {
    for (const value of [undefined, null, "", "abc", 0, -5, Number.NaN, {}]) {
      expect(egressDurationNsToMs(value)).toBeUndefined()
    }
  })
})

describe("timingSafeEqual — le secret historique d'un relais", () => {
  it("égal seulement à l'identique ; une longueur différente ou un caractère près, non", () => {
    expect(timingSafeEqual("secret-du-relais", "secret-du-relais")).toBe(true)
    expect(timingSafeEqual("secret-du-relais", "secret-du-relaiS")).toBe(false)
    expect(timingSafeEqual("secret-du-relais", "secret-du-relais ")).toBe(false)
    expect(timingSafeEqual("", "")).toBe(true)
  })
})
