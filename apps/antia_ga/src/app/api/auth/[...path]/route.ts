// Dupliqué de plateforme/espace/espace_administration_ga/src/app/api/auth/[...path]/route.ts @ ad2e7fdc2 — adaptations : réécriture des cookies `__Secure-` réservée au développement (en production les cookies gardent leurs attributs) ; journal d'erreur sans détail de requête.
import { type NextRequest, NextResponse } from "next/server"

/**
 * Proxy Better Auth → actions HTTP Convex du moteur : l'application parle à
 * l'authentification par sa propre origine. `CONVEX_SITE_URL` est inscrit par
 * la configuration Next commune (`.env.local` du moteur en développement,
 * ARG du Dockerfile en production).
 */
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL
const IS_DEV = process.env.NODE_ENV !== "production"

const HOP_BY_HOP = new Set(["transfer-encoding", "connection", "keep-alive", "upgrade"])

/**
 * En-têtes qui décrivent CE saut-ci et qu'il ne faut jamais relayer.
 *
 * ⚠️ `x-forwarded-host` casse TOUTE l'authentification, silencieusement : Next
 * l'ajoute (`localhost:3030`), Better Auth le lit côté Convex pour reconstituer
 * sa base d'URL et ne reconnaît plus aucune de ses routes (404 sans journal).
 */
const PER_HOP_FORWARDING = new Set(["x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "x-forwarded-for"])

async function proxyToConvex(req: NextRequest): Promise<NextResponse> {
  if (!CONVEX_SITE_URL) return NextResponse.json({ error: "convex_site_url_missing" }, { status: 500 })

  const url = new URL(req.url)
  const targetUrl = `${CONVEX_SITE_URL}${url.pathname}${url.search}`

  const proxyHeaders: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (!HOP_BY_HOP.has(lower) && !PER_HOP_FORWARDING.has(lower)) proxyHeaders[key] = value
  })
  proxyHeaders["accept-encoding"] = "application/json"
  proxyHeaders.host = new URL(CONVEX_SITE_URL).host

  try {
    const body = req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      redirect: "manual",
      body,
      // @ts-expect-error `duplex` est requis pour un corps en flux (Node), absent des types DOM.
      duplex: "half",
    })

    const responseBody = await upstream.arrayBuffer()
    const headers = new Headers()
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === "set-cookie" || HOP_BY_HOP.has(lower)) return
      headers.set(key, value)
    })

    // Développement (HTTP) : retirer `__Secure-` et `Secure`, et passer en
    // `SameSite=Lax` (Chrome refuse `SameSite=None` sans `Secure`).
    const setCookies = upstream.headers.getSetCookie()
    for (const cookie of setCookies) {
      headers.append(
        "set-cookie",
        IS_DEV ? cookie.replaceAll("__Secure-", "").replace(/;\s*Secure/gi, "").replace(/SameSite=None/gi, "SameSite=Lax") : cookie,
      )
    }

    return new NextResponse(responseBody, { status: upstream.status, headers })
  } catch (error) {
    console.error("[auth] proxy indisponible", error instanceof Error ? error.message : "inconnu")
    return NextResponse.json({ error: "auth_proxy_unavailable" }, { status: 502 })
  }
}

export async function GET(req: NextRequest) {
  return proxyToConvex(req)
}
export async function POST(req: NextRequest) {
  return proxyToConvex(req)
}
export async function PUT(req: NextRequest) {
  return proxyToConvex(req)
}
export async function PATCH(req: NextRequest) {
  return proxyToConvex(req)
}
export async function DELETE(req: NextRequest) {
  return proxyToConvex(req)
}
