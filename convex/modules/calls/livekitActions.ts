"use node"
// Dupliqué de socle/convex/actions/livekit.ts (l. 120-297, `requestToken`) @ ad2e7fdc2 — adaptations : action BORNÉE par le réseau (`networkAction`) ; autorisation puis réveil, dans cet ordre, par UNE query interne (`calls/token.authorizeToken` — le socle en faisait quatre) ; identité `call` seule, `attributes.personId` (et `metadata` en repli) au lieu de `userId` ; nom affiché par le contrat, jamais un état civil ; grant restreint « citoyen » (V33), « late joiner » d'iRéunion et trace de diagnostic retirés ; refus à code (`notFound` indistinct, `mediaServer*`) au lieu de `throw new Error` ; jeton EAU, PNPE, rendez-vous, supervision, enregistrement d'appel, messagerie vocale par Egress exclus ; `verifyEgressWebhook` et `ingestEgressFile` vont au direct (lot 16).
/**
 * Appels — le JETON de salle, émis pour une personne partie à un appel vivant.
 *
 * L'ordre est la sécurité : AUTORISER d'abord (la query interne prouve la
 * participation), RÉVEILLER ensuite le serveur multimédia (sinon n'importe quel
 * visiteur le rallumerait en boucle), puis émettre. L'identité porte un nonce par
 * connexion (deux onglets ne s'éjectent pas) ; la PERSONNE voyage dans les
 * attributs du participant, que la grille de l'écran lit pour poser chaque
 * vidéo sur sa vignette.
 */
import { randomUUID } from "node:crypto"

import { v } from "convex/values"
import { AccessToken } from "livekit-server-sdk"

import { internal } from "../../_generated/api"
import { fail, notFound } from "../../lib/errors"
import { networkAction } from "../../lib/functions"
import { getLiveKitConfig } from "../../lib/livekit"
import { buildLiveKitIdentity } from "../../lib/livekitIdentity"
import { ensureLiveKitAwake } from "../../lib/livekitWake"
import { CONVERSATION_CALL_TOKEN_TTL, isConversationCall } from "./conversation"
import { callMediaTypeValidator } from "./validators"

/** Durée de vie d'un jeton de salle : un appel plus long en redemande un en se reconnectant. */
const TOKEN_TTL = "2h"

export const requestToken = networkAction({
  writeBucket: "call.token",
  args: { callId: v.id("calls") },
  returns: v.object({ token: v.string(), roomName: v.string(), wsUrl: v.string(), mediaType: callMediaTypeValidator }),
  handler: async (ctx, args): Promise<{ token: string; roomName: string; wsUrl: string; mediaType: "audio" | "video" }> => {
    const grant = await ctx.runQuery(internal.modules.calls.token.authorizeToken, { networkId: ctx.networkId, callId: args.callId })
    if (grant === null) return notFound()

    // Configuration depuis l'environnement du déploiement (source unique, aucune URL en dur).
    const { apiKey, apiSecret, wsUrl } = getLiveKitConfig()
    await ensureLiveKitAwake(wsUrl)
    // CC-4 : le sélecteur unique — tout appel de conversation (P10 ou contextuelle) est relu après le réveil et reçoit un jeton court.
    const conversationCall = isConversationCall(grant)
    if (conversationCall) {
      // Le réveil peut prendre du temps : ni mandat, ni accord, ni phase ne sont photographiés avant lui.
      const fresh = await ctx.runQuery(internal.modules.calls.token.authorizeToken, { networkId: ctx.networkId, callId: args.callId })
      if (fresh === null || fresh.roomName !== grant.roomName || fresh.commercialThreadId !== grant.commercialThreadId || fresh.contextualThreadId !== grant.contextualThreadId) return notFound()
    }

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return fail("unauthenticated")
    const token = new AccessToken(apiKey, apiSecret, {
      identity: buildLiveKitIdentity({ kind: "call", subject: identity.subject, nonce: randomUUID().slice(0, 8) }),
      ttl: conversationCall ? CONVERSATION_CALL_TOKEN_TTL : TOKEN_TTL,
      ...(grant.displayName !== null ? { name: grant.displayName } : {}),
      attributes: { personId: grant.personId },
      // Repli pour un serveur antérieur aux attributs de participant.
      metadata: JSON.stringify({ personId: grant.personId }),
    })
    token.addGrant({ roomJoin: true, room: grant.roomName, canPublish: true, canSubscribe: true, canPublishData: true })
    return { token: await token.toJwt(), roomName: grant.roomName, wsUrl, mediaType: grant.mediaType }
  },
})
