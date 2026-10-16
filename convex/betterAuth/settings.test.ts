import { describe, expect, it } from "vitest"

import catalog from "../../deploy/catalog.json"
import { authenticationConfiguration, idnConfiguration, idnProfileProof, isE164Phone, parseOriginList, smsConfiguration, trustedOrigins } from "./settings"

const idnEnv = {
  IDN_CLIENT_ID: "sandbox-client-fixture",
  IDN_CLIENT_SECRET: "fictional-idn-secret-for-tests",
  IDN_ISSUER: "https://idn.example.test",
}

describe("configuration des portes PA4", () => {
  it("IDN est fermé tant que les trois éléments de configuration ne sont pas présents", () => {
    expect(idnConfiguration({})).toBeNull()
    expect(idnConfiguration({ IDN_ISSUER: idnEnv.IDN_ISSUER })).toBeNull()
    expect(idnConfiguration({ ...idnEnv, IDN_CLIENT_ID: " " })).toBeNull()
    expect(idnConfiguration({ ...idnEnv, IDN_CLIENT_SECRET: " " })).toBeNull()
    expect(idnConfiguration({ ...idnEnv, IDN_ISSUER: undefined })).toBeNull()
  })

  it.each(["http://idn.example.test", "https://user:pass@idn.example.test", "https://idn.example.test/#fragment", "not-a-url"])("refuse un émetteur IDN mal configuré : %s", (issuer) => {
    expect(idnConfiguration({ ...idnEnv, IDN_ISSUER: issuer })).toBeNull()
  })

  it("accepte le discovery explicite HTTPS sans inventer un émetteur", () => {
    const config = idnConfiguration({ ...idnEnv, IDN_ISSUER: undefined, IDN_DISCOVERY_URL: "https://idn.example.test/oidc/discovery" })
    expect(config).toEqual({ clientId: idnEnv.IDN_CLIENT_ID, clientSecret: idnEnv.IDN_CLIENT_SECRET, discoveryUrl: "https://idn.example.test/oidc/discovery" })
  })

  it("le relais SMS est fermé pour un fournisseur, une clé ou une URL invalide", () => {
    expect(smsConfiguration({})).toBeNull()
    expect(smsConfiguration({ SMS_PROVIDER: "unknown", SMS_ENDPOINT: "https://sms.example.test", SMS_API_KEY: "fictional-key" })).toBeNull()
    expect(smsConfiguration({ SMS_PROVIDER: "webhook", SMS_ENDPOINT: "http://sms.example.test", SMS_API_KEY: "fictional-key" })).toBeNull()
    expect(smsConfiguration({ SMS_PROVIDER: "webhook", SMS_ENDPOINT: "https://sms.example.test", SMS_API_KEY: " " })).toBeNull()
    expect(smsConfiguration({ SMS_PROVIDER: "webhook", SMS_ENDPOINT: "https://sms.example.test/send", SMS_API_KEY: "fictional-key" })).toEqual({ endpoint: "https://sms.example.test/send", apiKey: "fictional-key" })
  })

  it("la projection publique expose les portes et les applications sans aucun secret", () => {
    const config = authenticationConfiguration({
      ...idnEnv,
      SITE_URL: "https://entry.example.test",
      RESEND_API_KEY: "fictional-mail-key",
      RESEND_FROM_ADDRESS: "ANTSIA <auth@example.test>",
      SMS_PROVIDER: "webhook",
      SMS_ENDPOINT: "https://sms.example.test/send",
      SMS_API_KEY: "fictional-sms-key",
      BETTER_AUTH_SECRET: "fictional-session-secret-which-is-not-returned",
    })
    expect(config).toMatchObject({ idn: true, emailOtp: true, smsOtp: true, localCodes: false })
    expect(Object.keys(config).sort()).toEqual(["applications", "emailOtp", "idn", "localCodes", "smsOtp", "trustedOrigins"])
    const serialized = JSON.stringify(config)
    for (const secret of [idnEnv.IDN_CLIENT_SECRET, "fictional-mail-key", "fictional-sms-key", "fictional-session-secret-which-is-not-returned"]) expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain("https://sms.example.test/send")
    expect(config.applications).toEqual(Object.entries(catalog.applications).map(([key, app]) => ({ key, origin: new URL(app.site_url).origin })))
  })

  it("des portes non configurées restent annoncées fermées hors développement local", () => {
    expect(authenticationConfiguration({})).toMatchObject({ idn: false, emailOtp: false, smsOtp: false, localCodes: false })
  })

  it("les codes et les ports locaux exigent ensemble le backend local et la variable explicite", () => {
    const local = { ANTSIA_DEV_TOOLS: "true", CONVEX_CLOUD_URL: "http://127.0.0.1:3210" }
    expect(authenticationConfiguration(local)).toMatchObject({ localCodes: true, emailOtp: true, smsOtp: true })
    for (const app of Object.values(catalog.applications)) expect(trustedOrigins(local)).toContain(`http://localhost:${app.dev_port}`)
    const cloud = { ...local, CONVEX_CLOUD_URL: "https://backend.example.test" }
    expect(authenticationConfiguration(cloud).localCodes).toBe(false)
    expect(trustedOrigins(cloud).some((origin) => origin.includes("localhost") || origin.includes("127.0.0.1"))).toBe(false)
    expect(authenticationConfiguration({ ...local, ANTSIA_DEV_TOOLS: "false" }).localCodes).toBe(false)
  })

  it("combine uniquement les origines HTTP(S) normalisées avec le catalogue", () => {
    expect(parseOriginList("https://site.example.test/path https://site.example.test/other, bad-url ftp://files.example.test https://user:password@site.example.test")).toEqual(["https://site.example.test"])
    const result = trustedOrigins({ SITE_URL: "https://entry.example.test/path", TRUSTED_ORIGINS: "https://peer.example.test, https://entry.example.test" })
    expect(result).toContain("https://entry.example.test")
    expect(result).toContain("https://peer.example.test")
    for (const app of Object.values(catalog.applications)) expect(result).toContain(new URL(app.site_url).origin)
    expect(new Set(result).size).toBe(result.length)
  })
})

