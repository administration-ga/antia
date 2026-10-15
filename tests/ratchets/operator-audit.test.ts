/**
 * operator-audit — CE QU'IL INTERDIT : qu'une mutation de console
 * (`operatorMutation`) décide sans laisser sa ligne dans le journal des
 * décisions du moteur (`appendAudit`, `convex/modules/platform/audit.ts`).
 * Le cahier l'exige (EXF-AN-39 : journal ; §12.5 : opérateur « en dernier
 * ressort, tracé ») ; l'owner map le fixe (E9).
 *
 * COMMENT IL LIT : par l'arbre syntaxique — chaque appel `operatorMutation({…})`
 * exporté doit contenir, dans sa définition même, un appel `appendAudit(`.
 * Une aide intermédiaire ne compte pas : la ligne d'audit se voit à la lecture
 * de la décision. Une exception VÉRIFIÉE se déclare dans `EXCEPTIONS`
 * (`fichier#export`), avec sa raison. Vide.
 */
import ts from "typescript"
import { describe, expect, it } from "vitest"

import { type Finding, formatFindings, isTestFile, lineOf, listFiles, parseSource, readRepoFile } from "./lib/source-files"

const EXCEPTIONS: Record<string, string> = {}

function detectUnauditedOperatorMutations(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const source = parseSource(file, text)
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer
      if (!initializer || !ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)) continue
      if (initializer.expression.text !== "operatorMutation") continue
      const name = declaration.name.getText(source)
      if (`${file}#${name}` in EXCEPTIONS) continue
      if (/\bappendAudit\s*\(/.test(initializer.getText(source))) continue
      findings.push({ file, line: lineOf(source, declaration.getStart(source)), message: `mutation de console « ${name} » sans appendAudit(…)` })
    }
  }
  return findings
}

function operatorMutationFiles(): { file: string; text: string }[] {
  return listFiles(["convex"], [".ts"])
    .filter((file) => !isTestFile(file))
    .map((file) => ({ file, text: readRepoFile(file) }))
    .filter(({ text }) => /\boperatorMutation\s*\(/.test(text))
}

describe("operator-audit — toute décision de console laisse sa ligne de journal", () => {
  it("le détecteur voit une décision sans journal, et laisse passer celle qui en a un", () => {
    const fabricated = [
      `export const silent = operatorMutation({ args: {}, handler: async (ctx) => { await ctx.db.patch(id, {}) } })`,
      `export const traced = operatorMutation({ args: {}, handler: async (ctx) => { await appendAudit(ctx, entry) } })`,
      `export const reader = operatorQuery({ args: {}, handler: async () => null })`,
    ].join("\n")
    expect(detectUnauditedOperatorMutations("convex/modules/x/fabricated.ts", fabricated).map((finding) => finding.message)).toEqual([
      "mutation de console « silent » sans appendAudit(…)",
    ])
  })

  it("aucune mutation de console ne décide sans journal", () => {
    const findings = operatorMutationFiles().flatMap(({ file, text }) => detectUnauditedOperatorMutations(file, text))
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("pas d'exception morte ; le cliquet voit bien les décisions qu'il garde", () => {
    const declared = new Set(operatorMutationFiles().flatMap(({ file, text }) => [...text.matchAll(/export const (\w+) = operatorMutation\(/g)].map((match) => `${file}#${match[1]}`)))
    expect(Object.keys(EXCEPTIONS).filter((key) => !declared.has(key))).toEqual([])
    // Garde-fou du détecteur : s'il ne trouvait plus rien, il passerait au vert sur un parc nu.
    expect([...declared]).toEqual(expect.arrayContaining(["convex/modules/networks/networks.ts#archive", "convex/modules/people/memberships.ts#suspendEverywhere"]))
  })
})
