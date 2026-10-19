/**
 * Outils communs des cliquets du moteur : ces tests RELISENT le code (comme
 * `charteRatchet` ou `fileGuardGateRatchet` au socle) et échouent en nommant
 * fichier et ligne. Chaque cliquet a aussi un « test du test » sur une source
 * fabriquée, pour prouver qu'il voit vraiment ce qu'il prétend refuser.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"

/** Racine du dépôt ANTSIA. */
export const REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)))

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "_generated",
  "dist",
  "coverage",
  ".coverage",
  ".git",
  ".convex",
  "out",
])

/** Liste récursive des fichiers (chemins RELATIFS au dépôt, séparateur `/`). */
export function listFiles(directories: readonly string[], extensions: readonly string[]): string[] {
  const out: string[] = []
  const walk = (absolute: string) => {
    if (!existsSync(absolute)) return
    for (const entry of readdirSync(absolute)) {
      if (SKIPPED_DIRECTORIES.has(entry) || entry.startsWith(".")) continue
      const path = join(absolute, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (extensions.includes(extname(entry))) out.push(relative(REPO_ROOT, path).split(sep).join("/"))
    }
  }
  for (const directory of directories) walk(join(REPO_ROOT, directory))
  return out.sort()
}

/** Dossiers de premier niveau des espaces de travail (apps/*, packages/*). */
export function workspaceDirectories(group: "apps" | "packages"): string[] {
  const base = join(REPO_ROOT, group)
  if (!existsSync(base)) return []
  return readdirSync(base)
    .filter((entry) => !entry.startsWith(".") && statSync(join(base, entry)).isDirectory())
    .map((entry) => `${group}/${entry}`)
    .sort()
}

export function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8")
}

export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || path.includes("/tests/") || path.startsWith("tests/")
}

export function parseSource(fileName: string, text: string): ts.SourceFile {
  const extension = extname(fileName)
  const kind =
    extension === ".tsx"
      ? ts.ScriptKind.TSX
      : extension === ".jsx"
        ? ts.ScriptKind.JSX
        : extension === ".js" || extension === ".mjs" || extension === ".cjs"
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
}

export function lineOf(source: ts.SourceFile, position: number): number {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

/** Tous les spécificateurs de module d'un fichier (import, export from, import(), require()). */
export function moduleSpecifiers(source: ts.SourceFile): { specifier: string; line: number }[] {
  const found: { specifier: string; line: number }[] = []
  walk(source, (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ specifier: node.moduleSpecifier.text, line: lineOf(source, node.getStart(source)) })
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [first] = node.arguments
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require"
      if ((isDynamicImport || isRequire) && first && ts.isStringLiteralLike(first)) {
        found.push({ specifier: first.text, line: lineOf(source, node.getStart(source)) })
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      found.push({ specifier: node.argument.literal.text, line: lineOf(source, node.getStart(source)) })
    }
  })
  return found
}

/** Texte des commentaires qui précèdent un nœud (même ligne ou lignes au-dessus). */
export function leadingCommentText(source: ts.SourceFile, node: ts.Node): string {
  const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? []
  return ranges.map((range) => source.text.slice(range.pos, range.end)).join("\n")
}

/** Un défaut de cliquet, toujours localisé. */
export type Finding = { file: string; line: number; message: string }

export function formatFindings(findings: readonly Finding[]): string {
  return findings.map((finding) => `${finding.file}:${finding.line} — ${finding.message}`).join("\n")
}
