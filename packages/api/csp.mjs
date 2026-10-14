// @ts-check
/**
 * Politique de sécurité du contenu (CSP) des applications du moteur.
 *
 * En JavaScript pur (.mjs) parce qu'elle est importée par `next.config.ts`, que
 * Next charge avant toute transpilation des paquets (même choix que
 * `@workspace/livekit/csp` au socle). Les origines du backend se DÉRIVENT de
 * `NEXT_PUBLIC_CONVEX_URL` : aucune URL de déploiement n'est écrite dans le code
 * (dépôt public, et une origine oubliée casse la connexion sans erreur visible).
 *
 * ⚠️ Palier PA0 : `script-src` tolère encore `'unsafe-inline'` (scripts
 * d'hydratation de Next). La CSP à jeton (nonce par requête, EXT-AN-02) arrive
 * avec la mise en ligne publique (PA8/PA10).
 */

/**
 * Origines HTTP et WebSocket d'un déploiement Convex, déduites de son URL.
 * `https://x.convex.cloud` → https://x.convex.cloud, wss://x.convex.cloud et le
 * domaine `.convex.site` des actions HTTP ; `http://127.0.0.1:3210` (déploiement
 * local) → http://127.0.0.1:3210, ws://127.0.0.1:3210, et le port HTTP voisin.
 * @param {string | undefined} convexUrl
 * @returns {string[]}
 */
export function convexOrigins(convexUrl) {
  if (!convexUrl) return []
  let url
  try {
    url = new URL(convexUrl)
  } catch {
    return []
  }
  const origins = new Set([url.origin])
  const ws = url.protocol === "https:" ? "wss:" : "ws:"
  origins.add(`${ws}//${url.host}`)
  if (url.hostname.endsWith(".convex.cloud")) {
    origins.add(`${url.protocol}//${url.hostname.replace(/\.convex\.cloud$/, ".convex.site")}`)
  }
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    const sitePort = Number(url.port || "80") + 1
    origins.add(`${url.protocol}//${url.hostname}:${sitePort}`)
  }
  return [...origins]
}

/**
 * @param {{ convexUrl?: string, isDev: boolean, extraConnect?: string[] }} options
 * @returns {string}
 */
export function buildContentSecurityPolicy(options) {
  const backend = convexOrigins(options.convexUrl)
  const connect = [
    "'self'",
    ...backend,
    ...(options.extraConnect ?? []),
    ...(options.isDev ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://127.0.0.1:*"] : []),
  ]
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${backend.filter((o) => o.startsWith("http")).join(" ")}`.trim(),
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  return directives.join("; ")
}

/**
 * En-têtes de sécurité statiques communs aux applications du moteur.
 * @param {{ convexUrl?: string, isDev: boolean }} options
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(options) {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
    ...(options.isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
  ]
}
