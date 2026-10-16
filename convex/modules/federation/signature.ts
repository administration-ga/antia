/** WebCrypto seulement : aucune bibliothèque Node, aucune clé en base. */
import { equalFederationSignature, federationSigningText, type FederationEnvironment, validFederationKeyEnvName } from "@antsia/social-domain/federationProtocol"

function hex(buffer: ArrayBuffer): string { return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("") }

export async function federationBodyDigest(rawBody: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody)))
}

export async function verifyFederationSignature(input: { environment: FederationEnvironment; timestamp: string; rawBody: string; signature: string; keyEnvName: string }): Promise<"valid" | "invalid" | "unavailable"> {
  if (!validFederationKeyEnvName(input.keyEnvName)) return "unavailable"
  const secret = process.env[input.keyEnvName]
  if (!secret || new TextEncoder().encode(secret).byteLength < 32 || secret.length > 4096) return "unavailable"
  if (!/^[a-f0-9]{64}$/u.test(input.signature)) return "invalid"
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(federationSigningText(input.environment, input.timestamp, input.rawBody))))
  return equalFederationSignature(expected, input.signature) ? "valid" : "invalid"
}
