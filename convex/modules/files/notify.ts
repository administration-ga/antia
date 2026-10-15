// Dupliqué de socle/convex/modules/fileGuard/notify.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT — destinataires = le déposant et les MODÉRATEURS du réseau du fichier (au lieu du DSI et de sa boîte de poste) ; par la cloche sociale du moteur (`notifyPerson`, genre `file_withheld`, sujet = l'analyse), sans titre ni corps (l'écran traduit, le statut se relit vivant) ; un fichier de profil (sans réseau) est signalé dans la racine ; push reporté avec le push social (PA5).
/**
 * Garde des fichiers — l'AVIS d'un verdict qui retient un fichier.
 *
 * La même règle qu'au socle : rien ici ne doit faire échouer l'analyse qui
 * prévient. Une impossibilité (pas de modérateur, réseau introuvable) est un
 * retour silencieux, jamais une exception.
 */
import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { getRootNetwork } from "../../lib/access"
import { notifyPerson } from "../notifications/notify"

/** Modérateurs prévenus au plus, par rôle : un avis n'est pas une diffusion. */
const MODERATORS_SCAN = 20

export interface VerdictNoticeOutcome {
  uploaderNotified: boolean
  moderatorsNotified: number
}

/** Prévient le déposant et les modérateurs du réseau d'un verdict qui retient le fichier. Ne lève jamais. */
export async function deliverVerdictNotice(ctx: MutationCtx, scan: Doc<"fileScans">): Promise<VerdictNoticeOutcome> {
  const outcome: VerdictNoticeOutcome = { uploaderNotified: false, moderatorsNotified: 0 }
  try {
    const networkId: Id<"networks"> | null = scan.networkId ?? (await getRootNetwork(ctx))?._id ?? null
    if (!networkId) return outcome
    const notice = { networkId, kind: "file_withheld" as const, subject: { fileScan: scan._id } }
    if (scan.uploadedByPersonId) {
      outcome.uploaderNotified = (await notifyPerson(ctx, { ...notice, recipientPersonId: scan.uploadedByPersonId })) !== null
    }
    const seen = new Set<string>(scan.uploadedByPersonId ? [scan.uploadedByPersonId] : [])
    for (const role of ["network_moderator", "network_admin"] as const) {
      const moderators = await ctx.db
        .query("networkMemberships")
        .withIndex("by_network_and_role", (q) => q.eq("networkId", networkId).eq("role", role))
        .take(MODERATORS_SCAN)
      for (const membership of moderators) {
        if (seen.has(membership.personId)) continue
        seen.add(membership.personId)
        if ((await notifyPerson(ctx, { ...notice, recipientPersonId: membership.personId })) !== null) outcome.moderatorsNotified += 1
      }
    }
  } catch (error) {
    console.warn("[files] avis de verdict non délivré", error instanceof Error ? error.message : "inconnu")
  }
  return outcome
}
