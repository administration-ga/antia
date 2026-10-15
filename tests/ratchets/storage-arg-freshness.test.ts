// Dupliqué de socle/convex/tests/storageArgFreshnessRatchet.test.ts @ ad2e7fdc2 — adaptations : constructeurs publics du moteur (`networkMutation`, `personMutation`, `operatorMutation`, `mutation`, `action`) ; gardes `assertFreshUpload` et `admitPosedUploads` (ni `admitPosedImages`, ni preuve de reprise FP) ; aucune exception ; analyseur sur des sources injectables, pour un « test du test » sur sources fabriquées (le moteur n'a pas encore d'entrée publique qui reçoive un fichier).
/**
 * storage-arg-freshness — CE QU'IL INTERDIT : qu'une fonction PUBLIQUE
 * d'écriture (mutation ou action) reçoive un identifiant de fichier
 * (`v.id("_storage")`, directement ou par un validateur nommé) sans atteindre la
 * garde de fraîcheur. Un `storageId` n'est qu'une référence : une entrée qui
 * l'écrit tel que le client l'envoie laisse poser le fichier d'autrui dans sa
 * ligne — servi ensuite à ses lecteurs, détruit par sa purge.
 *
 * COMMENT IL LIT, par l'arbre syntaxique :
 *  1. les validateurs nommés qui portent `v.id("_storage")` sont résolus par
 *     point fixe sur les déclarations de haut niveau ;
 *  2. les fonctions qui atteignent la garde, par point fixe sur les NOMS de
 *     fonctions dont le corps appelle `assertFreshUpload` ou `admitPosedUploads`
 *     (alias d'import compris), et sur les RÉFÉRENCES des fonctions Convex
 *     exportées qui l'atteignent (`internal.modules.x.y`, pour une action) ;
 *  3. une entrée publique qui reçoit un fichier sans rien de cela est un défaut.
 *
 * SES LIMITES (nommées, comme au socle) : il voit la garde APPELÉE, pas qu'elle
 * porte sur le bon identifiant ; la résolution par NOM peut confondre deux
 * homonymes (les noms génériques et courts sont écartés) ; les requêtes sont
 * hors population (la délivrance est une autre garde : `file-delivery-gate`).
 */
import ts from "typescript"
import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, readRepoFile } from "./lib/source-files"

/** Constructeurs de fonctions PUBLIQUES qui peuvent écrire (ou faire écrire). */
const PUBLIC_BUILDERS = new Set(["mutation", "networkMutation", "personMutation", "operatorMutation", "action"])

/** Les gardes de départ du point fixe. */
const GUARDS = ["assertFreshUpload", "admitPosedUploads"]

/** Noms trop communs pour identifier une fonction par son seul nom. */
const GENERIC_NAMES = new Set([
  "handler", "create", "update", "remove", "delete", "run", "get", "set", "list", "send", "apply", "check", "verify",
  "validate", "insert", "patch", "load", "save", "store", "main", "helper", "inner", "execute", "process", "build",
  "upsert", "attach",
])

/** Entrées publiques qui reçoivent un fichier SANS atteindre la garde, et pourquoi. Vide. */
const EXCEPTIONS: Record<string, string> = {}

