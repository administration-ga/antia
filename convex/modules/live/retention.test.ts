// Dupliqué de socle/convex/modules/direct/retention.test.ts @ ad2e7fdc2 — adaptations : le cas PUR (90 jours, rendez-vous borné, fail-closed sans échéance) porté tel quel, en node (il n'exerce pas le harnais) ; les trois cas d'intégration — purge de la vidéo et des sous-titres puis fermeture de la lecture et de la découverte, « ready » historique sans échéance jusqu'à sa migration bornée, borne de 50 lignes par transaction — exercent `sessions` et `replay`, qui n'existent pas encore dans le moteur : posés en `it.todo` sous leur nom du socle, à porter par le lot de la rediffusion (tables `liveSessions`, cron de purge) ; leurs comptes et utilisateurs du socle (`users`, `publishMyProfile`) partent avec eux.
import { describe, expect, it } from "vitest"

import {
  directReplayRetentionUntil,
  isDirectReplayRetained,
  nextDirectReplayRetentionCheck,
  DIRECT_REPLAY_RETENTION_MS,
} from "./retention"

describe("politique de rétention Direct", () => {
  it("matérialise 90 jours mais borne chaque rendez-vous du scheduler", () => {
    expect(directReplayRetentionUntil(1_000)).toBe(
      1_000 + DIRECT_REPLAY_RETENTION_MS,
    )
    const deadline = directReplayRetentionUntil(1_000)
    const firstCheck = nextDirectReplayRetentionCheck(1_000, deadline)
    expect(firstCheck).toBeGreaterThan(1_000)
    expect(firstCheck).toBeLessThan(deadline)
    expect(isDirectReplayRetained({ replayStatus: "ready" })).toBe(false)
    expect(
      isDirectReplayRetained({
        replayStatus: "ready",
        replayStorageId: "blob",
        replayRetentionUntil: deadline,
      }),
    ).toBe(true)
  })

  // À porter avec `replay` (attachEgress, completeEgress, attachCaptions, expireReplay) et `sessions` (create, goLive, end, get, listReplays).
  it.todo("purge ensemble vidéo et sous-titres, puis ferme lecture et découverte")
  // À porter avec `replay.purgeExpiredReplays` et `sessions.get` / `sessions.listReplays`.
  it.todo("refuse un ready historique sans échéance jusqu'à sa migration bornée")
  // À porter avec `replay.purgeExpiredReplays` (lignes `liveSessions` insérées directement, `DIRECT_REPLAY_PURGE_BATCH + 1`).
  it.todo("ne traite jamais plus de 50 lignes dans une transaction")
})
