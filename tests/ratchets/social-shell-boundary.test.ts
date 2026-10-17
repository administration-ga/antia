import ts from "typescript"
import { describe, expect, it } from "vitest"
import { isTestFile, listFiles, parseSource, readRepoFile } from "./lib/source-files"

/** L'ancienne coque n'entre pas dans social-features ; ses primitives UI restent admises. */
function legacyShellImports(file: string, source: string): string[] {
  const imports: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && /(?:^|\/)espace-personnel(?:\/|\.|$)/.test(node.text) && !node.text.startsWith("@antsia/ui/")) {
      const parent = node.parent
      if ((ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) imports.push(node.text)
      if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) imports.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(parseSource(file, source))
  return imports
}

describe("social-shell-boundary — le cycle historique ne revient pas", () => {
  it("aucune ancienne coque espace-personnel ni dépendance vers elle dans les surfaces sociales", () => {
    const files = listFiles(["packages/social-features/src"], [".ts", ".tsx"]).filter((file) => !isTestFile(file))
    expect(files.length).toBeGreaterThan(0)
    const problems = files.flatMap((file) => {
      const imports = legacyShellImports(file, readRepoFile(file))
      return [...(/\/espace-personnel\//.test(file) ? [file] : []), ...imports.map((path) => `${file}: ${path}`)]
    })
    expect(problems).toEqual([])
  })

  it("voit les imports statiques, réexports et dynamiques ; admet les primitives du paquet UI", () => {
    const source = [
      'import { shell } from "../espace-personnel/shell"',
      'export { x } from "../espace-personnel"',
      'const old = import("@antsia/social-features/espace-personnel")',
      'import { Button } from "@antsia/ui/espace-personnel/button"',
    ].join("\n")
    expect(legacyShellImports("fixture.ts", source)).toEqual(["../espace-personnel/shell", "../espace-personnel", "@antsia/social-features/espace-personnel"])
  })
})
