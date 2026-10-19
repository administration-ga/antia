/**
 * CC-4 (contrat CONVERSATION-CONTEXTUELLE-V1 §5.8, §10.1 ; ADR-0025, D5 amendé option (a)) — les deux
 * portes d'APPEL d'une conversation contextuelle : l'accord explicite et le démarrage.
 *
 * AUCUN APPEL AUTOMATIQUE : l'ouverture du fil, l'acceptation d'un mentorat, la présélection d'une
 * candidature et l'accord lui-même ne font jamais sonner. Un appel est un tête-à-tête entre la
 * personne du côté demandeur et une personne vivante du côté répondant, chacune ayant donné son accord
 * DANS CE FIL, dans une phase « engagée ». Puis la porte partagée `calls/direct.placeDirectCall`
 * applique TOUTES ses gardes (blocage, personne joignable, admission, budget `call.place`) ; D5 (a) :
 * l'accord donné dans ce fil lève le seul réglage « hors de mes relations : silencieux » de l'appelé,
 * pour ce seul fil. Ni messagerie vocale ni appel de groupe (sélecteur `calls/conversation.ts`) ;
 * jeton de salle de 60 secondes, relu à chaque émission. Ces portes ne modifient pas l'appel
 * personnel (`calls.direct.callMember`), qui ne tire aucun droit d'une conversation contextuelle.
 */
import { contextualCallAllowed } from "@antsia/social-domain/contextualMessaging"
import { v } from "convex/values"

import { fail, failRule, notFound } from "../../lib/errors"
import { networkMutation } from "../../lib/functions"
import { type DirectCallResult, directCallResultValidator, placeDirectCall } from "../calls/direct"
import { callMediaTypeValidator } from "../calls/validators"
import { contextualThreadAccess } from "./access"
import {
  callPhaseRefusal,
  canActivateCallConsent,
  currentCallAuthorityKey,
  effectiveCallConsent,
  liveContextualCalls,
  resolveContextualCallTarget,
  revalidateContextualThreadCalls,
} from "./callAccess"
import { setPersonCallConsent } from "./personStates"

/**
 * Poser ou retirer SON accord d'appel dans ce fil (§10.1). Retirer est toujours possible (statut
 * `en_attente`, fil fermé compris) et arrête l'appel vivant dont la paire n'est plus admise. Activer
 * exige une conversation ouverte, une phase engagée et le statut d'écriture (au moins `declaree`, et
 * celui que la tranche exige pour son côté). En voix de page, le signataire qui consent accepte d'être
 * NOMMÉ dans l'appel (l'écran le lui dit) ; l'accord est lié à sa ligne de signataire et à sa date
 * d'acceptation. Un tiers reçoit le refus indistinct.
 */
export const setCallConsent = networkMutation({
  minStatus: "en_attente",
  writeBucket: "contextual.manage",
  args: { threadId: v.id("contextualThreads"), allowed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = ctx.person._id
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: me, threadId: args.threadId })
    if (access === null) return notFound()
    const now = Date.now()
    if (!args.allowed) {
      await setPersonCallConsent(ctx, access.thread, me, { allowed: false }, now)
      // La paire de l'appel vivant n'est plus admise : il s'arrête, sa salle est fermée.
      await revalidateContextualThreadCalls(ctx, access.thread._id)
      return null
    }
    if (!canActivateCallConsent(access)) {
      const refusal = callPhaseRefusal(access)
      return refusal !== null ? failRule(refusal) : fail("statusInsufficient")
    }
    const authorityKey = await currentCallAuthorityKey(ctx, access, me)
    if (authorityKey === null) return notFound()
    await setPersonCallConsent(ctx, access.thread, me, { allowed: true, authorityKey }, now)
    return null
  },
})

/**
 * Démarrer un appel dans ce fil (§10.1, §5.8). Le répondant appelle le demandeur ; le mentoré son
 * mentor ; face à une page, le demandeur choisit `targetPersonId` parmi les seuls signataires
 * consentants (`callTargets` de la projection ; un seul : choisi d'office). Un signataire n'appelle
 * qu'en son propre nom. Au plus un appel vivant par fil. Le résultat est celui de l'appel direct :
 * admis, ou refusé par l'admission de l'appelé (« ne pas déranger », réunion, occupé, hors ligne),
 * jamais avec une messagerie vocale.
 */
export const start = networkMutation({
  writeBucket: "contextual.manage",
  args: { threadId: v.id("contextualThreads"), targetPersonId: v.optional(v.id("persons")), mediaType: callMediaTypeValidator },
  returns: directCallResultValidator,
  handler: async (ctx, args): Promise<DirectCallResult> => {
    const me = ctx.person._id
    const access = await contextualThreadAccess(ctx, { networkId: ctx.networkId, personId: me, threadId: args.threadId })
    if (access === null) return notFound()
    const ownConsent = await effectiveCallConsent(ctx, access, me)
    const refusal = contextualCallAllowed({ viewState: access.capabilities.viewState, callsEngaged: access.snapshot.callsEngaged, ownConsent, targetConsent: true })
    if (refusal !== null) return failRule(refusal === "CONTEXT_CLOSED" ? (callPhaseRefusal(access) ?? refusal) : refusal)
    if (!access.writeStatusSatisfied) return fail("statusInsufficient")
    const target = await resolveContextualCallTarget(ctx, access, me, args.targetPersonId)
    if (target.kind === "unknown") return notFound()
    if (target.kind === "consent_required") return failRule("CONTEXT_CALL_CONSENT_REQUIRED")
    if (target.kind === "ambiguous") return fail("invalidArgument", { field: "targetPersonId" })
    // Au plus un appel vivant par fil (comme P10) : rien ne sonne en double.
    if ((await liveContextualCalls(ctx, access.thread._id)).length > 0) return notFound()
    return await placeDirectCall(ctx, { target: { personId: target.personId }, mediaType: args.mediaType, contextualThreadId: access.thread._id })
  },
})
