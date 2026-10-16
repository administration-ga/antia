// Dupliqué de socle/convex/tests/notificationsWriterRatchet.test.ts @ ad2e7fdc2 — adaptations : porte du moteur (`convex/modules/notifications/notify.ts`) ; AUCUNE exemption (le moteur naît avec une seule porte) ; contrôle `type: "…" as any` retiré (typage strict et cliquet `no-any-validators`) ; lecture AST et alias const locaux par les outils communs des cliquets ; tests du détecteur sur des sources fabriquées.
/**
 * notifications-writer — CE QU'IL INTERDIT : qu'un fichier du moteur écrive
 * dans la table `notifications` sans passer par la porte unique
 * (`notifyPerson`, ou `enqueueFanout` qui l'appelle). La porte refuse
 * soi-même, le non-membre et le blocage, et dédoublonne : un écrivain direct
 * sonnerait à travers un blocage.
 *
 * COMMENT IL LIT : par l'arbre syntaxique — toute insertion
 * `db.insert("notifications", …)` ou `db["insert"](…)` hors de la porte échoue,
 * y compris un alias local const de l'insertion ou du nom de la table. Les
 * références dynamiques/interprocédurales ne sont pas résolues. Les tests
 * posent leurs fixtures directement ; ils ne sont pas balayés.
 */
import ts from "typescript"
import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, parseSource, readRepoFile, walk } from "./lib/source-files"

/** L'UNIQUE écrivain de la table. */
const GATE = "convex/modules/notifications/notify.ts"

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression
  return current
}

/** Résout seulement les const du bloc lexical ; une variable/paramètre masque l'extérieur. */
function localConstInitializer(identifier: ts.Identifier): ts.Expression | undefined {
  for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
    if (ts.isBlock(scope) || ts.isSourceFile(scope)) {
      for (const statement of scope.statements) {
        if (!ts.isVariableStatement(statement)) continue
        const declaration = statement.declarationList.declarations.find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === identifier.text)
        if (declaration) return statement.declarationList.flags & ts.NodeFlags.Const ? declaration.initializer : undefined
      }
    }
    if (ts.isFunctionLike(scope) && scope.parameters.some((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === identifier.text)) return undefined
  }
  return undefined
}

function propertyAccess(expression: ts.Expression, name: string): ts.Expression | undefined {
  const current = unwrapExpression(expression)
  if (ts.isPropertyAccessExpression(current) && current.name.text === name) return current.expression
  if (ts.isElementAccessExpression(current) && ts.isStringLiteralLike(current.argumentExpression) && current.argumentExpression.text === name) return current.expression
  return undefined
}

function isInsert(expression: ts.Expression, seen = new Set<ts.Expression>()): boolean {
  const current = unwrapExpression(expression)
  if (seen.has(current)) return false
  seen.add(current)
  if (ts.isIdentifier(current)) {
    const initializer = localConstInitializer(current)
    return initializer ? isInsert(initializer, seen) : false
  }
  const receiver = propertyAccess(current, "insert")
  return receiver !== undefined && ((ts.isIdentifier(receiver) && receiver.text === "db") || propertyAccess(receiver, "db") !== undefined)
}

function isNotificationsTable(expression: ts.Expression, seen = new Set<ts.Expression>()): boolean {
  const current = unwrapExpression(expression)
  if (seen.has(current)) return false
  seen.add(current)
  if (ts.isStringLiteralLike(current)) return current.text === "notifications"
  if (!ts.isIdentifier(current)) return false
  const initializer = localConstInitializer(current)
  return initializer ? isNotificationsTable(initializer, seen) : false
}

function countNotificationInserts(text: string): number {
  const source = parseSource("convex/fixture.ts", text)
  let count = 0
  walk(source, (node) => {
    if (!ts.isCallExpression(node)) return
    const first = node.arguments[0]
    if (first && isInsert(node.expression) && isNotificationsTable(first)) count += 1
  })
  return count
}

function writers(): Map<string, number> {
  return new Map(
    listFiles(["convex"], [".ts"])
      .filter((file) => !isTestFile(file))
      .map((file) => [file, countNotificationInserts(readRepoFile(file))] as const)
      .filter(([, inserts]) => inserts > 0),
  )
}

describe("notifications-writer — une seule porte d'écriture de la cloche", () => {
  it("le détecteur voit une insertion directe, pas un commentaire ni une table voisine", () => {
    const fabricated = [
      `await ctx.db.insert("notifications", { networkId })`,
      `await db.insert( 'notifications', row)`,
      `// ctx.db.insert("notifications", row) — commentaire`,
      `/* db.insert("notifications") */`,
      `await ctx.db.insert("notificationPreferences", row)`,
    ].join("\n")
    expect(countNotificationInserts(fabricated)).toBe(2)
  })

  it("voit les insertions entre crochets et via des alias const locaux", () => {
    const fabricated = [
      'await ctx.db["insert"]("notifications", row)',
      'const insert = ctx.db.insert',
      'const table = "notifications" as const',
      "await insert(table, row)",
      "const secondInsert = insert",
      "const secondTable = table",
      "await secondInsert(secondTable, row)",
      'await ctx["db"]["insert"](`notifications`, row)',
      'await ctx.db.insert("notificationPreferences", row)',
    ].join("\n")
    expect(countNotificationInserts(fabricated)).toBe(4)
  })

  it("ne traite pas // ou /* dans une chaîne comme un commentaire masquant l'insertion", () => {
    expect(countNotificationInserts('const marker = "// faux commentaire"; await ctx.db.insert("notifications", row)')).toBe(1)
    expect(countNotificationInserts('const marker = "/* faux commentaire */"; await ctx.db["insert"]("notifications", row)')).toBe(1)
    expect(countNotificationInserts('const quoted = \'ctx.db.insert("notifications", row)\'')).toBe(0)
  })

  it("respecte les blocs lexicaux et les paramètres qui masquent une table ou une insertion", () => {
    const fabricated = [
      'const table = "notifications"',
      "const insert = ctx.db.insert",
      '{ const table = "other"; await insert(table, row) }',
      "{ const insert = otherMethod; await insert(table, row) }",
      "async function other(table: string) { await insert(table, row) }",
      "async function shadow(insert: OtherMethod) { await insert(table, row) }",
      '{ let table = "other"; await insert(table, row) }',
      "await insert(table, row)",
    ].join("\n")
    expect(countNotificationInserts(fabricated)).toBe(1)
  })

  it("les alias circulaires ne bouclent pas et les méthodes voisines ne sont pas des insertions", () => {
    const fabricated = [
      "const first = second; const second = first; await first(table, row)",
      "const table = another; const another = table; await ctx.db.insert(table, row)",
      'await ctx.db.patch("notifications", row)',
      'await log.insert("notifications", row)',
    ].join("\n")
    expect(countNotificationInserts(fabricated)).toBe(0)
  })

  it("la porte écrit elle-même dans la table — c'est sa raison d'être", () => {
    expect(writers().get(GATE) ?? 0).toBeGreaterThan(0)
  })

  it("aucun écrivain direct hors de la porte", () => {
    const offenders = [...writers().keys()].filter((file) => file !== GATE)
    expect(offenders, "Passer par `notifyPerson` (convex/modules/notifications/notify.ts) ou `enqueueFanout`.").toEqual([])
  })
})
