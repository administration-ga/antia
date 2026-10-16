// @vitest-environment edge-runtime
/**
 * Les actions LiveKit du direct (`livekitActions.ts`) — tests NEUFS, écrits
 * pour le moteur : ils tiennent les ADAPTATIONS de l'action de jeton et de
 * l'importation de sous-titres (le socle ne testait `requestDirectToken`
 * qu'à travers sa mutation d'autorisation, couverte ici par `access.test.ts`).
 *
 * Ce que ce fichier tient :
 *  1. le jeton porte la salle, une identité `direct-v_`/`direct-s_` préfixée par
 *     le SUJET d'auth (ce qui permet au SFU de retrouver toutes les connexions
 *     d'une personne) et un nonce unique par connexion, la PERSONNE en
 *     attributs, le nom du profil publié, et le grant du rôle que la base a
 *     décidé (spectateur caché et muet, intervenant publiant) ;
 *  2. l'action est BORNÉE par le réseau : une session d'un autre réseau est
 *     introuvable, et le refus vient AVANT toute lecture de la configuration
 *     LiveKit ; une personne autorisée sur un déploiement sans LiveKit reçoit
 *     un refus à code (`mediaServerNotConfigured`) ;
 *  3. l'importation de sous-titres est bornée par le réseau de la même façon.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "../../_generated/api"
import { testConvex } from "../../test.setup"
import { codeOf, enter, insertSession, joinAlso, promote, seed, T0 } from "./fixtures.setup"

const L = api.modules.live.livekitActions

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
  vi.stubEnv("LIVEKIT_WAKE_URL", "")
  vi.stubEnv("LIVEKIT_WAKE_TOKEN", "")
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function withLiveKit(): void {
  vi.stubEnv("LIVEKIT_API_KEY", "cle-de-test")
  vi.stubEnv("LIVEKIT_API_SECRET", "secret-de-test-suffisamment-long-pour-hs256")
  vi.stubEnv("LIVEKIT_WS_URL", "wss://livekit.example.test")
}

type Claims = {
  sub: string
  name?: string
  metadata?: string
  attributes?: Record<string, string>
  video?: { room?: string; roomJoin?: boolean; canPublish?: boolean; canPublishData?: boolean; canPublishSources?: string[]; hidden?: boolean }
}

function claimsOf(jwt: string): Claims {
  return JSON.parse(atob((jwt.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"))) as Claims
}

async function cast() {
  const t = testConvex()
  const { root, testClosed } = await seed(t)
  const alice = await enter(t, root, "alice")
  const bob = await enter(t, root, "bob")
  const carol = await enter(t, root, "carol")
  return { t, root, testClosed, alice, bob, carol }
}

describe("requestDirectToken — le jeton que la base a décidé", () => {
  it("l'intervenant publie, le spectateur regarde caché ; le sujet d'auth en préfixe, un nonce par connexion, la personne en attributs", async () => {
    withLiveKit()
    const { t, root, alice, bob, carol } = await cast()
    const sessionId = await insertSession(t, { networkId: root, host: alice })
    await promote(t, sessionId, bob)

    const host = await alice.as.action(L.requestDirectToken, { networkId: root, sessionId })
    expect(host).toMatchObject({ role: "speaker", wsUrl: "wss://livekit.example.test" })
    const hostClaims = claimsOf(host.token)
    expect(hostClaims.sub.startsWith("direct-s_auth-alice::")).toBe(true)
    expect(hostClaims.attributes).toEqual({ personId: alice.personId })
    expect(JSON.parse(hostClaims.metadata ?? "{}")).toEqual({ personId: alice.personId })
    expect(hostClaims.name).toBe("alice")
    expect(hostClaims.video).toMatchObject({ room: host.roomName, roomJoin: true, canPublish: true, canPublishData: true, hidden: false })

    expect((await bob.as.action(L.requestDirectToken, { networkId: root, sessionId })).role).toBe("speaker")

    const viewer = await carol.as.action(L.requestDirectToken, { networkId: root, sessionId })
    const again = await carol.as.action(L.requestDirectToken, { networkId: root, sessionId })
    expect(viewer.role).toBe("viewer")
    const viewerClaims = claimsOf(viewer.token)
    expect(viewerClaims.sub.startsWith("direct-v_auth-carol::")).toBe(true)
    // Deux onglets ne s'éjectent pas : chaque connexion a SON nonce.
    expect(claimsOf(again.token).sub).not.toBe(viewerClaims.sub)
    expect(viewerClaims.attributes).toEqual({ personId: carol.personId })
    expect(viewerClaims.video).toMatchObject({ room: viewer.roomName, roomJoin: true, canPublish: false, canPublishData: false, canPublishSources: [], hidden: true })
  })

  it("bornée par le réseau : une session d'un AUTRE réseau est introuvable, refusée avant toute configuration", async () => {
    // Aucune variable LiveKit : un refus de configuration trahirait une autorisation accordée.
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { t, root, testClosed, alice, bob } = await cast()
    await joinAlso(t, testClosed, alice)
    await joinAlso(t, testClosed, bob)
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice })
    const ici = await insertSession(t, { networkId: root, host: alice })

    // Bob est membre des deux réseaux : demandée au nom de la racine, la session du réseau fermé n'existe pas.
    expect(await codeOf(bob.as.action(L.requestDirectToken, { networkId: root, sessionId: ailleurs }))).toBe("notFound")
    // Autorisé dans le bon réseau, il bute sur la configuration absente — un CODE, jamais une phrase.
    expect(await codeOf(bob.as.action(L.requestDirectToken, { networkId: root, sessionId: ici }))).toBe("mediaServerNotConfigured")
  })

  it("un non-membre du réseau est refusé par le constructeur, indistinctement", async () => {
    withLiveKit()
    const { t, testClosed, alice, carol } = await cast()
    await joinAlso(t, testClosed, alice)
    const ferme = await insertSession(t, { networkId: testClosed, host: alice })
    expect(await codeOf(carol.as.action(L.requestDirectToken, { networkId: testClosed, sessionId: ferme }))).toBe("notFound")
  })
})

describe("importReplayCaptions — bornée par le réseau", () => {
  it("la rediffusion d'un AUTRE réseau est introuvable, et rien n'est stocké", async () => {
    const { t, root, testClosed, alice } = await cast()
    await joinAlso(t, testClosed, alice)
    const ailleurs = await insertSession(t, { networkId: testClosed, host: alice, status: "ended" })
    const avant = await t.run(async (ctx) => ctx.db.system.query("_storage").take(100))
    expect(await codeOf(alice.as.action(L.importReplayCaptions, { networkId: root, sessionId: ailleurs, content: "WEBVTT" }))).toBe("notFound")
    const apres = await t.run(async (ctx) => ctx.db.system.query("_storage").take(100))
    expect(apres.length).toBe(avant.length)
  })
})
