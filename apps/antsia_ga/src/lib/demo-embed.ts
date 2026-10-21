/** Origines explicites du cadre de démonstration : aucune donnée ni session ne traverse le pont. */
export const DEMO_READY_MESSAGE_TYPE = "antsia:demo-ready"
/** Même cible fermée que la projection du catalogue ; aucune dépendance au contenu démo dans le parent. */
const DEMO_BACKEND_HOST = "vivid-hedgehog-655.convex.cloud"

/** Une origine HTTPS canonique seule ; la normalisation ne doit jamais élargir la configuration. */
export function canonicalHttpsOrigin(value: string | undefined): string | null {
  if (!value || /[\s*\\]/u.test(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash || value !== url.origin) return null
    return url.origin
  } catch { return null }
}

/** Sans deux origines valides et différentes, le site principal n'ouvre aucun cadre. */
export function demoEmbedOrigin(): string | null {
  const origin = canonicalHttpsOrigin(process.env.NEXT_PUBLIC_DEMO_EMBED_ORIGIN)
  const site = canonicalHttpsOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  return origin && site && origin !== site ? origin : null
}

/** Le signal ne s'émet que depuis le backend cloud de démonstration déjà autorisé. */
export function demoParentOrigin(): string | null {
  const backend = canonicalHttpsOrigin(process.env.NEXT_PUBLIC_CONVEX_URL)
  if (!backend || new URL(backend).hostname !== DEMO_BACKEND_HOST) return null
  return canonicalHttpsOrigin(process.env.NEXT_PUBLIC_DEMO_PARENT_ORIGIN)
}
