import { NETWORK_SLICES } from "@antia/social-domain/network"
import { describe, expect, it } from "vitest"

import { detectUnscopedFunctions } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile } from "./lib/source-files"

/**
 * Dossiers des MODULES SOCIAUX du moteur. Toute fonction publique qui y vit doit
 * être bornée par le réseau : constructeur `networkQuery`/`networkMutation`, ou
 * `requireMembership(ctx, args.networkId, …)` explicite avec `networkId` en
 * argument, ou projection publique allowlistée (`@publicProjection <raison>`).
 *
 * Actif depuis PA2 (networks, people) ; la liste s'étend à chaque module posé
 * (PA3 : tous les modules dupliqués). Un module absent des deux listes est
 * lui-même un défaut (test ci-dessous). Les TRANCHES d'application
 * (`NETWORK_SLICES` : `convex/modules/diaspora`, écrite par la session
 * DIASPORALE) sont sociales, classées avant même d'exister.
 */
export const SOCIAL_MODULE_DIRECTORIES: readonly string[] = [
  "convex/modules/networks",
  "convex/modules/people",
  "convex/modules/posts",
  "convex/modules/engagement",
  "convex/modules/media",
  "convex/modules/diaspora",
]

/**
 * Modules du moteur qui ne sont PAS sociaux (aucun contenu, aucune adhésion) :
 * `files` est l'infrastructure de garde des fichiers — ses lectures publiques
 * sont bornées une à une (réseau, déposant, modérateur, opérateur).
 */
export const NON_SOCIAL_MODULE_DIRECTORIES: readonly string[] = ["convex/modules/platform", "convex/modules/files"]

describe("network-scoped-functions — toute fonction sociale est bornée par le réseau (R10)", () => {
  it("chaque fonction publique des modules sociaux exige un réseau et une adhésion", () => {
    const findings: Finding[] = []
    for (const file of listFiles([...SOCIAL_MODULE_DIRECTORIES], [".ts"])) {
      if (isTestFile(file)) continue
      findings.push(...detectUnscopedFunctions(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("chaque tranche qui peut gouverner un réseau est un module social classé", () => {
    expect(NETWORK_SLICES.map((slice) => `convex/modules/${slice}`).filter((module) => !SOCIAL_MODULE_DIRECTORIES.includes(module))).toEqual([])
  })

  it("chaque module du moteur est classé (social ou non) : aucun n'échappe au cliquet", () => {
    const modules = new Set(listFiles(["convex/modules"], [".ts"]).map((file) => file.split("/").slice(0, 3).join("/")))
    const classified = new Set([...SOCIAL_MODULE_DIRECTORIES, ...NON_SOCIAL_MODULE_DIRECTORIES])
    expect([...modules].filter((module) => !classified.has(module))).toEqual([])
  })

  it("test du test : une fonction publique non bornée est refusée, une bornée passe", () => {
    const source = [
      'export const leak = query({ args: { postId: v.id("posts") }, handler: async (ctx, args) => ctx.db.get(args.postId) })',
      "export const ok = query({",
      '  args: { networkId: v.id("networks") },',
      "  handler: async (ctx, args) => { await requireMembership(ctx, args.networkId, \"declaree\"); return null },",
      "})",
      "export const scoped = networkQuery({ args: {}, handler: async () => null })",
      "export const hidden = internalQuery({ args: {}, handler: async () => null })",
      "/** @publicProjection page Officiel lisible sans compte (arbitrage A4) */",
      "export const officialPage = query({ args: {}, handler: async () => null })",
      "/** @selfScoped la personne appelante règle ses propres consentements */",
      "export const mine = personMutation({ args: {}, handler: async () => null })",
      "/** @selfScoped trop court */",
      "export const shortReason = personQuery({ args: {}, handler: async () => null })",
      "export const console = operatorMutation({ args: {}, handler: async () => null })",
    ].join("\n")
    const findings = detectUnscopedFunctions("convex/modules/posts/posts.ts", source)
    expect(findings.map((finding) => finding.line)).toEqual([1, 13])
  })
})
