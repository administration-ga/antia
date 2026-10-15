// Dupliqué de socle/convex/tests/uploadPolicyRatchet.test.ts @ ad2e7fdc2 — adaptations : SANS exception (le fichier d'exceptions du socle et l'exception `media_social` disparaissent, D36) ; détecteur par l'arbre syntaxique ; deux temps vérifiés : URL par `guardUploadUrl`, rattachement par `admitStoredUpload`.
/**
 * upload-policy — tout dépôt déclare son usage, et tout rattachement le confronte.
 *
 *   1. `ctx.storage.generateUploadUrl` n'est appelé QUE par `guardUploadUrl`
 *      (`convex/lib/uploadPolicy.ts`) : une surface qui délivre une URL de
 *      dépôt nomme son usage ;
 *   2. un fichier qui délivre une URL de dépôt (`guardUploadUrl`) appartient à
 *      un module qui rattache ses fichiers par la garde (`admitStoredUpload`
 *      ou `admitPosedUploads`) : sauter le temps 2 laisse la surface nue.
 */
import { describe, expect, it } from "vitest"

import { detectRawUploadUrl, UPLOAD_POLICY_GATE } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile } from "./lib/source-files"

const BACKEND = listFiles(["convex"], [".ts"]).filter((file) => !isTestFile(file) && !file.endsWith(".setup.ts"))

/** Le dossier de module d'un fichier (`convex/modules/<module>`), ou le fichier lui-même hors module. */
function moduleOf(file: string): string {
  const parts = file.split("/")
  return parts[1] === "modules" ? parts.slice(0, 3).join("/") : file
}

describe("upload-policy — toute URL de dépôt déclare son usage (temps 1) et tout rattachement est gardé (temps 2)", () => {
  it("aucun `storage.generateUploadUrl` hors de la politique de dépôt", () => {
    const findings: Finding[] = []
    for (const file of BACKEND) findings.push(...detectRawUploadUrl(file, readRepoFile(file)))
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("un module qui délivre une URL de dépôt rattache ses fichiers par la garde", () => {
    const delivering = new Set<string>()
    const admitting = new Set<string>()
    for (const file of BACKEND) {
      if (file === UPLOAD_POLICY_GATE) continue
      const text = readRepoFile(file)
      if (/\bguardUploadUrl\s*\(/.test(text)) delivering.add(moduleOf(file))
      if (/\b(admitStoredUpload|admitPosedUploads)\s*\(/.test(text)) admitting.add(moduleOf(file))
    }
    expect([...delivering].filter((module) => !admitting.has(module))).toEqual([])
  })

  it("test du test : un `generateUploadUrl` brut est refusé, la politique passe", () => {
    const source = "export const upload = mutation({ handler: async (ctx) => await ctx.storage.generateUploadUrl() })"
    expect(detectRawUploadUrl("convex/modules/posts/media.ts", source)).toHaveLength(1)
    expect(detectRawUploadUrl(UPLOAD_POLICY_GATE, source)).toEqual([])
  })
})
