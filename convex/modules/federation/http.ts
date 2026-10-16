/** Inbox HTTP FEDERATION-INBOX-V1 : signature valide avant toute écriture. */
import { FEDERATION_BODY_MAX_BYTES, federationEnvironment, freshFederationTimestamp, validFederationEmitter } from "@antsia/social-domain/federationProtocol"
import { engineErrorCode } from "@antsia/social-contracts/errors"

import { internal } from "../../_generated/api"
import { httpAction } from "../../_generated/server"
import { verifyFederationSignature } from "./signature"

function response(status: number, outcome: string, receiptStatus?: string): Response {
  return new Response(JSON.stringify({ outcome, ...(receiptStatus ? { status: receiptStatus } : {}) }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}

/** Corps lu en flux, borne réelle en octets même sans Content-Length. */
export async function readFederationBody(request: Request): Promise<{ ok: true; rawBody: string } | { ok: false; status: 400 | 413 }> {
  const length = request.headers.get("content-length")
  if (length && /^[0-9]+$/u.test(length) && Number(length) > FEDERATION_BODY_MAX_BYTES) return { ok: false, status: 413 }
  if (!request.body) return { ok: false, status: 400 }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > FEDERATION_BODY_MAX_BYTES) { await reader.cancel(); return { ok: false, status: 413 } }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { ok: true, rawBody: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) }
  } catch { return { ok: false, status: 400 } } finally { reader.releaseLock() }
}

export const inbox = httpAction(async (ctx, request): Promise<Response> => {
  const deployedEnvironment = federationEnvironment(process.env.FEDERATION_ENVIRONMENT)
  if (!deployedEnvironment) return response(503, "unavailable")
  const slug = request.headers.get("x-antsia-emitter") ?? ""
  const environment = federationEnvironment(request.headers.get("x-antsia-environment"))
  const timestamp = request.headers.get("x-antsia-timestamp") ?? ""
  const signature = request.headers.get("x-antsia-signature") ?? ""
  if (!validFederationEmitter(slug) || environment !== deployedEnvironment || !freshFederationTimestamp(timestamp, Date.now())) return response(401, "unauthorized")
  const body = await readFederationBody(request)
  if (!body.ok) return response(body.status, body.status === 413 ? "body_too_large" : "invalid_body")
  const emitter = await ctx.runQuery(internal.modules.federation.emitters.getForInbox, { slug, environment })
  if (!emitter) return response(401, "unauthorized")
  const verified = await verifyFederationSignature({ environment, timestamp, signature, rawBody: body.rawBody, keyEnvName: emitter.keyEnvName })
  if (verified !== "valid") return response(verified === "unavailable" ? 503 : 401, verified === "unavailable" ? "unavailable" : "unauthorized")
  try {
    const admitted = await ctx.runMutation(internal.modules.federation.inbox.admit, { emitterId: emitter.emitterId, emitterRevision: emitter.revision, environment, timestamp, signature, rawBody: body.rawBody })
    const status = { accepted: 202, duplicate: 200, conflict: 409, unauthorized: 401, unavailable: 503, invalid_envelope: 400 }[admitted.outcome]
    return response(status, admitted.outcome, admitted.status)
  } catch (error) {
    if (engineErrorCode(error) === "rateLimited") return response(429, "rate_limited")
    // Aucun corps, secret, sujet ou détail technique dans le refus HTTP.
    return response(503, "unavailable")
  }
})
