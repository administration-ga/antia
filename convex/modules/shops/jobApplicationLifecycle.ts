/**
 * P15 : retrait de candidature selon une politique EXPLICITE, révocation des
 * pièces et effacement. Le retrait est toujours possible pour le candidat :
 * avant tout envoi, il est local et immédiat ; après, un contrôle privé demande
 * à PRO.GA de classer la candidature (si elle est encore ouverte) et de
 * supprimer ses copies de pièces. Une décision déjà prise chez PRO.GA n'est pas
 * réécrite ; les copies et la motivation sont retirées dans tous les cas.
 */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import { internalMutation, type MutationCtx } from "../../_generated/server"
import { purgeStoredFile } from "../files/purge"

export const IDLE_AT = Number.MAX_SAFE_INTEGER
export const JOB_APPLICATION_PERSON_PAGE = 50

export const deliverJobApplicationRef = makeFunctionReference<"action", { applicationId: Id<"commerceApplications"> }, null>("modules/shops/jobApplicationTransport:deliver")
export const continueJobRevocationRef = makeFunctionReference<"mutation", { personId: Id<"persons"> }, null>("modules/shops/jobApplicationLifecycle:continueJobRevocation")

type Application = Doc<"commerceApplications">

/** Aucune copie n'a quitté ANTSIA (jamais envoyée, ou refusée par PRO.GA) : retrait local. */
function withdrawnLocally(row: Application): boolean {
  return row.state === "rejected" || row.dispatchedAt === undefined
}

/**
 * Retire une candidature : motivation, nom civil et octets privés effacés
 * localement tout de suite ; le retrait distant est un état durable distinct.
 * L'incrément de génération invalide toute réponse tardive d'un envoi en cours.
 */
export async function withdrawJobApplication(ctx: MutationCtx, row: Application, reason: "candidate_request" | "erasure"): Promise<Application["state"]> {
  if (row.revokedAt !== undefined || row.state === "withdrawn") return row.state
  const now = Date.now()
  const local = withdrawnLocally(row)
  await ctx.db.patch(row._id, {
    state: local ? "withdrawn" : "withdrawal_pending", revokedAt: now, revokeReason: reason,
    rawBody: undefined, civilName: undefined, motivation: undefined,
    controlBody: undefined, controlExpiresAt: undefined, controlAttachmentRef: undefined,
    files: local ? row.files.map((file) => ({ ...file, transfer: "revoked" as const })) : row.files,
    attempts: 0, nextAttemptAt: local ? IDLE_AT : now, leaseUntil: undefined, generation: row.generation + 1, updatedAt: now,
  })
  if (!local) await ctx.scheduler.runAfter(0, deliverJobApplicationRef, { applicationId: row._id })
  return local ? "withdrawn" : "withdrawal_pending"
}

/**
 * Une pièce retirée par le candidat : jamais envoyée → abandonnée ; déjà copiée
 * chez PRO.GA → révocation privée. La candidature elle-même demeure.
 */
export async function retireFileFromApplications(ctx: MutationCtx, personId: Id<"persons">, fileId: Id<"commerceApplicationFiles">): Promise<boolean> {
  const rows = await ctx.db.query("commerceApplications").withIndex("by_person", (q) => q.eq("personId", personId)).take(JOB_APPLICATION_PERSON_PAGE + 1)
  if (rows.length > JOB_APPLICATION_PERSON_PAGE) return false
  const now = Date.now()
  for (const row of rows) {
    if (row.revokedAt !== undefined || row.state === "withdrawn" || row.state === "rejected" || !row.files.some((file) => file.fileId === fileId)) continue
    const files = row.files.map((file) => file.fileId !== fileId ? file
      : { ...file, transfer: file.transfer === "stored" || (row.dispatchedAt !== undefined && file.transfer !== "revoked") ? "revoke_pending" as const : "revoked" as const, attempts: 0 })
    const pending = files.some((file) => file.transfer === "revoke_pending")
    await ctx.db.patch(row._id, { files, ...(pending && row.state === "submitted" ? { nextAttemptAt: now } : {}), updatedAt: now })
    if (pending && row.state === "submitted") await ctx.scheduler.runAfter(0, deliverJobApplicationRef, { applicationId: row._id })
  }
  return true
}

/** Retrait d'une pièce par le candidat : blob et ligne d'analyse purgés, plus aucune transmission. */
export async function retireApplicationFile(ctx: MutationCtx, file: Doc<"commerceApplicationFiles">): Promise<boolean> {
  if (file.state === "retired") return true
  if (!await retireFileFromApplications(ctx, file.personId, file._id)) return false
  await ctx.db.patch(file._id, { state: "retired", retiredAt: Date.now() })
  await purgeStoredFile(ctx, file.storageId)
  return true
}

/**
 * Avant l'effacement générique : chaque candidature est retirée. Le travail est
 * terminé quand aucune n'attend plus de retrait distant ; un retrait distant
 * épuisé (tentatives bornées) laisse une trace `remoteUnconfirmed` et ne bloque
 * pas indéfiniment le droit à l'effacement.
 */
export async function revokeJobApplicationsForPerson(ctx: MutationCtx, personId: Id<"persons">): Promise<boolean> {
  const rows = await ctx.db.query("commerceApplications").withIndex("by_person", (q) => q.eq("personId", personId)).take(JOB_APPLICATION_PERSON_PAGE + 1)
  let done = rows.length <= JOB_APPLICATION_PERSON_PAGE
  for (const row of rows.slice(0, JOB_APPLICATION_PERSON_PAGE)) {
    const state = row.revokedAt === undefined && row.state !== "withdrawn" ? await withdrawJobApplication(ctx, row, "erasure") : row.state
    if (state === "withdrawal_pending") done = false
  }
  return done
}

export const continueJobRevocation = internalMutation({
  args: { personId: v.id("persons") }, returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId)
    if (person?.deletionRequestedAt === undefined) return null
    if (!await revokeJobApplicationsForPerson(ctx, args.personId)) await ctx.scheduler.runAfter(60_000, continueJobRevocationRef, args)
    return null
  },
})
