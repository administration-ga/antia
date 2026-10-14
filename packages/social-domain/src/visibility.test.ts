/**
 * Visibilité multi-réseaux : la garde du RÉSEAU passe avant la règle
 * d'AUDIENCE, et aucune des deux n'élargit l'autre.
 */
import { describe, expect, it } from "vitest"

import { CONTENT_VISIBILITIES } from "./network"
import { isVisibleTo, passesNetworkGate } from "./visibility"

const reader = {
  isAuthor: false,
  isConnected: false,
  isGroupMember: false,
  isBlockedWithAuthor: false,
  isMemberOfPostNetwork: false,
  isMemberOfRoot: true,
}
const post = { audience: "public" as const, status: "published" as const, visibility: "network" as const }

describe("passesNetworkGate", () => {
  it("un membre actif du réseau de la publication la voit, quelle que soit sa visibilité", () => {
    for (const visibility of CONTENT_VISIBILITIES) {
      expect(passesNetworkGate(visibility, { isMemberOfPostNetwork: true, isMemberOfRoot: false })).toBe(true)
    }
  })

  it("hors du réseau, seule une publication `root` s'ouvre, et seulement à un membre actif de la racine", () => {
    expect(passesNetworkGate("network", { isMemberOfPostNetwork: false, isMemberOfRoot: true })).toBe(false)
    expect(passesNetworkGate("root", { isMemberOfPostNetwork: false, isMemberOfRoot: true })).toBe(true)
    expect(passesNetworkGate("root", { isMemberOfPostNetwork: false, isMemberOfRoot: false })).toBe(false)
  })
})

describe("isVisibleTo — réseau d'abord, audience ensuite", () => {
  it("un membre de test-closed lit `root` mais pas `network` d'un autre réseau fermé", () => {
    expect(isVisibleTo({ ...post, ...reader })).toBe(false)
    expect(isVisibleTo({ ...post, visibility: "root", ...reader })).toBe(true)
  })

  it("une publication `network` de la racine est lisible de tout membre (adhésion dérivée)", () => {
    expect(isVisibleTo({ ...post, ...reader, isMemberOfPostNetwork: true })).toBe(true)
  })

  it("la garde du réseau n'élargit jamais l'audience", () => {
    // `root` ouvre le réseau, pas le cercle des connexions de l'auteur.
    expect(isVisibleTo({ ...post, audience: "connections", visibility: "root", ...reader })).toBe(false)
    expect(isVisibleTo({ ...post, audience: "connections", visibility: "root", ...reader, isConnected: true })).toBe(true)
    expect(isVisibleTo({ ...post, audience: "group", visibility: "root", ...reader, isMemberOfPostNetwork: true })).toBe(false)
  })

  it("l'audience n'élargit jamais le réseau : l'auteur qui a quitté le réseau n'y lit plus", () => {
    expect(isVisibleTo({ ...post, ...reader, isAuthor: true })).toBe(false)
    expect(isVisibleTo({ ...post, ...reader, isAuthor: true, isMemberOfPostNetwork: true })).toBe(true)
  })

  it("un membre suspendu partout (aucune adhésion active) ne lit rien", () => {
    const suspended = { ...reader, isMemberOfPostNetwork: false, isMemberOfRoot: false }
    for (const visibility of CONTENT_VISIBILITIES) {
      expect(isVisibleTo({ ...post, visibility, ...suspended, isConnected: true })).toBe(false)
    }
  })

  it("une publication retirée reste réservée à son auteur, membre du réseau", () => {
    const removed = { ...post, status: "removed" as const, visibility: "root" as const }
    expect(isVisibleTo({ ...removed, ...reader })).toBe(false)
    expect(isVisibleTo({ ...removed, ...reader, isAuthor: true, isMemberOfPostNetwork: true })).toBe(true)
  })
})
