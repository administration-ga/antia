import { describe, expect, it } from "vitest"
import type { DirectSession } from "./DirectPage"
import { directParticipantPersonId, directRosterTracks } from "./direct-studio-model"
import { normalizeDirectStageFormat, directStageLayout } from "./direct-stage-format"
import { DIRECT_INTENT_UNCONVERGED, reconcileMediaIntent } from "./direct-intent-sync"

const speakers = [{ personId: "alice", role: "host", displayName: "Même nom" }, { personId: "bob", role: "speaker", displayName: "Même nom" }] as DirectSession["speakers"]
const track = (personId: string, identity = `direct-s_${personId}`) => ({ participant: { identity, attributes: { personId } } })

describe("studio — identités et contrat de source", () => {
  it("apparie deux homonymes par personId, jamais par nom", () => {
    const bob = track("bob")
    expect(directRosterTracks([bob], speakers).map((row) => [row.personId, row.kind])).toEqual([["alice", "roster"], ["bob", "track"]])
    expect(directRosterTracks([bob], speakers)[1]!.track).toBe(bob)
  })
  it("refuse la tuile d’un spectateur, d’un rôle retiré et une identité manquante", () => {
    const rows = directRosterTracks([track("alice", "direct-v_alice"), track("outsider"), { participant: { identity: "direct-s_unknown", attributes: {} } }], speakers)
    expect(rows.every((row) => row.track === null)).toBe(true)
  })
  it("relit metadata seulement si l’attribut signé manque et tolère une valeur malformée", () => {
    expect(directParticipantPersonId({ attributes: { personId: "alice" }, metadata: '{"personId":"bob"}' })).toBe("alice")
    expect(directParticipantPersonId({ metadata: '{"personId":"bob"}' })).toBe("bob")
    for (const metadata of ["{", "null", "42", '{"personId":9}']) expect(directParticipantPersonId({ metadata })).toBeNull()
  })
  it("garde une seule caméra par personne malgré deux connexions tardives", () => {
    expect(directRosterTracks([track("bob"), track("bob", "direct-s_nonce")], speakers)).toHaveLength(2)
  })
  it("conserve les ratios du socle et le repli pour les anciennes sessions", () => {
    expect(normalizeDirectStageFormat("unknown")).toBe("computer")
    expect(directStageLayout("mobile")).toMatchObject({ aspectRatio: "9 / 16", columns: 2 })
    expect(directStageLayout("television").aspectRatio).toBe("16 / 9")
  })
})

describe("convergence média du socle — fermeture et reconnexion", () => {
  const wants = { mic: true, camera: true }
  it("n’adopte pas les pistes absentes pendant la connexion initiale", () => {
    expect(reconcileMediaIntent({ wants, actual: { mic: false, camera: false }, converged: DIRECT_INTENT_UNCONVERGED }).patch).toBeNull()
  })
  it("enregistre un micro coupé par la modération après convergence", () => {
    const ready = reconcileMediaIntent({ wants, actual: wants, converged: DIRECT_INTENT_UNCONVERGED }).converged
    expect(reconcileMediaIntent({ wants, actual: { mic: false, camera: true }, converged: ready }).patch).toEqual({ micEnabled: false })
  })
  it("attend l’application d’une nouvelle intention, sans la réécrire avec l’ancienne piste", () => {
    const ready = reconcileMediaIntent({ wants, actual: wants, converged: DIRECT_INTENT_UNCONVERGED }).converged
    expect(reconcileMediaIntent({ wants: { mic: false, camera: true }, actual: wants, converged: ready }).patch).toBeNull()
  })
  it("une reconnexion repart sans convergence et conserve un micro volontairement fermé", () => {
    const muted = { mic: false, camera: true }
    expect(reconcileMediaIntent({ wants: muted, actual: { mic: false, camera: false }, converged: DIRECT_INTENT_UNCONVERGED }).patch).toBeNull()
  })
})
