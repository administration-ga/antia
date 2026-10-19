/** P08 : configuration exclusivement serveur ; aucune origine reçue du navigateur. */
import { type CommerceEnvironment, commerceIsMachineIdentity, commerceCanonicalJson } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_LINK_CALLBACK_PATH } from "@antsia/social-domain/commerce-link"

import { sha256Hex } from "./commerceLinkCrypto"

export type CommerceLinkConfig = {
  source: string
  environment: CommerceEnvironment
  proHttpOrigin: string
  proAppOrigin: string
  antsiaOrigin: string
  redirectUri: string
  keyId: string
  signingKey: string
  fingerprint: string
}

function configuredOrigin(value: string | undefined, sandbox: boolean): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (value !== url.origin && value !== `${url.origin}/`)) return null
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (url.protocol !== "https:" && !(sandbox && loopback && url.protocol === "http:")) return null
    return url.origin
  } catch { return null }
}

export async function readCommerceLinkConfig(): Promise<CommerceLinkConfig | null> {
  const environment = process.env.ANTSIA_COMMERCE_ENVIRONMENT
  if (environment !== "sandbox" && environment !== "production") return null
  if (environment === "production" && process.env.ANTSIA_COMMERCE_PRODUCTION_ENABLED !== "true") return null
  const source = process.env.ANTSIA_COMMERCE_SOURCE
  const keyId = process.env.ANTSIA_COMMERCE_KEY_ID
  const signingKey = process.env.ANTSIA_COMMERCE_SIGNING_KEY
  if (!source || !commerceIsMachineIdentity(source) || /[^a-z0-9-]/u.test(source)) return null
  if (!keyId || keyId.length < 8 || keyId.length > 128 || /[^A-Za-z0-9._:-]/u.test(keyId)) return null
  const keyBytes = signingKey ? new TextEncoder().encode(signingKey).byteLength : 0
  if (!signingKey || keyBytes < 32 || keyBytes > 4096) return null
  const sandbox = environment === "sandbox"
  const proHttpOrigin = configuredOrigin(process.env.ANTSIA_COMMERCE_PRO_HTTP_ORIGIN, sandbox)
  const proAppOrigin = configuredOrigin(process.env.ANTSIA_COMMERCE_PRO_APP_ORIGIN, sandbox)
  const antsiaOrigin = configuredOrigin(process.env.ANTSIA_COMMERCE_ORIGIN, sandbox)
  if (!proHttpOrigin || !proAppOrigin || !antsiaOrigin) return null
  const redirectUri = new URL(COMMERCE_LINK_CALLBACK_PATH, antsiaOrigin).href
  // Une rotation de clé/origine/source ferme les anciens défis, même si leur JWT vit encore.
  const fingerprint = await sha256Hex(commerceCanonicalJson({ environment, source, keyId, proHttpOrigin, proAppOrigin, redirectUri, keyDigest: await sha256Hex(signingKey) })!)
  return { environment, source, keyId, signingKey, proHttpOrigin, proAppOrigin, antsiaOrigin, redirectUri, fingerprint }
}