describe("numéro SMS international", () => {
  it.each(["+24107890123", "+33612345678"])("accepte le format E.164 %s", (phone) => expect(isE164Phone(phone)).toBe(true))
  it.each(["07890123", "0024107890123", "+241 07890123", "+00000000", "+123", "+1234567890123456"])("refuse le numéro ambigu %s", (phone) => expect(isE164Phone(phone)).toBe(false))
})

describe("preuve IDN minimale provenant de userinfo", () => {
  const profile = { sub: "idn-sub-fixture", email: "alice@example.test", email_verified: true }

  it("ne copie aucun champ civil, photo, courriel ni jeton dans la preuve", () => {
    expect(idnProfileProof({ ...profile, loa: 2, nationality: "GA", profile_type: "citizen", name: "Nom civil", given_name: "Prénom", family_name: "Nom", birthdate: "1990-01-01", picture: "https://images.example.test/photo", nip: "fictional-nip", access_token: "fictional-token" })).toEqual({ subject: profile.sub, loa: 2, nationality: "GA", profileType: "citizen" })
  })

  it.each([1, 2, 3])("garde le niveau attesté %s sans le relever", (loa) => {
    expect(idnProfileProof({ ...profile, loa })).toEqual({ subject: profile.sub, loa })
  })

  it("n'invente ni niveau de garantie ni nationalité lorsqu'ils sont absents ou illisibles", () => {
    expect(idnProfileProof(profile)).toEqual({ subject: profile.sub })
    expect(idnProfileProof({ ...profile, nationality: 241 })).toEqual({ subject: profile.sub })
    expect(idnProfileProof({ ...profile, nationality: "X".repeat(65) })).toEqual({ subject: profile.sub })
  })

  it.each([
    { sub: "" }, { sub: " " }, { sub: "X".repeat(257) }, { sub: 42 },
    { email: "invalid" }, { email: undefined }, { email_verified: false }, { email_verified: "true" },
    { loa: "2" }, { loa: 0 }, { loa: 4 }, { profile_type: "unknown" },
  ])("refuse une preuve IDN invalide %#", (invalid) => {
    expect(() => idnProfileProof({ ...profile, ...invalid })).toThrow("idnInvalidProfile")
  })
})
