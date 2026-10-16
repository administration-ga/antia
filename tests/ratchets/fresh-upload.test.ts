// Dupliqué de socle/convex/tests/freshUploadRatchet.test.ts @ ad2e7fdc2 — adaptations : chemins du moteur (`convex/modules/files/admission.ts`) ; surfaces vues au démarrage réduites à la garde du moteur (`posedUploads`) ; lecture par les outils communs des cliquets.
/**
 * fresh-upload — CE QU'IL INTERDIT : qu'une surface ADMETTE un fichier fourni
 * par un client (`admitStoredUpload`) sans poser, dans le même fichier, la garde
 * `assertFreshUpload`. `admitStoredUpload` → `enqueueScan` ACCEPTE un fichier
 * déjà connu : sans la garde, connaître le `storageId` d'un tiers suffirait à
 * faire de son fichier la pièce d'une ligne à soi.
 *
 * COMMENT IL LIT : par les appels de l’arbre syntaxique, alias d’import compris —
 * un fichier qui appelle `admitStoredUpload` doit aussi appeler `assertFreshUpload`.
 * Un commentaire ou une chaîne n’est pas un appel. Une reprise
 * VÉRIFIÉE d'un fichier déjà admis s'exempte dans `EXCEPTIONS`, avec sa raison.
 */
import { describe, expect, it } from "vitest"

import { calledNames, importedNames } from "./lib/detectors"
import { isTestFile, listFiles, parseSource, readRepoFile } from "./lib/source-files"

/** Le module qui DÉFINIT les deux primitives. */
const THE_MODULE = "convex/modules/files/admission.ts"

/** Fichiers qui admettent un fichier SANS garde de fraîcheur, et pourquoi. Vide. */
const EXCEPTIONS: Record<string, string> = {}

function admissionCalls(file: string, text: string): { admits: boolean; guards: boolean } {
  const source = parseSource(file, text)
  const calls = calledNames(source, importedNames(source))
  return { admits: calls.has("admitStoredUpload"), guards: calls.has("assertFreshUpload") }
}

function admissions(): { file: string; guards: boolean }[] {
  return listFiles(["convex"], [".ts"])
    .filter((file) => !isTestFile(file) && file !== THE_MODULE)
    .map((file) => ({ file, ...admissionCalls(file, readRepoFile(file)) }))
    .filter(({ admits }) => admits)
}

describe("fresh-upload — toute admission d'un fichier client pose la garde de fraîcheur", () => {
  it("toute surface qui admet un fichier client pose aussi `assertFreshUpload`", () => {
    const bare = admissions()
      .filter(({ file, guards }) => !guards && !(file in EXCEPTIONS))
      .map(({ file }) => file)
    expect(bare).toEqual([])
  })

  it("pas d'exception morte", () => {
    const alive = new Map(admissions().map(({ file, guards }) => [file, guards]))
    const dead = Object.keys(EXCEPTIONS).filter((file) => !alive.has(file) || alive.get(file))
    expect(dead).toEqual([])
  })

  it("le cliquet voit bien les surfaces qu'il garde", () => {
    // Garde-fou du détecteur : s'il ne trouvait plus rien, il passerait au vert sur un parc nu.
    expect(admissions().map(({ file }) => file)).toEqual(expect.arrayContaining(["convex/modules/files/posedUploads.ts"]))
  })

  it("test du test : une garde citée ne protège pas l'admission ; les alias d'import sont vus", () => {
    const file = "convex/modules/media/fixture.ts"
    const fakeGuard = `admitStoredUpload(ctx, file); // assertFreshUpload(ctx, person, id)
const note = "assertFreshUpload("`
    expect(admissionCalls(file, fakeGuard)).toEqual({ admits: true, guards: false })
    expect(admissionCalls(file, `import { admitStoredUpload as admit } from "../files/admission"; admit(ctx, file)`)).toEqual({ admits: true, guards: false })
    expect(admissionCalls(file, `import { admitStoredUpload as admit, assertFreshUpload as fresh } from "../files/admission"; fresh(ctx, person, id); admit(ctx, file)`)).toEqual({ admits: true, guards: true })
    expect(admissionCalls(file, `// admitStoredUpload(ctx, file)
const note = "admitStoredUpload("`)).toEqual({ admits: false, guards: false })
  })
})
