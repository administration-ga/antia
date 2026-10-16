// Dupliqué de socle/convex/tests/fileGuardGateRatchet.test.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT EN LISTE NOIRE (owner map §1.5 : la liste blanche du socle laissait passer 21 `getUrl` bruts du périmètre social) ; détecteur par l'arbre syntaxique, partagé avec le cliquet de dépôt.
/**
 * file-delivery-gate — aucune URL de fichier ne sort hors de la garde.
 *
 * Tout `ctx.storage.getUrl` du backend vit dans `convex/modules/files/storageGuard.ts`
 * (`servableUrl`, `resolveFileDelivery`) : un fichier non analysé, en analyse ou
 * bloqué ne doit jamais recevoir d'URL. Aucune exception.
 */
import { describe, expect, it } from "vitest"

import { detectRawGetUrl, FILE_DELIVERY_GATE } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile } from "./lib/source-files"

describe("file-delivery-gate — toute URL de fichier passe par la garde (D05)", () => {
  it("aucun `storage.getUrl` hors de la garde de délivrance", () => {
    const findings: Finding[] = []
    for (const file of listFiles(["convex"], [".ts"])) {
      if (isTestFile(file) || file.endsWith(".setup.ts")) continue
      findings.push(...detectRawGetUrl(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("la garde elle-même délivre bien par `getUrl` (sinon le cliquet garderait une coquille vide)", () => {
    expect(readRepoFile(FILE_DELIVERY_GATE)).toMatch(/ctx\.storage\.getUrl\(/)
  })

  it("test du test : un `getUrl` brut est refusé, la garde et un homonyme hors stockage passent", () => {
    const source = [
      "export async function avatar(ctx, id) {",
      "  return await ctx.storage.getUrl(id)",
      "}",
      "export const other = (map) => map.getUrl(\"x\")",
    ].join("\n")
    expect(detectRawGetUrl("convex/modules/people/profile.ts", source).map((finding) => finding.line)).toEqual([2])
    expect(detectRawGetUrl(FILE_DELIVERY_GATE, source)).toEqual([])
  })

  it("test du test : crochets et alias locaux du stockage ne contournent pas la porte", () => {
    const source = [
      'ctx.storage["getUrl"](id)',
      'ctx["storage"].getUrl(id)',
      'const store = ctx.storage; store.getUrl(id)',
      'const { storage: bucket } = ctx; bucket.getUrl(id)',
      'const { getUrl: read } = ctx.storage; read(id)',
      'const direct = ctx.storage.getUrl; direct(id)',
      'map["getUrl"](id)',
      'const other = map; other.getUrl(id)',
      '// ctx.storage.getUrl(id)',
    ].join("\n")
    expect(detectRawGetUrl("convex/modules/media/fixture.ts", source).map((finding) => finding.line)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
