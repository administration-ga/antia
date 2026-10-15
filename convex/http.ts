// Dupliqué de socle/convex/http.ts (l. 120-180 et 243-385) @ ad2e7fdc2 — adaptations : routes d'authentification seulement (les autres routes du socle sont administratives) ; liste blanche CORS = origines de confiance du moteur ; contournement `mode` partagé avec `betterAuth/auth.ts` ; journalisation d'une erreur 500 sans écriture en base.
/**
 * Routes HTTP du moteur.
 *
 * Better Auth est monté À LA MAIN plutôt que par `authComponent.registerRoutes`
 * pour passer l'origine de la requête à `createAuth` : le greffon `crossDomain`
 * renvoie ainsi chaque application vers elle-même.
 */
import { httpRouter } from "convex/server"

import { httpAction } from "./_generated/server"
import { createAuth, trustedOrigins } from "./betterAuth/auth"

const http = httpRouter()

const AUTH_PATH = "/api/auth"

/** En-têtes CORS pour une origine de confiance seulement ; une inconnue n'en reçoit aucun. */
function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin ?? ""
  if (!trustedOrigins().includes(origin)) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    // Le greffon crossDomain transporte la session dans cet en-tête : un client
    // hors origine ne le lit pas sans cette exposition.
    "Access-Control-Expose-Headers": "Set-Better-Auth-Cookie",
  }
}

function buildPreflightHeaders(requestOrigin: string | null): Record<string, string> {
  const cors = buildCorsHeaders(requestOrigin)
  if (!cors["Access-Control-Allow-Origin"]) return {}
  return {
    ...cors,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // `Better-Auth-Cookie` : envoyé par le client crossDomain sur CHAQUE requête.
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Better-Auth-Cookie",
    "Access-Control-Max-Age": "86400",
  }
}

/**
 * Better Auth ne pose aucun en-tête CORS : on recopie la réponse avec ceux de la
 * liste blanche (les en-têtes d'une redirection sont immuables, d'où la copie).
 */
function withCorsHeaders(response: Response, origin: string | null): Response {
  const cors = buildCorsHeaders(origin)
  if (!cors["Access-Control-Allow-Origin"]) return response
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(cors)) headers.set(name, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

// Découverte OIDC (validation des JWT Convex).
http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async () => Response.redirect(`${process.env.CONVEX_SITE_URL}${AUTH_PATH}/convex/.well-known/openid-configuration`)),
})

type HttpCtx = Parameters<Parameters<typeof httpAction>[0]>[0]

async function forwardToBetterAuth(ctx: HttpCtx, request: Request): Promise<Response> {
  const origin = request.headers.get("origin")
  const auth = createAuth(ctx, origin)
  const response = await auth.handler(request)
  if (response.status === 500) {
    console.error("[BetterAuth] 500", await response.clone().text())
  }
  return withCorsHeaders(response, origin)
}

const authRequestHandler = httpAction(forwardToBetterAuth)

// Passage par one-time-token : la version du greffon crossDomain n'enregistre pas
// `/cross-domain/one-time-token/verify` ; l'endpoint natif du greffon
// oneTimeToken lit la même clé. Route exacte → prioritaire sur le préfixe.
http.route({
  path: `${AUTH_PATH}/cross-domain/one-time-token/verify`,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    url.pathname = `${AUTH_PATH}/one-time-token/verify`
    const rewritten = new Request(url.toString(), { method: "POST", headers: request.headers, body: await request.arrayBuffer() })
    return forwardToBetterAuth(ctx, rewritten)
  }),
})

http.route({ pathPrefix: `${AUTH_PATH}/`, method: "GET", handler: authRequestHandler })
http.route({ pathPrefix: `${AUTH_PATH}/`, method: "POST", handler: authRequestHandler })
http.route({
  pathPrefix: `${AUTH_PATH}/`,
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: buildPreflightHeaders(request.headers.get("origin")) })),
})

export default http
