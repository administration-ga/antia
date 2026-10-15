// Dupliqué de socle/convex/modules/messagerieScope/forwardedFrom.ts @ ad2e7fdc2 — adaptations : identifiants renommés (fils personnels du moteur ; les groupes s'y ajoutent au lot 11).
/**
 * La PROVENANCE d'un message transféré, RELUE à la lecture.
 *
 * Le transfert COPIE le contenu : la copie survit à l'original, c'est son
 * principe. Le LIEN vers l'original, lui, ne survit pas à son retrait — sinon la
 * provenance deviendrait le seul endroit où un message supprimé est encore
 * désigné. Tant que l'original existe et n'est pas retiré, la copie se marque
 * « Transféré » ; sinon la marque disparaît, sans rien réécrire.
 */
import type { Infer } from "convex/values"

import type { QueryCtx } from "../../_generated/server"
import type { forwardedFromValidator } from "./tables"

export type ForwardedFrom = Infer<typeof forwardedFromValidator>

/** L'original est-il encore servi ? Son contenu n'est jamais lu ici : seul son sort compte. */
export async function isForwardedOriginAlive(ctx: Pick<QueryCtx, "db">, forwardedFrom: ForwardedFrom | undefined): Promise<boolean> {
  if (forwardedFrom === undefined) return false
  const origin = await ctx.db.get(forwardedFrom.messageId)
  return origin !== null && origin.deletedAt === undefined
}