const STORAGE_ID = /v\.id\(\s*["']_storage["']\s*\)/

type Source = { rel: string; text: string }
type Entry = { key: string; guarded: boolean }

export function analyse(sources: readonly Source[]): Entry[] {
  const files = sources.map(({ rel, text }) => ({ rel, sf: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true) }))

  // 1. Validateurs nommés porteurs d'un identifiant de fichier (point fixe).
  const declarations: { name: string; text: string }[] = []
  for (const { sf } of files) {
    for (const statement of sf.statements) {
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        const text = declaration.initializer.getText(sf).trim()
        if (!/^(v\.|\{)/.test(text) || declaration.name.text.length < 4) continue
        declarations.push({ name: declaration.name.text, text })
      }
    }
  }
  const storageValidators = new Set<string>()
  const carriesStorage = (text: string): boolean => STORAGE_ID.test(text) || [...storageValidators].some((name) => new RegExp(`\\b${name}\\b`).test(text))
  for (let changed = true; changed; ) {
    changed = false
    for (const { name, text } of declarations) {
      if (storageValidators.has(name) || !carriesStorage(text)) continue
      storageValidators.add(name)
      changed = true
    }
  }

  // 2. Fonctions qui atteignent la garde (point fixe sur les noms et les références).
  const bodies: { name: string; text: string }[] = []
  for (const { sf } of files) {
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        bodies.push({ name: node.name.text, text: node.body.getText(sf) })
      } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        bodies.push({ name: node.name.text, text: node.initializer.getText(sf) })
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  const definitions: { reference: string; text: string }[] = []
  for (const { rel, sf } of files) {
    const module = rel.replace(/^convex\//, "").replace(/\.ts$/, "").split("/").join(".")
    for (const statement of sf.statements) {
      if (!ts.isVariableStatement(statement)) continue
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
        definitions.push({ reference: `${module}.${declaration.name.text}`, text: declaration.initializer.getText(sf) })
      }
    }
  }
  const guards = new Set(GUARDS)
  const references = new Set<string>()
  const calls = (text: string, names: Iterable<string>): boolean => {
    for (const name of names) if (new RegExp(`\\b${name}\\s*\\(`).test(text)) return true
    return false
  }
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const executes = (text: string): boolean => {
    for (const reference of references) if (new RegExp(`\\b(?:internal|api)\\.${escape(reference)}\\b`).test(text)) return true
    return false
  }
  for (let changed = true; changed; ) {
    changed = false
    for (const { name, text } of bodies) {
      if (guards.has(name) || GENERIC_NAMES.has(name) || name.length < 6) continue
      if (!calls(text, guards) && !executes(text)) continue
      guards.add(name)
      changed = true
    }
    for (const { reference, text } of definitions) {
      if (references.has(reference)) continue
      if (!calls(text, guards) && !executes(text)) continue
      references.add(reference)
      changed = true
    }
  }

  // 3. Entrées publiques qui reçoivent un fichier.
  const entries: Entry[] = []
  for (const { rel, sf } of files) {
    const local = new Set(guards)
    for (const statement of sf.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) if (element.propertyName && guards.has(element.propertyName.text)) local.add(element.name.text)
    }
    for (const statement of sf.statements) {
      if (!ts.isVariableStatement(statement)) continue
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
        const call = declaration.initializer
        if (!ts.isIdentifier(call.expression) || !PUBLIC_BUILDERS.has(call.expression.text)) continue
        const definition = call.arguments[0]
        if (!definition || !ts.isObjectLiteralExpression(definition)) continue
        const args = definition.properties.find((property) => property.name !== undefined && property.name.getText(sf) === "args")
        if (!args || !carriesStorage(args.getText(sf))) continue
        entries.push({ key: `${rel}#${declaration.name.text}`, guarded: calls(call.getText(sf), local) || executes(call.getText(sf)) })
      }
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

const ENTRIES = analyse(
  listFiles(["convex"], [".ts"])
    .filter((file) => !isTestFile(file) && !file.endsWith(".setup.ts") && !file.endsWith(".d.ts"))
    .map((rel) => ({ rel, text: readRepoFile(rel) })),
)

describe("storage-arg-freshness — toute entrée publique qui reçoit un fichier atteint la garde de fraîcheur", () => {
  it("aucune entrée publique ne reçoit un identifiant de fichier sans la garde", () => {
    const bare = ENTRIES.filter((entry) => !entry.guarded && !(entry.key in EXCEPTIONS)).map((entry) => entry.key)
    expect(bare).toEqual([])
  })

  it("pas d'exception morte", () => {
    const byKey = new Map(ENTRIES.map((entry) => [entry.key, entry]))
    expect(Object.keys(EXCEPTIONS).filter((key) => byKey.get(key)?.guarded !== false)).toEqual([])
  })

  it("test du test : appel direct, helper d'un autre fichier, alias d'import, action par référence ; et l'entrée nue est vue", () => {
    const sources: Source[] = [
      {
        rel: "convex/modules/media/helpers.ts",
        text: 'export async function attachPostMedia(ctx, id) { await assertFreshUpload(ctx, null, id) }',
      },
      {
        rel: "convex/modules/media/internal.ts",
        text: 'export const admitFor = internalMutation({ args: {}, handler: async (ctx) => attachPostMedia(ctx, "x") })',
      },
      {
        rel: "convex/modules/media/media.ts",
        text: [
          'import { assertFreshUpload as fresh } from "../files/admission"',
          'const fileArg = v.id("_storage")',
          "export const direct = networkMutation({ args: { storageId: v.id(\"_storage\") }, handler: async (ctx, a) => assertFreshUpload(ctx, null, a.storageId) })",
          "export const viaHelper = personMutation({ args: { file: fileArg }, handler: async (ctx, a) => attachPostMedia(ctx, a.file) })",
          "export const viaAlias = mutation({ args: { file: fileArg }, handler: async (ctx, a) => fresh(ctx, null, a.file) })",
          "export const viaAction = action({ args: { file: fileArg }, handler: async (ctx, a) => ctx.runMutation(internal.modules.media.internal.admitFor, {}) })",
          "export const bare = networkMutation({ args: { file: fileArg }, handler: async (ctx, a) => ctx.db.insert(\"x\", { file: a.file }) })",
          "export const reads = networkQuery({ args: { file: fileArg }, handler: async () => null })",
        ].join("\n"),
      },
    ]
    const entries = analyse(sources)
    expect(entries.map((entry) => [entry.key.split("#")[1], entry.guarded])).toEqual([
      ["bare", false],
      ["direct", true],
      ["viaAction", true],
      ["viaAlias", true],
      ["viaHelper", true],
    ])
  })
})
