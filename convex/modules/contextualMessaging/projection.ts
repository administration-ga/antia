/**
 * CC-2b (contrat CONVERSATION-CONTEXTUELLE-V1 §10.1) — formes PROJETÉES d'une conversation
 * contextuelle, partagées par les fils et les messages. Aucun identifiant de stockage, aucune clé
 * d'idempotence, aucune empreinte, aucune liste de participants : un libellé publié, ou la carte
 * de la page (logo servi par la garde des fichiers). Aucune fonction Convex ici.
 */
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { counterpartOf } from "../messaging/participation"
import { pageCardOf } from "../pages/access"
import type { PageCard } from "../pages/validators"

/** Le libellé d'une personne vue d'une conversation : profil publié, sinon nom choisi, sinon neutre. */
export const contextualLabelValidator = v.object({
  displayName: v.union(v.string(), v.null()),
  handle: v.union(v.string(), v.null()),
  avatarUrl: v.union(v.string(), v.null()),
})

export type ContextualLabel = { displayName: string | null; handle: string | null; avatarUrl: string | null }

type ProjectionCtx = Pick<QueryCtx, "db" | "storage">

/** Libellés d'une lecture, chacun résolu une fois. */
export function contextualLabels(ctx: ProjectionCtx): (personId: Id<"persons">) => Promise<ContextualLabel> {
  const cache = new Map<string, Promise<ContextualLabel>>()
  return async (personId) => {
    const hit = cache.get(personId)
    if (hit) return await hit
    const pending = (async () => {
      const label = await counterpartOf(ctx, personId)
      return { displayName: label.displayName, handle: label.handle, avatarUrl: label.avatarUrl }
    })()
    cache.set(personId, pending)
    return await pending
  }
}

/** La carte d'une page ACTIVE (`null` sinon : une page retirée ne se présente plus). */
export function contextualPageCards(ctx: ProjectionCtx): (page: Doc<"pages"> | null) => Promise<PageCard | null> {
  const cache = new Map<string, Promise<PageCard | null>>()
  return async (page) => {
    if (page === null || page.status !== "active") return null
    const hit = cache.get(page._id)
    if (hit) return await hit
    const pending = pageCardOf(ctx, page)
    cache.set(page._id, pending)
    return await pending
  }
}
