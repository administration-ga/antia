// Dupliqué de socle/convex/tests/freshUploadRatchet.test.ts @ ad2e7fdc2 — adaptations : chemins du moteur (`convex/modules/files/admission.ts`) ; surfaces vues au démarrage réduites à la garde du moteur (`posedUploads`) ; lecture par les outils communs des cliquets.
/**
 * fresh-upload — CE QU'IL INTERDIT : qu'une surface ADMETTE un fichier fourni
 * par un client (`admitStoredUpload`) sans poser, dans le même fichier, la garde
 * `assertFreshUpload`. `admitStoredUpload` → `enqueueScan` ACCEPTE un fichier
 * déjà connu : sans la garde, connaître le `storageId` d'un tiers suffirait à
 * faire de son fichier la pièce d'une ligne à soi.
 *
 * COMMENT IL LIT : par le code source, conservateur — un fichier qui APPELLE
 * `admitStoredUpload(` doit aussi appeler `assertFreshUpload(`. Une reprise
 * VÉRIFIÉE d'un fichier déjà admis s'exempte dans `EXCEPTIONS`, avec sa raison.
 */
import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, readRepoFile } from "./lib/source-files"

/** Le module qui DÉFINIT les deux primitives. */
const THE_MODULE = "convex/modules/files/admission.ts"

/** Fichiers qui admettent un fichier SANS garde de fraîcheur, et pourquoi. Vide. */
const EXCEPTIONS: Record<string, string> = {}

function admissions(): { file: string; text: string }[] {
  return listFiles(["convex"], [".ts"])
    .filter((file) => !isTestFile(file) && file !== THE_MODULE)
    .map((file) => ({ file, text: readRepoFile(file) }))
    .filter(({ text }) => /\badmitStoredUpload\s*\(/.test(text))
}

describe("fresh-upload — toute admission d'un fichier client pose la garde de fraîcheur", () => {
  it("toute surface qui admet un fichier client pose aussi `assertFreshUpload`", () => {
    const bare = admissions()
      .filter(({ file, text }) => !/\bassertFreshUpload\s*\(/.test(text) && !(file in EXCEPTIONS))
      .map(({ file }) => file)
    expect(bare).toEqual([])
  })

  it("pas d'exception morte", () => {
    const alive = new Map(admissions().map(({ file, text }) => [file, text]))
    const dead = Object.keys(EXCEPTIONS).filter((file) => !alive.has(file) || /\bassertFreshUpload\s*\(/.test(alive.get(file) ?? ""))
    expect(dead).toEqual([])
  })

  it("le cliquet voit bien les surfaces qu'il garde", () => {
    // Garde-fou du détecteur : s'il ne trouvait plus rien, il passerait au vert sur un parc nu.
    expect(admissions().map(({ file }) => file)).toEqual(expect.arrayContaining(["convex/modules/files/posedUploads.ts"]))
  })
})
