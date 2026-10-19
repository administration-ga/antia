// P04 (18/10/2026) : la mémoire de retour de l'onglet — titulaire actif seulement, bornée, sans adresse, purgée au changement de personne.
import { beforeEach, describe, expect, it } from "vitest"

import {
  __resetFeedReturnForTests,
  activateFeedReturnSession,
  clearFeedReturnSession,
  FEED_RETURN_MAX_DEPTH,
  FEED_RETURN_MAX_ENTRIES,
  FEED_RETURN_TTL_MS,
  feedReturnOwner,
  feedReturnScope,
  readFeedReturn,
  writeFeedReturn,
} from "./feed-return-memory"

const ownerA = feedReturnOwner("networks_antsia", "persons_a")
const ownerB = feedReturnOwner("networks_antsia", "persons_b")
const scopeA = feedReturnScope(ownerA, "fil:pour_vous")
const entry = { anchorPostId: "posts_12", offset: 140, offsetKind: "slot" as const, galleryIndex: 2, depth: 3 }

beforeEach(() => __resetFeedReturnForTests())

describe("feed-return-memory", () => {
  it("refuse lecture et écriture hors d'une session active (application sans fil immersif)", () => {
    writeFeedReturn(scopeA, entry, 1_000)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
  })

  it("rend la position retenue de la personne courante", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, entry, 1_000)
    expect(readFeedReturn(scopeA, 2_000)).toEqual({ ...entry, savedAt: 1_000 })
  })

  it("une session remplacée ne lit jamais la position de la précédente", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, entry, 1_000)
    activateFeedReturnSession(ownerB)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
    // Revenir à A ne ressuscite rien : la purge a eu lieu.
    activateFeedReturnSession(ownerA)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
  })

  it("la sortie de la coque purge ; une ancienne coque ne purge pas la nouvelle personne", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, entry, 1_000)
    clearFeedReturnSession(ownerB)
    expect(readFeedReturn(scopeA, 1_000)).not.toBeNull()
    clearFeedReturnSession(ownerA)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
  })

  it("expire au-delà de sa durée de vie", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, entry, 1_000)
    expect(readFeedReturn(scopeA, 1_000 + FEED_RETURN_TTL_MS)).toBeNull()
  })

  it("borne la profondeur, le décalage, l'index et le nombre de positions", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, { ...entry, depth: 999, offset: Number.NaN, galleryIndex: -4 }, 1_000)
    expect(readFeedReturn(scopeA, 1_000)).toMatchObject({ depth: FEED_RETURN_MAX_DEPTH, offset: 0, galleryIndex: 0 })
    for (let index = 0; index < FEED_RETURN_MAX_ENTRIES + 3; index += 1) {
      writeFeedReturn(feedReturnScope(ownerA, `fil:tag:${index}`), entry, 2_000 + index)
    }
    // La plus ancienne est partie la première.
    expect(readFeedReturn(scopeA, 3_000)).toBeNull()
    expect(readFeedReturn(feedReturnScope(ownerA, `fil:tag:${FEED_RETURN_MAX_ENTRIES + 2}`), 3_000)).not.toBeNull()
  })

  it("refuse un identifiant de publication vide ou démesuré ; la portée ne porte aucune adresse", () => {
    activateFeedReturnSession(ownerA)
    writeFeedReturn(scopeA, { ...entry, anchorPostId: "" }, 1_000)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
    writeFeedReturn(scopeA, { ...entry, anchorPostId: "p".repeat(200) }, 1_000)
    expect(readFeedReturn(scopeA, 1_000)).toBeNull()
    expect(scopeA).not.toMatch(/https?:|\/fil|\?/)
  })
})
