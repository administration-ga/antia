import { describe, expect, it } from "vitest"
import { bridgeAdmission, bridgeCookieNames, parseBridgeReceipt, sdkSessionCookie } from "./session-bridge"

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const signed = "abcdefghijklmnopqrstuv.signature1234567890="

describe("pont de session : une generation n'est jamais une autorite", () => {
  it("ne réadmet ni un grant A tardif ni une purge A tardive sous le hint B", () => {
    const grant = JSON.stringify({ kind: "session", generation: A, cookieName: "better-auth.session_token", cookieValue: signed })
    const purge = JSON.stringify({ kind: "anonymous", generation: A })
    expect(bridgeAdmission(A, grant).status).toBe("session")
    expect(bridgeAdmission(B, grant)).toEqual({ status: "closed" })
    expect(bridgeAdmission(B, purge)).toEqual({ status: "closed" })
  })
  it("n'accorde l'anonymat qu'à une purge corrélée ou une requête sans matériau", () => {
    expect(bridgeAdmission(undefined, undefined)).toEqual({ status: "anonymous" })
    expect(bridgeAdmission(B, undefined)).toEqual({ status: "closed" })
    expect(bridgeAdmission(B, JSON.stringify({ kind: "anonymous", generation: B }))).toEqual({ status: "anonymous" })
  })
  it("rejette les doubles SID plutôt que choisir le premier ou le dernier", () => {
    expect(sdkSessionCookie(`better-auth.session_token=${signed}; __Secure-better-auth.session_token=${signed}`)).toBeNull()
    expect(sdkSessionCookie(`better-auth.session_token=${signed}; better-auth.session_token=${signed}`)).toBeNull()
  })
  it("préserve l'encodage de la signature et refuse les reçus élargis", () => {
    expect(sdkSessionCookie(`unrelated=value; better-auth.session_token=${encodeURIComponent(signed)}`)).toEqual({ name: "better-auth.session_token", value: signed })
    expect(parseBridgeReceipt(JSON.stringify({ kind: "anonymous", generation: B, personId: "leak" }))).toBeNull()
    expect(bridgeCookieNames(false).receipt).not.toBe("better-auth.session_token")
    expect(bridgeCookieNames(true).receipt).toMatch(/^__Host-/)
  })
})
